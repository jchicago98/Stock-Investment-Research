import { describe, expect, it } from "vitest";
import {
  gradeFor,
  percentileRanks,
  scoreUniverse,
} from "./factors";
import { generateWhyBullets, median, universeMedians } from "./why";

describe("percentileRanks", () => {
  it("ranks higher-is-better values 0..100", () => {
    expect(percentileRanks([10, 20, 30], "higher")).toEqual([0, 50, 100]);
  });

  it("inverts for lower-is-better metrics", () => {
    expect(percentileRanks([10, 20, 30], "lower")).toEqual([100, 50, 0]);
  });

  it("leaves nulls as null without affecting others", () => {
    expect(percentileRanks([10, null, 30], "higher")).toEqual([0, null, 100]);
  });

  it("averages ranks for ties", () => {
    const [a, b, c] = percentileRanks([5, 5, 10], "higher");
    expect(a).toBe(b);
    expect(a).toBe(25);
    expect(c).toBe(100);
  });

  it("gives a lone value the neutral 50", () => {
    expect(percentileRanks([42, null], "higher")).toEqual([50, null]);
  });
});

describe("gradeFor", () => {
  it("maps composite scores to letter grades", () => {
    expect(gradeFor(85)).toBe("A");
    expect(gradeFor(70)).toBe("B");
    expect(gradeFor(55)).toBe("C");
    expect(gradeFor(40)).toBe("D");
    expect(gradeFor(10)).toBe("F");
  });
});

describe("scoreUniverse", () => {
  const cheapQuality = {
    ticker: "GOOD",
    name: "Good Co",
    trailingPE: 10,
    priceToFcf: 12,
    evToEbitda: 8,
    returnOnEquity: 0.35,
    operatingMargin: 0.3,
    debtToEquity: 20,
    revenueGrowth: 0.2,
    earningsGrowth: 0.25,
    momentum12m1m: 0.3,
  };
  const expensiveWeak = {
    ticker: "BAD",
    name: "Bad Co",
    trailingPE: 60,
    priceToFcf: 80,
    evToEbitda: 40,
    returnOnEquity: 0.02,
    operatingMargin: 0.03,
    debtToEquity: 250,
    revenueGrowth: -0.05,
    earningsGrowth: -0.1,
    momentum12m1m: -0.2,
  };
  const middling = {
    ticker: "MID",
    name: "Mid Co",
    trailingPE: 25,
    priceToFcf: 30,
    evToEbitda: 15,
    returnOnEquity: 0.15,
    operatingMargin: 0.15,
    debtToEquity: 100,
    revenueGrowth: 0.05,
    earningsGrowth: 0.05,
    momentum12m1m: 0.08,
  };

  it("ranks the cheap quality stock above the expensive weak one", () => {
    const scored = scoreUniverse([cheapQuality, expensiveWeak, middling]);
    const byTicker = Object.fromEntries(scored.map((s) => [s.ticker, s]));
    expect(byTicker.GOOD.composite).toBeGreaterThan(byTicker.MID.composite);
    expect(byTicker.MID.composite).toBeGreaterThan(byTicker.BAD.composite);
    expect(byTicker.GOOD.grade).toBe("A");
    expect(byTicker.BAD.grade).toBe("F");
  });

  it("treats negative P/E as missing rather than cheap", () => {
    const unprofitable = { ...middling, ticker: "LOSS", trailingPE: -5 };
    const scored = scoreUniverse([cheapQuality, expensiveWeak, unprofitable]);
    const loss = scored.find((s) => s.ticker === "LOSS")!;
    expect(loss.metricPercentiles.trailingPE).toBeUndefined();
  });

  it("flags stocks with too little data instead of grading them", () => {
    const sparse = { ticker: "SPARSE", name: "Sparse", trailingPE: 15 };
    const scored = scoreUniverse([cheapQuality, expensiveWeak, sparse]);
    const s = scored.find((x) => x.ticker === "SPARSE")!;
    expect(s.lowData).toBe(true);
    expect(s.grade).toBe("N/A");
  });

  it("renormalizes weights when a whole factor is missing", () => {
    const noMomentum = { ...cheapQuality, momentum12m1m: undefined };
    const scored = scoreUniverse([noMomentum, expensiveWeak, middling]);
    const s = scored.find((x) => x.ticker === "GOOD")!;
    expect(s.factors.momentum).toBeUndefined();
    // Still the best of the three on every remaining factor.
    expect(s.composite).toBeGreaterThan(90);
  });
});

describe("median / universeMedians", () => {
  it("computes medians ignoring nulls", () => {
    expect(median([1, null, 3, undefined, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});

describe("generateWhyBullets", () => {
  const stock = {
    ticker: "GOOD",
    name: "Good Co",
    trailingPE: 10,
    returnOnEquity: 0.35,
    revenueGrowth: -0.08,
  };
  const medians = { trailingPE: 21 };

  it("produces strengths for high percentiles and concerns for low ones", () => {
    const bullets = generateWhyBullets(
      stock,
      { trailingPE: 90, returnOnEquity: 95, revenueGrowth: 10 },
      medians,
    );
    const texts = bullets.map((b) => b.text);
    expect(texts.some((t) => t.includes("10× earnings"))).toBe(true);
    expect(texts.some((t) => t.includes("median 21×"))).toBe(true);
    expect(texts.some((t) => t.includes("Return on equity of 35%"))).toBe(true);
    expect(texts.some((t) => t.includes("Revenue shrinking 8%"))).toBe(true);
  });

  it("puts strengths before concerns", () => {
    const bullets = generateWhyBullets(
      stock,
      { trailingPE: 90, revenueGrowth: 5 },
      medians,
    );
    expect(bullets[0].sentiment).toBe("strength");
    expect(bullets[bullets.length - 1].sentiment).toBe("concern");
  });

  it("skips middling metrics entirely", () => {
    const bullets = generateWhyBullets(stock, { trailingPE: 50 }, medians);
    expect(bullets).toHaveLength(0);
  });

  it("universeMedians only considers valid positive multiples", () => {
    const m = universeMedians([
      { trailingPE: 10 },
      { trailingPE: -4 },
      { trailingPE: 30 },
    ]);
    expect(m.trailingPE).toBe(20);
  });
});
