// Refreshes all app data: stock universe, fundamentals, factor scores, and
// congressional trades. Run with: npm run refresh-data
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { marketData } from "../src/lib/provider/yahoo";
import type { StockFundamentals } from "../src/lib/provider/types";
import { fetchUniverse, type UniverseStock } from "../src/lib/universe";
import { scoreUniverse } from "../src/lib/scoring/factors";
import { generateWhyBullets, universeMedians } from "../src/lib/scoring/why";
import { refreshCongressTrades } from "../src/lib/congress/ingest";

const CONCURRENCY = 4;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchFundamentalsFor(
  stock: UniverseStock,
): Promise<Partial<StockFundamentals> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const f = await marketData.getFundamentals(stock.ticker);
      return { ...f, ticker: stock.ticker, name: f.name ?? stock.name, sector: stock.sector };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        console.warn(
          `  ! ${stock.ticker}: ${err instanceof Error ? err.message.slice(0, 120) : err}`,
        );
      }
    }
  }
  return null;
}

async function refreshStocks() {
  console.log("Fetching S&P 500 universe...");
  const { stocks: universe, source } = await fetchUniverse();
  console.log(`  ${universe.length} constituents (${source})`);

  console.log("Fetching fundamentals (this takes a few minutes)...");
  let done = 0;
  const fundamentals = await mapPool(universe, CONCURRENCY, async (stock) => {
    const result = await fetchFundamentalsFor(stock);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${universe.length}`);
    return result;
  });

  const ok = fundamentals.filter(
    (f): f is Partial<StockFundamentals> => f !== null,
  );
  console.log(`  Got fundamentals for ${ok.length}/${universe.length}`);
  if (ok.length < universe.length * 0.5) {
    throw new Error(
      "More than half the universe failed to fetch — aborting so stale scores aren't overwritten.",
    );
  }

  console.log("Scoring universe...");
  const scored = scoreUniverse(ok);
  const medians = universeMedians(ok);
  const now = new Date();
  const universeByTicker = new Map(universe.map((u) => [u.ticker, u]));

  db.transaction((tx) => {
    for (let i = 0; i < ok.length; i++) {
      const f = ok[i];
      const s = scored[i];
      const u = universeByTicker.get(f.ticker!);
      const bullets = generateWhyBullets(f, s.metricPercentiles, medians);

      const stockRow = {
        ticker: f.ticker!,
        name: f.name ?? f.ticker!,
        sector: f.sector ?? "Unknown",
        subIndustry: u?.subIndustry ?? null,
        price: f.price ?? null,
        marketCap: f.marketCap ?? null,
        trailingPE: f.trailingPE ?? null,
        priceToFcf: f.priceToFcf ?? null,
        evToEbitda: f.evToEbitda ?? null,
        returnOnEquity: f.returnOnEquity ?? null,
        operatingMargin: f.operatingMargin ?? null,
        debtToEquity: f.debtToEquity ?? null,
        freeCashflow: f.freeCashflow ?? null,
        revenueGrowth: f.revenueGrowth ?? null,
        earningsGrowth: f.earningsGrowth ?? null,
        momentum12m1m: f.momentum12m1m ?? null,
        updatedAt: now,
      };
      tx.insert(schema.stocks)
        .values(stockRow)
        .onConflictDoUpdate({ target: schema.stocks.ticker, set: stockRow })
        .run();

      const scoreRow = {
        ticker: f.ticker!,
        value: s.factors.value ?? 0,
        quality: s.factors.quality ?? 0,
        growth: s.factors.growth ?? 0,
        momentum: s.factors.momentum ?? 0,
        composite: s.composite,
        grade: s.grade,
        whyJson: JSON.stringify(bullets),
        computedAt: now,
      };
      tx.insert(schema.factorScores)
        .values(scoreRow)
        .onConflictDoUpdate({ target: schema.factorScores.ticker, set: scoreRow })
        .run();
    }

    const meta = {
      key: "stocks",
      refreshedAt: now,
      note: `${ok.length} stocks scored (universe: ${source})`,
    };
    tx.insert(schema.cacheMeta)
      .values(meta)
      .onConflictDoUpdate({ target: schema.cacheMeta.key, set: meta })
      .run();
  });

  const graded = db
    .select()
    .from(schema.factorScores)
    .where(eq(schema.factorScores.grade, "A"))
    .all();
  console.log(`  Done. ${scored.length} stocks scored, ${graded.length} A-grades.`);
}

async function main() {
  const started = Date.now();
  await refreshStocks();
  await refreshCongressTrades(db);
  console.log(`Refresh complete in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
