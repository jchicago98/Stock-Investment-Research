// Scraper for the official US Senate financial disclosure site (eFD).
// Public STOCK Act data; electronic Periodic Transaction Reports only
// (paper filings are scanned PDFs and are skipped).
import { toYahooSymbol } from "../universe";
import type { CongressTransaction } from "./types";

const BASE = "https://efdsearch.senate.gov";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) personal-research-tool";

class CookieJar {
  private cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  get(name: string) {
    return this.cookies.get(name);
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function usDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function toIso(us: string | undefined): string | undefined {
  const m = us?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : undefined;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTxType(raw: string): CongressTransaction["txType"] {
  const t = raw.toLowerCase();
  if (t.includes("purchase")) return "buy";
  if (t.includes("sale")) return "sell";
  if (t.includes("exchange")) return "exchange";
  return "other";
}

export function parseAmountMin(range: string | undefined): number | undefined {
  const m = range?.replace(/,/g, "").match(/\$(\d+)/);
  return m ? Number(m[1]) : undefined;
}

interface PtrListing {
  name: string;
  href: string;
  filedDate: string; // ISO
  isPaper: boolean;
}

export interface EfdScrapeResult {
  transactions: CongressTransaction[];
  filingsSeen: number;
  paperSkipped: number;
}

async function authorize(jar: CookieJar): Promise<string> {
  const r1 = await fetch(`${BASE}/search/home/`, { headers: { "User-Agent": UA } });
  jar.absorb(r1);
  const html = await r1.text();
  const token = html.match(/name="csrfmiddlewaretoken" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("eFD: no CSRF token on landing page");

  const r2 = await fetch(`${BASE}/search/home/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/search/home/`,
    },
    body: new URLSearchParams({
      prohibition_agreement: "1",
      csrfmiddlewaretoken: token,
    }),
    redirect: "manual",
  });
  jar.absorb(r2);
  if (r2.status !== 302) throw new Error(`eFD: agreement POST returned ${r2.status}`);
  return jar.get("csrftoken") ?? token;
}

async function listPtrFilings(
  jar: CookieJar,
  csrf: string,
  since: Date,
): Promise<PtrListing[]> {
  const filings: PtrListing[] = [];
  const pageSize = 100;
  for (let start = 0; ; start += pageSize) {
    const res = await fetch(`${BASE}/search/report/data/`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.header(),
        Referer: `${BASE}/search/`,
        "X-CSRFToken": csrf,
      },
      body: new URLSearchParams({
        start: String(start),
        length: String(pageSize),
        report_types: "[11]", // Periodic Transaction Report
        filer_types: "[]",
        submitted_start_date: `${usDate(since)} 00:00:00`,
        submitted_end_date: "",
        candidate_state: "",
        senator_state: "",
        office_id: "",
        first_name: "",
        last_name: "",
        csrfmiddlewaretoken: csrf,
      }),
    });
    if (!res.ok) throw new Error(`eFD: filings query returned ${res.status}`);
    const json = (await res.json()) as { recordsTotal: number; data: string[][] };
    for (const row of json.data ?? []) {
      const nameCell = row[2] ?? `${row[0]} ${row[1]}`;
      const linkCell = row[3] ?? "";
      const href = linkCell.match(/href="([^"]+)"/)?.[1] ?? "";
      filings.push({
        name: stripTags(nameCell).replace(/\s*\(Senator\)\s*/i, ""),
        href,
        filedDate: toIso(row[4]) ?? "",
        isPaper: !href.includes("/search/view/ptr/"),
      });
    }
    if (start + pageSize >= (json.recordsTotal ?? 0)) break;
    await sleep(300);
  }
  return filings;
}

function parsePtrHtml(
  html: string,
  filing: PtrListing,
): CongressTransaction[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (!tbody) return [];
  const uuid = filing.href.match(/ptr\/([0-9a-f-]+)/)?.[1] ?? filing.href;
  const txs: CongressTransaction[] = [];

  for (const trMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      stripTags(m[1]),
    );
    // Columns: #, Transaction Date, Owner, Ticker, Asset Name, Asset Type, Type, Amount, Comment
    if (cells.length < 8) continue;
    const [rowNum, txDate, , ticker, assetName, assetType, txType, amount] = cells;
    txs.push({
      chamber: "senate",
      politician: filing.name,
      ticker:
        ticker && ticker !== "--"
          ? toYahooSymbol(ticker.toUpperCase())
          : undefined,
      assetDescription: assetName || assetType || undefined,
      txType: normalizeTxType(txType ?? ""),
      amountRange: amount || undefined,
      amountMin: parseAmountMin(amount),
      transactionDate: toIso(txDate),
      disclosureDate: filing.filedDate || undefined,
      sourceKey: `efd:${uuid}:${rowNum}`,
    });
  }
  return txs;
}

export async function scrapeSenateEfd(since: Date): Promise<EfdScrapeResult> {
  const jar = new CookieJar();
  const csrf = await authorize(jar);
  const filings = await listPtrFilings(jar, csrf, since);
  const electronic = filings.filter((f) => !f.isPaper && f.href);

  const transactions: CongressTransaction[] = [];
  for (const filing of electronic) {
    try {
      const res = await fetch(`${BASE}${filing.href}`, {
        headers: {
          "User-Agent": UA,
          Cookie: jar.header(),
          Referer: `${BASE}/search/`,
        },
      });
      if (!res.ok) {
        console.warn(`  ! eFD PTR ${filing.href} returned ${res.status}`);
        continue;
      }
      transactions.push(...parsePtrHtml(await res.text(), filing));
    } catch (err) {
      console.warn(
        `  ! eFD PTR ${filing.href}: ${err instanceof Error ? err.message : err}`,
      );
    }
    await sleep(250);
  }

  return {
    transactions,
    filingsSeen: filings.length,
    paperSkipped: filings.length - electronic.length,
  };
}
