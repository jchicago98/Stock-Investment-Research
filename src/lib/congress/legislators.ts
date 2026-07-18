// Party/state enrichment from the maintained public congress-legislators
// dataset (https://github.com/unitedstates/congress-legislators).

const LEGISLATORS_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";
// Former members still show up in disclosure data for months after leaving
// office, so the historical file is loaded as a fallback.
const LEGISLATORS_HISTORICAL_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-historical.json";

interface LegislatorRecord {
  name: { first: string; last: string; official_full?: string };
  terms: { type: "rep" | "sen"; party?: string; state?: string }[];
}

export interface LegislatorInfo {
  party?: string;
  state?: string;
  chamber: "house" | "senate";
}

export class LegislatorDirectory {
  // Keyed by normalized last name; small enough that scanning candidates is fine.
  private byLast = new Map<string, { first: string; info: LegislatorInfo }[]>();

  private absorb(records: LegislatorRecord[]) {
    for (const rec of records) {
      const term = rec.terms[rec.terms.length - 1];
      if (!term) continue;
      const key = rec.name.last.toLowerCase();
      const list = this.byLast.get(key) ?? [];
      list.push({
        first: rec.name.first.toLowerCase(),
        info: {
          party: term.party,
          state: term.state,
          chamber: term.type === "sen" ? "senate" : "house",
        },
      });
      this.byLast.set(key, list);
    }
  }

  static async load(): Promise<LegislatorDirectory> {
    const dir = new LegislatorDirectory();
    // Current members are absorbed first so they win ties in lookup().
    for (const url of [LEGISLATORS_URL, LEGISLATORS_HISTORICAL_URL]) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        dir.absorb((await res.json()) as LegislatorRecord[]);
      } catch (err) {
        console.warn(
          `Legislator data ${url.split("/").pop()} unavailable (${err instanceof Error ? err.message : err}); some party/state fields may be blank.`,
        );
      }
    }
    return dir;
  }

  // Accepts "Last, First", "First M Last", or "First Last", with generational
  // suffixes ("Justice II, James") tolerated in the last-name segment.
  lookup(politician: string, chamber?: "house" | "senate"): LegislatorInfo | undefined {
    const stripSuffix = (s: string) =>
      s.replace(/[,\s]+(jr|sr|ii|iii|iv)\.?\s*$/i, "").trim();
    let first = "";
    let last = "";
    if (politician.includes(",")) {
      const [l, f] = politician.split(",").map((s) => s.trim());
      last = l;
      first = f?.split(/\s+/)[0] ?? "";
      // "Justice II, James" — suffix landed in the last-name segment
      if (/^(jr|sr|ii|iii|iv)\.?$/i.test(first)) {
        first = politician.split(",")[1]?.trim().split(/\s+/)[1] ?? first;
      }
    } else {
      const cleaned = stripSuffix(politician);
      const parts = cleaned.trim().split(/\s+/);
      last = parts[parts.length - 1] ?? "";
      first = parts[0] ?? "";
    }
    last = stripSuffix(last);
    const candidates = (this.byLast.get(last.toLowerCase()) ?? []).filter(
      (c) => !chamber || c.info.chamber === chamber,
    );
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0].info;
    const exact = candidates.find((c) => c.first === first.toLowerCase());
    const initial = candidates.find((c) => c.first[0] === first.toLowerCase()[0]);
    return (exact ?? initial ?? candidates[0]).info;
  }
}
