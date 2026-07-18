import YahooFinance from "yahoo-finance2";
import type {
  MarketDataProvider,
  PricePoint,
  Quote,
  StockFundamentals,
} from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Minimal shapes for the fields we read; validation is disabled so the
// library types results as `unknown`.
interface YfQuoteSummary {
  price?: {
    shortName?: string;
    longName?: string;
    regularMarketPrice?: number;
    marketCap?: number;
  };
  summaryDetail?: { marketCap?: number; trailingPE?: number };
  financialData?: {
    returnOnEquity?: number;
    operatingMargins?: number;
    debtToEquity?: number;
    freeCashflow?: number;
    revenueGrowth?: number;
    earningsGrowth?: number;
    totalDebt?: number;
    totalCash?: number;
  };
  defaultKeyStatistics?: {
    enterpriseToEbitda?: number;
    enterpriseValue?: number;
  };
}

interface YfChartQuote {
  date: string | Date;
  close?: number | null;
  adjclose?: number | null;
}

interface YfChart {
  quotes?: YfChartQuote[];
}

interface YfQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export class YahooProvider implements MarketDataProvider {
  async getFundamentals(ticker: string): Promise<Partial<StockFundamentals>> {
    const summary = await yf.quoteSummary(
      ticker,
      {
        modules: [
          "price",
          "summaryDetail",
          "financialData",
          "defaultKeyStatistics",
        ],
      },
      { validateResult: false },
    ) as YfQuoteSummary;

    const price = summary.price;
    const detail = summary.summaryDetail;
    const fin = summary.financialData;
    const stats = summary.defaultKeyStatistics;

    // Yahoo omits marketCap entirely for some tickers. Recover it from the
    // enterprise-value identity (EV = mktCap + debt − cash), then fall back
    // to the quote endpoint.
    let marketCap = detail?.marketCap ?? price?.marketCap;
    if (marketCap == null) {
      const ev = stats?.enterpriseValue;
      if (ev != null && fin?.totalDebt != null && fin?.totalCash != null) {
        const derived = ev - fin.totalDebt + fin.totalCash;
        if (derived > 0) marketCap = derived;
      }
    }
    if (marketCap == null) {
      try {
        const q = (await yf.quote(
          ticker,
          {},
          { validateResult: false },
        )) as YfQuote;
        marketCap = q.marketCap;
      } catch {
        // leave undefined; scorer tolerates the gap
      }
    }
    const freeCashflow = fin?.freeCashflow;
    const priceToFcf =
      marketCap && freeCashflow && freeCashflow > 0
        ? marketCap / freeCashflow
        : undefined;

    const momentum12m1m = await this.getMomentum(ticker);

    return {
      ticker,
      name: price?.shortName ?? price?.longName,
      price: price?.regularMarketPrice,
      marketCap,
      trailingPE: detail?.trailingPE,
      priceToFcf,
      evToEbitda: stats?.enterpriseToEbitda,
      returnOnEquity: fin?.returnOnEquity,
      operatingMargin: fin?.operatingMargins,
      debtToEquity: fin?.debtToEquity,
      freeCashflow,
      revenueGrowth: fin?.revenueGrowth,
      earningsGrowth: fin?.earningsGrowth,
      momentum12m1m,
    };
  }

  // 12-month price return excluding the most recent month.
  private async getMomentum(ticker: string): Promise<number | undefined> {
    try {
      const result = await yf.chart(
        ticker,
        { period1: monthsAgo(13), interval: "1mo" },
        { validateResult: false },
      ) as YfChart;
      const closes = (result.quotes ?? [])
        .map((q) => q.adjclose ?? q.close)
        .filter((c): c is number => typeof c === "number");
      if (closes.length < 3) return undefined;
      const start = closes[0];
      // Second-to-last bar ≈ one month ago (last bar is the current month).
      const end = closes[closes.length - 2];
      if (!start || start <= 0) return undefined;
      return end / start - 1;
    } catch {
      return undefined;
    }
  }

  async getQuotes(tickers: string[]): Promise<Quote[]> {
    const results = (await yf.quote(tickers, {}, { validateResult: false })) as
      | YfQuote
      | YfQuote[];
    const arr = Array.isArray(results) ? results : [results];
    return arr.map((q) => ({
      ticker: q.symbol,
      name: q.shortName ?? q.longName,
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent,
    }));
  }

  async getDailyHistory(ticker: string, days: number): Promise<PricePoint[]> {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await yf.chart(
      ticker,
      { period1, interval: "1d" },
      { validateResult: false },
    ) as YfChart;
    return (result.quotes ?? [])
      .filter((q) => typeof q.close === "number")
      .map((q) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: q.close as number,
      }));
  }
}

export const marketData: MarketDataProvider = new YahooProvider();
