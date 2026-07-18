import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// One row per stock in the scored universe (~S&P 500).
export const stocks = sqliteTable("stocks", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull().default("Unknown"),
  subIndustry: text("sub_industry"),
  price: real("price"),
  marketCap: real("market_cap"),
  // Raw fundamentals used by the scoring engine (nullable — Yahoo data has gaps)
  trailingPE: real("trailing_pe"),
  priceToFcf: real("price_to_fcf"),
  evToEbitda: real("ev_to_ebitda"),
  returnOnEquity: real("return_on_equity"),
  operatingMargin: real("operating_margin"),
  debtToEquity: real("debt_to_equity"),
  freeCashflow: real("free_cashflow"),
  revenueGrowth: real("revenue_growth"),
  earningsGrowth: real("earnings_growth"),
  // 12-month return excluding most recent month (momentum input)
  momentum12m1m: real("momentum_12m_1m"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Computed factor scores, one row per stock, rewritten on each refresh.
export const factorScores = sqliteTable("factor_scores", {
  ticker: text("ticker")
    .primaryKey()
    .references(() => stocks.ticker, { onDelete: "cascade" }),
  value: real("value").notNull(),
  quality: real("quality").notNull(),
  growth: real("growth").notNull(),
  momentum: real("momentum").notNull(),
  composite: real("composite").notNull(),
  grade: text("grade").notNull(),
  // JSON array of plain-English "why" bullets
  whyJson: text("why_json").notNull().default("[]"),
  computedAt: integer("computed_at", { mode: "timestamp" }),
});

export const congressTrades = sqliteTable(
  "congress_trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chamber: text("chamber", { enum: ["house", "senate"] }).notNull(),
    politician: text("politician").notNull(),
    party: text("party"),
    state: text("state"),
    ticker: text("ticker"),
    assetDescription: text("asset_description"),
    // "buy" | "sell" | "exchange" (normalized from source's purchase/sale types)
    txType: text("tx_type").notNull(),
    amountRange: text("amount_range"),
    amountMin: real("amount_min"),
    transactionDate: text("transaction_date"),
    disclosureDate: text("disclosure_date"),
    // Source hash to dedupe on re-ingest
    sourceKey: text("source_key").notNull().unique(),
  },
  (t) => [
    index("ct_ticker_idx").on(t.ticker),
    index("ct_politician_idx").on(t.politician),
    index("ct_txdate_idx").on(t.transactionDate),
  ],
);

export const watchlist = sqliteTable("watchlist", {
  ticker: text("ticker").primaryKey(),
  addedAt: integer("added_at", { mode: "timestamp" }),
});

// Tracks when each dataset was last refreshed, for staleness banners.
export const cacheMeta = sqliteTable("cache_meta", {
  key: text("key").primaryKey(),
  refreshedAt: integer("refreshed_at", { mode: "timestamp" }),
  note: text("note"),
});
