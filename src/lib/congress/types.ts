export interface CongressTransaction {
  chamber: "house" | "senate";
  politician: string;
  party?: string;
  state?: string;
  ticker?: string;
  assetDescription?: string;
  txType: "buy" | "sell" | "exchange" | "other";
  amountRange?: string;
  amountMin?: number;
  transactionDate?: string; // ISO yyyy-mm-dd
  disclosureDate?: string; // ISO yyyy-mm-dd
  sourceKey: string; // unique per transaction row, for dedupe on re-ingest
}
