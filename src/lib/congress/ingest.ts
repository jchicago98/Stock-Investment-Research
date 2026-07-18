import { desc, isNotNull } from "drizzle-orm";
import { schema } from "../../db";
import { scrapeSenateEfd } from "./efd";
import { fetchFmpTrades } from "./fmp";
import { LegislatorDirectory } from "./legislators";
import type { CongressTransaction } from "./types";

type Db = typeof import("../../db").db;

const DEFAULT_WINDOW_DAYS = 365;
const INCREMENTAL_OVERLAP_DAYS = 14;

function windowStart(db: Db): Date {
  const latest = db
    .select({ d: schema.congressTrades.disclosureDate })
    .from(schema.congressTrades)
    .where(isNotNull(schema.congressTrades.disclosureDate))
    .orderBy(desc(schema.congressTrades.disclosureDate))
    .limit(1)
    .all()[0]?.d;

  if (latest) {
    const d = new Date(latest);
    d.setDate(d.getDate() - INCREMENTAL_OVERLAP_DAYS);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_WINDOW_DAYS);
  return d;
}

export async function refreshCongressTrades(db: Db): Promise<void> {
  const since = windowStart(db);
  console.log(
    `Fetching congressional trades disclosed since ${since.toISOString().slice(0, 10)}...`,
  );

  const directory = await LegislatorDirectory.load();
  const all: CongressTransaction[] = [];

  try {
    const senate = await scrapeSenateEfd(since);
    console.log(
      `  Senate eFD: ${senate.transactions.length} transactions from ${senate.filingsSeen} filings (${senate.paperSkipped} paper filings skipped)`,
    );
    all.push(...senate.transactions);
  } catch (err) {
    console.warn(
      `  ! Senate eFD scrape failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  const fmpKey = process.env.FMP_API_KEY;
  if (fmpKey) {
    for (const chamber of ["house", "senate"] as const) {
      try {
        const trades = await fetchFmpTrades(chamber, since, fmpKey);
        console.log(`  FMP ${chamber}: ${trades.length} transactions`);
        all.push(...trades);
      } catch (err) {
        console.warn(
          `  ! FMP ${chamber} fetch failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  } else {
    console.log(
      "  (House coverage off — set FMP_API_KEY for House trades via financialmodelingprep.com free tier)",
    );
  }

  if (all.length === 0) {
    console.warn("  No congressional transactions fetched; keeping existing data.");
    return;
  }

  const now = new Date();
  let inserted = 0;
  db.transaction((tx) => {
    for (const t of all) {
      const info = directory.lookup(t.politician, t.chamber);
      const res = tx
        .insert(schema.congressTrades)
        .values({
          chamber: t.chamber,
          politician: t.politician,
          party: t.party ?? info?.party ?? null,
          state: t.state ?? info?.state ?? null,
          ticker: t.ticker ?? null,
          assetDescription: t.assetDescription ?? null,
          txType: t.txType,
          amountRange: t.amountRange ?? null,
          amountMin: t.amountMin ?? null,
          transactionDate: t.transactionDate ?? null,
          disclosureDate: t.disclosureDate ?? null,
          sourceKey: t.sourceKey,
        })
        .onConflictDoNothing({ target: schema.congressTrades.sourceKey })
        .run();
      inserted += res.changes;
    }
    const meta = {
      key: "congress",
      refreshedAt: now,
      note: `${inserted} new transactions ingested`,
    };
    tx.insert(schema.cacheMeta)
      .values(meta)
      .onConflictDoUpdate({ target: schema.cacheMeta.key, set: meta })
      .run();
  });
  console.log(`  Done. ${inserted} new transactions (${all.length} fetched).`);
}
