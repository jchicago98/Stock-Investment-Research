// Raw per-stock inputs the scoring engine consumes. All metrics nullable —
// free data sources have gaps, and the scorer must tolerate them.
export interface StockFundamentals {
  ticker: string;
  name: string;
  sector?: string;
  price?: number;
  marketCap?: number;
  trailingPE?: number;
  priceToFcf?: number;
  evToEbitda?: number;
  returnOnEquity?: number;
  operatingMargin?: number;
  debtToEquity?: number;
  freeCashflow?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  momentum12m1m?: number;
}

export interface Quote {
  ticker: string;
  name?: string;
  price?: number;
  changePercent?: number;
}

export interface PricePoint {
  date: string; // ISO yyyy-mm-dd
  close: number;
}

// Abstraction over the market-data source (currently yahoo-finance2) so the
// backing API can be swapped without touching the scoring engine or UI.
export interface MarketDataProvider {
  getFundamentals(ticker: string): Promise<Partial<StockFundamentals>>;
  getQuotes(tickers: string[]): Promise<Quote[]>;
  getDailyHistory(ticker: string, days: number): Promise<PricePoint[]>;
}
