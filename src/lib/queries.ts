import { and, count, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { WhyBullet } from "./scoring/why";

export type StockRow = typeof schema.stocks.$inferSelect;
export type ScoreRow = typeof schema.factorScores.$inferSelect;
export type CongressTradeRow = typeof schema.congressTrades.$inferSelect;

export interface ScoredStock extends StockRow {
  score: ScoreRow;
  why: WhyBullet[];
}

function parseWhy(json: string): WhyBullet[] {
  try {
    return JSON.parse(json) as WhyBullet[];
  } catch {
    return [];
  }
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function getScoredStocks(opts?: { sector?: string }): ScoredStock[] {
  const rows = db
    .select()
    .from(schema.stocks)
    .innerJoin(
      schema.factorScores,
      eq(schema.stocks.ticker, schema.factorScores.ticker),
    )
    .where(opts?.sector ? eq(schema.stocks.sector, opts.sector) : undefined)
    .all();

  return rows
    .map((r) => ({
      ...r.stocks,
      score: r.factor_scores,
      why: parseWhy(r.factor_scores.whyJson),
    }))
    .sort((a, b) => {
      // Low-data stocks always rank below fully-scored ones.
      if (a.score.grade === "N/A" !== (b.score.grade === "N/A")) {
        return a.score.grade === "N/A" ? 1 : -1;
      }
      return b.score.composite - a.score.composite;
    });
}

export function getStock(ticker: string): ScoredStock | undefined {
  const rows = db
    .select()
    .from(schema.stocks)
    .innerJoin(
      schema.factorScores,
      eq(schema.stocks.ticker, schema.factorScores.ticker),
    )
    .where(eq(schema.stocks.ticker, ticker.toUpperCase()))
    .all();
  const r = rows[0];
  if (!r) return undefined;
  return { ...r.stocks, score: r.factor_scores, why: parseWhy(r.factor_scores.whyJson) };
}

export function getSectors(): string[] {
  return db
    .selectDistinct({ sector: schema.stocks.sector })
    .from(schema.stocks)
    .all()
    .map((r) => r.sector)
    .sort();
}

export interface CongressFilters {
  chamber?: "house" | "senate";
  txType?: string;
  search?: string; // matches politician or ticker
  ticker?: string;
  limit?: number;
  offset?: number;
}

export function getCongressTrades(filters: CongressFilters = {}) {
  const conds = [];
  if (filters.chamber) conds.push(eq(schema.congressTrades.chamber, filters.chamber));
  if (filters.txType) conds.push(eq(schema.congressTrades.txType, filters.txType));
  if (filters.ticker)
    conds.push(eq(schema.congressTrades.ticker, filters.ticker.toUpperCase()));
  if (filters.search) {
    const pat = `%${filters.search}%`;
    conds.push(
      or(
        like(schema.congressTrades.politician, pat),
        like(schema.congressTrades.ticker, pat),
      ),
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = db
    .select()
    .from(schema.congressTrades)
    .where(where)
    .orderBy(
      desc(schema.congressTrades.transactionDate),
      desc(schema.congressTrades.disclosureDate),
    )
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
    .all();

  const total = db
    .select({ n: count() })
    .from(schema.congressTrades)
    .where(where)
    .all()[0].n;

  return { rows, total };
}

// Tickers most bought by members of Congress in the trailing window.
export function getMostBoughtByCongress(days = 90, limit = 10) {
  return db
    .select({
      ticker: schema.congressTrades.ticker,
      buys: count(),
      politicians: sql<number>`count(distinct ${schema.congressTrades.politician})`,
    })
    .from(schema.congressTrades)
    .where(
      and(
        eq(schema.congressTrades.txType, "buy"),
        sql`${schema.congressTrades.ticker} is not null`,
        gte(schema.congressTrades.transactionDate, daysAgoIso(days)),
      ),
    )
    .groupBy(schema.congressTrades.ticker)
    .orderBy(desc(count()))
    .limit(limit)
    .all();
}

export function getMostActiveTraders(days = 90, limit = 10) {
  return db
    .select({
      politician: schema.congressTrades.politician,
      party: schema.congressTrades.party,
      chamber: schema.congressTrades.chamber,
      trades: count(),
    })
    .from(schema.congressTrades)
    .where(gte(schema.congressTrades.transactionDate, daysAgoIso(days)))
    .groupBy(schema.congressTrades.politician)
    .orderBy(desc(count()))
    .limit(limit)
    .all();
}

// Congress buy counts for a set of tickers — the overlay signal on picks.
export function getCongressBuySignals(
  tickers: string[],
  days = 90,
): Map<string, { buys: number; politicians: number }> {
  if (tickers.length === 0) return new Map();
  const rows = db
    .select({
      ticker: schema.congressTrades.ticker,
      buys: count(),
      politicians: sql<number>`count(distinct ${schema.congressTrades.politician})`,
    })
    .from(schema.congressTrades)
    .where(
      and(
        eq(schema.congressTrades.txType, "buy"),
        inArray(schema.congressTrades.ticker, tickers),
        gte(schema.congressTrades.transactionDate, daysAgoIso(days)),
      ),
    )
    .groupBy(schema.congressTrades.ticker)
    .all();
  return new Map(
    rows.filter((r) => r.ticker).map((r) => [r.ticker!, { buys: r.buys, politicians: r.politicians }]),
  );
}

// Tickers that have a stock page — used to decide whether to link a ticker.
export function getKnownTickers(): Set<string> {
  return new Set(
    db
      .select({ ticker: schema.stocks.ticker })
      .from(schema.stocks)
      .all()
      .map((r) => r.ticker),
  );
}

export function getWatchlist(): string[] {
  return db
    .select({ ticker: schema.watchlist.ticker })
    .from(schema.watchlist)
    .all()
    .map((r) => r.ticker);
}

export function getRefreshInfo() {
  const rows = db.select().from(schema.cacheMeta).all();
  return Object.fromEntries(rows.map((r) => [r.key, r]));
}
