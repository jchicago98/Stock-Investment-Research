// Optional House (and extra Senate) coverage via Financial Modeling Prep.
// Only used when FMP_API_KEY is set — free key from financialmodelingprep.com.
import { toYahooSymbol } from "../universe";
import { normalizeTxType, parseAmountMin } from "./efd";
import type { CongressTransaction } from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

interface FmpTrade {
  symbol?: string;
  disclosureDate?: string;
  transactionDate?: string;
  firstName?: string;
  lastName?: string;
  office?: string;
  district?: string;
  owner?: string;
  assetDescription?: string;
  type?: string;
  amount?: string;
  link?: string;
}

export async function fetchFmpTrades(
  chamber: "house" | "senate",
  since: Date,
  apiKey: string,
): Promise<CongressTransaction[]> {
  const sinceIso = since.toISOString().slice(0, 10);
  const out: CongressTransaction[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://financialmodelingprep.com/stable/${chamber}-latest?page=${page}&limit=${PAGE_SIZE}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ! FMP ${chamber} page ${page} returned ${res.status}`);
      break;
    }
    const trades = (await res.json()) as FmpTrade[];
    if (!Array.isArray(trades) || trades.length === 0) break;

    let reachedOld = false;
    for (const t of trades) {
      const disclosure = t.disclosureDate?.slice(0, 10);
      if (disclosure && disclosure < sinceIso) {
        reachedOld = true;
        continue;
      }
      const politician =
        [t.firstName, t.lastName].filter(Boolean).join(" ") || t.office || "Unknown";
      out.push({
        chamber,
        politician,
        state: t.district?.slice(0, 2) || undefined,
        ticker: t.symbol ? toYahooSymbol(t.symbol.toUpperCase()) : undefined,
        assetDescription: t.assetDescription || undefined,
        txType: normalizeTxType(t.type ?? ""),
        amountRange: t.amount || undefined,
        amountMin: parseAmountMin(t.amount),
        transactionDate: t.transactionDate?.slice(0, 10),
        disclosureDate: disclosure,
        sourceKey: `fmp:${chamber}:${politician}:${t.symbol}:${t.transactionDate}:${t.type}:${t.amount}`,
      });
    }
    if (reachedOld || trades.length < PAGE_SIZE) break;
  }
  return out;
}
