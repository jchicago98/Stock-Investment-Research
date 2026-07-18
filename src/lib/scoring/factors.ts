import type { StockFundamentals } from "../provider/types";

// Factor weights for the composite score. Quality weighted highest — the most
// robust factor in the academic literature for long-horizon investors.
export const FACTOR_WEIGHTS = {
  value: 0.25,
  quality: 0.3,
  growth: 0.25,
  momentum: 0.2,
} as const;

export type FactorName = keyof typeof FACTOR_WEIGHTS;

export interface MetricPercentiles {
  trailingPE?: number;
  priceToFcf?: number;
  evToEbitda?: number;
  returnOnEquity?: number;
  operatingMargin?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  momentum12m1m?: number;
}

export interface ScoredStock {
  ticker: string;
  factors: Partial<Record<FactorName, number>>;
  composite: number;
  grade: string;
  // Percentile rank (0-100, higher = better) of each underlying metric
  metricPercentiles: MetricPercentiles;
  // True when too few metrics were available to trust the score
  lowData: boolean;
}

// Percentile rank (0-100) of each value against the others. `direction`
// "higher" means larger raw values score higher. Nulls stay null.
export function percentileRanks(
  values: (number | null | undefined)[],
  direction: "higher" | "lower",
): (number | null)[] {
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => typeof x.v === "number" && Number.isFinite(x.v));

  if (present.length === 0) return values.map(() => null);
  if (present.length === 1) return values.map((v) => (typeof v === "number" ? 50 : null));

  const sorted = [...present].sort((a, b) => a.v - b.v);
  const ranks = new Array<number | null>(values.length).fill(null);

  // Average rank for ties, scaled to 0-100.
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    const avgRank = (i + j) / 2;
    let pct = (avgRank / (sorted.length - 1)) * 100;
    if (direction === "lower") pct = 100 - pct;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = pct;
    i = j + 1;
  }
  return ranks;
}

export function gradeFor(composite: number): string {
  if (composite >= 80) return "A";
  if (composite >= 65) return "B";
  if (composite >= 50) return "C";
  if (composite >= 35) return "D";
  return "F";
}

interface MetricDef {
  key: keyof MetricPercentiles;
  factor: FactorName;
  direction: "higher" | "lower";
  // Filter out raw values that are meaningless for ranking (e.g. negative P/E)
  valid?: (v: number) => boolean;
}

export const METRIC_DEFS: MetricDef[] = [
  { key: "trailingPE", factor: "value", direction: "lower", valid: (v) => v > 0 },
  { key: "priceToFcf", factor: "value", direction: "lower", valid: (v) => v > 0 },
  { key: "evToEbitda", factor: "value", direction: "lower", valid: (v) => v > 0 },
  { key: "returnOnEquity", factor: "quality", direction: "higher" },
  { key: "operatingMargin", factor: "quality", direction: "higher" },
  { key: "debtToEquity", factor: "quality", direction: "lower", valid: (v) => v >= 0 },
  { key: "revenueGrowth", factor: "growth", direction: "higher" },
  { key: "earningsGrowth", factor: "growth", direction: "higher" },
  { key: "momentum12m1m", factor: "momentum", direction: "higher" },
];

// Minimum underlying metrics required before a composite is trustworthy.
const MIN_METRICS = 4;

export function scoreUniverse(
  stocks: Partial<StockFundamentals>[],
): ScoredStock[] {
  // Rank every metric across the universe first.
  const percentilesByMetric = new Map<string, (number | null)[]>();
  for (const def of METRIC_DEFS) {
    const raw = stocks.map((s) => {
      const v = s[def.key];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (def.valid && !def.valid(v)) return null;
      return v;
    });
    percentilesByMetric.set(def.key, percentileRanks(raw, def.direction));
  }

  return stocks.map((stock, i) => {
    const metricPercentiles: MetricPercentiles = {};
    const byFactor: Record<FactorName, number[]> = {
      value: [],
      quality: [],
      growth: [],
      momentum: [],
    };
    let metricCount = 0;

    for (const def of METRIC_DEFS) {
      const pct = percentilesByMetric.get(def.key)![i];
      if (pct === null) continue;
      metricPercentiles[def.key] = pct;
      byFactor[def.factor].push(pct);
      metricCount++;
    }

    const factors: Partial<Record<FactorName, number>> = {};
    let weightedSum = 0;
    let weightTotal = 0;
    for (const name of Object.keys(FACTOR_WEIGHTS) as FactorName[]) {
      const parts = byFactor[name];
      if (parts.length === 0) continue;
      const score = parts.reduce((a, b) => a + b, 0) / parts.length;
      factors[name] = score;
      weightedSum += score * FACTOR_WEIGHTS[name];
      weightTotal += FACTOR_WEIGHTS[name];
    }

    // Renormalize over available factors so missing data doesn't drag to zero.
    const composite = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const lowData = metricCount < MIN_METRICS;

    return {
      ticker: stock.ticker ?? "?",
      factors,
      composite,
      grade: lowData ? "N/A" : gradeFor(composite),
      metricPercentiles,
      lowData,
    };
  });
}
