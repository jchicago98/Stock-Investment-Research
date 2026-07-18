import type { StockFundamentals } from "../provider/types";
import type { MetricPercentiles } from "./factors";

export interface WhyBullet {
  text: string;
  factor: "value" | "quality" | "growth" | "momentum";
  sentiment: "strength" | "concern";
  // How extreme the underlying percentile is; used to order bullets
  weight: number;
}

const STRENGTH_THRESHOLD = 70;
const CONCERN_THRESHOLD = 30;

const fmt = (n: number, digits = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

export interface UniverseMedians {
  trailingPE?: number;
  priceToFcf?: number;
  evToEbitda?: number;
  returnOnEquity?: number;
  operatingMargin?: number;
  revenueGrowth?: number;
}

export function median(values: (number | null | undefined)[]): number | undefined {
  const nums = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return undefined;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function universeMedians(
  stocks: Partial<StockFundamentals>[],
): UniverseMedians {
  return {
    trailingPE: median(stocks.map((s) => (s.trailingPE && s.trailingPE > 0 ? s.trailingPE : null))),
    priceToFcf: median(stocks.map((s) => (s.priceToFcf && s.priceToFcf > 0 ? s.priceToFcf : null))),
    evToEbitda: median(stocks.map((s) => (s.evToEbitda && s.evToEbitda > 0 ? s.evToEbitda : null))),
    returnOnEquity: median(stocks.map((s) => s.returnOnEquity)),
    operatingMargin: median(stocks.map((s) => s.operatingMargin)),
    revenueGrowth: median(stocks.map((s) => s.revenueGrowth)),
  };
}

// Describes a percentile as a human phrase, e.g. "top 10%" of the universe.
function topPhrase(pct: number): string {
  const top = Math.max(1, Math.round(100 - pct));
  if (top <= 10) return `top ${top}%`;
  if (top <= 25) return "top quartile";
  return `top ${Math.ceil(top / 10) * 10}%`;
}

export function generateWhyBullets(
  stock: Partial<StockFundamentals>,
  pct: MetricPercentiles,
  medians: UniverseMedians,
): WhyBullet[] {
  const bullets: WhyBullet[] = [];

  const add = (
    metricPct: number | undefined,
    factor: WhyBullet["factor"],
    strength: (p: number) => string,
    concern: (p: number) => string,
  ) => {
    if (typeof metricPct !== "number") return;
    if (metricPct >= STRENGTH_THRESHOLD) {
      bullets.push({ text: strength(metricPct), factor, sentiment: "strength", weight: metricPct });
    } else if (metricPct <= CONCERN_THRESHOLD) {
      bullets.push({ text: concern(metricPct), factor, sentiment: "concern", weight: 100 - metricPct });
    }
  };

  const s = stock;
  const m = medians;

  add(
    pct.trailingPE,
    "value",
    () =>
      `Trades at ${fmt(s.trailingPE!)}× earnings` +
      (m.trailingPE ? ` vs. S&P 500 median ${fmt(m.trailingPE, 0)}×` : ""),
    () =>
      `Expensive at ${fmt(s.trailingPE!)}× earnings` +
      (m.trailingPE ? ` vs. S&P 500 median ${fmt(m.trailingPE, 0)}×` : ""),
  );

  add(
    pct.priceToFcf,
    "value",
    () => `Strong cash-flow value: ${fmt(s.priceToFcf!)}× free cash flow`,
    () => `Pricey vs. cash generated: ${fmt(s.priceToFcf!)}× free cash flow`,
  );

  add(
    pct.evToEbitda,
    "value",
    () => `Cheap on EV/EBITDA at ${fmt(s.evToEbitda!)}×`,
    () => `Rich EV/EBITDA multiple of ${fmt(s.evToEbitda!)}×`,
  );

  add(
    pct.returnOnEquity,
    "quality",
    (p) => `Return on equity of ${fmt(s.returnOnEquity! * 100, 0)}% — ${topPhrase(p)} of the S&P 500`,
    () => `Weak return on equity of ${fmt(s.returnOnEquity! * 100, 0)}%`,
  );

  add(
    pct.operatingMargin,
    "quality",
    (p) => `Operating margin of ${fmt(s.operatingMargin! * 100, 0)}% — ${topPhrase(p)}`,
    () => `Thin operating margin of ${fmt(s.operatingMargin! * 100, 0)}%`,
  );

  add(
    pct.debtToEquity,
    "quality",
    () => `Conservative balance sheet: debt is ${fmt(s.debtToEquity!, 0)}% of equity`,
    () => `Heavy debt load: ${fmt(s.debtToEquity!, 0)}% of equity`,
  );

  add(
    pct.revenueGrowth,
    "growth",
    () => `Revenue growing ${fmt(s.revenueGrowth! * 100)}% year-over-year`,
    () =>
      s.revenueGrowth! < 0
        ? `Revenue shrinking ${fmt(Math.abs(s.revenueGrowth!) * 100)}% year-over-year`
        : `Slow revenue growth of ${fmt(s.revenueGrowth! * 100)}%`,
  );

  add(
    pct.earningsGrowth,
    "growth",
    () => `Earnings up ${fmt(s.earningsGrowth! * 100)}% year-over-year`,
    () =>
      s.earningsGrowth! < 0
        ? `Earnings down ${fmt(Math.abs(s.earningsGrowth!) * 100)}% year-over-year`
        : `Sluggish earnings growth of ${fmt(s.earningsGrowth! * 100)}%`,
  );

  add(
    pct.momentum12m1m,
    "momentum",
    () => `Strong momentum: up ${fmt(s.momentum12m1m! * 100, 0)}% over the past year`,
    () =>
      s.momentum12m1m! < 0
        ? `Negative momentum: down ${fmt(Math.abs(s.momentum12m1m!) * 100, 0)}% over the past year`
        : `Lagging the market: up only ${fmt(s.momentum12m1m! * 100, 0)}% over the past year`,
  );

  // Strengths first, most extreme first within each group.
  return bullets.sort((a, b) => {
    if (a.sentiment !== b.sentiment) return a.sentiment === "strength" ? -1 : 1;
    return b.weight - a.weight;
  });
}
