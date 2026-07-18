// S&P 500 constituents from the maintained public dataset on GitHub
// (https://github.com/datasets/s-and-p-500-companies), with a small embedded
// fallback so the app still works offline / if the URL moves.

export interface UniverseStock {
  ticker: string; // Yahoo-style symbol (BRK-B, not BRK.B)
  name: string;
  sector: string;
  subIndustry?: string;
}

const CONSTITUENTS_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

// Minimal CSV line parser handling quoted fields with embedded commas.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function toYahooSymbol(symbol: string): string {
  return symbol.trim().replace(/\./g, "-");
}

export function parseConstituentsCsv(csv: string): UniverseStock[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    symbol: header.indexOf("symbol"),
    name: header.indexOf("security"),
    sector: header.indexOf("gics sector"),
    subIndustry: header.indexOf("gics sub-industry"),
  };
  if (idx.symbol < 0 || idx.name < 0) {
    throw new Error("Unexpected constituents CSV format");
  }
  return lines.slice(1).map((line) => {
    const f = parseCsvLine(line);
    return {
      ticker: toYahooSymbol(f[idx.symbol]),
      name: f[idx.name]?.trim() ?? "",
      sector: idx.sector >= 0 ? (f[idx.sector]?.trim() || "Unknown") : "Unknown",
      subIndustry: idx.subIndustry >= 0 ? f[idx.subIndustry]?.trim() : undefined,
    };
  });
}

const FALLBACK_UNIVERSE: UniverseStock[] = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Information Technology" },
  { ticker: "MSFT", name: "Microsoft", sector: "Information Technology" },
  { ticker: "NVDA", name: "NVIDIA", sector: "Information Technology" },
  { ticker: "AMZN", name: "Amazon", sector: "Consumer Discretionary" },
  { ticker: "GOOGL", name: "Alphabet (Class A)", sector: "Communication Services" },
  { ticker: "META", name: "Meta Platforms", sector: "Communication Services" },
  { ticker: "BRK-B", name: "Berkshire Hathaway", sector: "Financials" },
  { ticker: "LLY", name: "Eli Lilly", sector: "Health Care" },
  { ticker: "AVGO", name: "Broadcom", sector: "Information Technology" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { ticker: "V", name: "Visa", sector: "Financials" },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Health Care" },
  { ticker: "MA", name: "Mastercard", sector: "Financials" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer Staples" },
  { ticker: "HD", name: "Home Depot", sector: "Consumer Discretionary" },
  { ticker: "COST", name: "Costco", sector: "Consumer Staples" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care" },
  { ticker: "WMT", name: "Walmart", sector: "Consumer Staples" },
  { ticker: "KO", name: "Coca-Cola", sector: "Consumer Staples" },
];

export async function fetchUniverse(): Promise<{
  stocks: UniverseStock[];
  source: "remote" | "fallback";
}> {
  try {
    const res = await fetch(CONSTITUENTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const stocks = parseConstituentsCsv(csv);
    if (stocks.length < 400) {
      throw new Error(`Suspiciously small universe: ${stocks.length}`);
    }
    return { stocks, source: "remote" };
  } catch (err) {
    console.warn(
      `Universe fetch failed (${err instanceof Error ? err.message : err}); using embedded fallback list.`,
    );
    return { stocks: FALLBACK_UNIVERSE, source: "fallback" };
  }
}
