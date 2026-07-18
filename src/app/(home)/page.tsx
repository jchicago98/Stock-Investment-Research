import Link from "next/link";
import { PartyBadge, TxTypeBadge } from "@/components/CongressPill";
import { EmptyState } from "@/components/EmptyState";
import { GradeBadge } from "@/components/GradeBadge";
import { WhyList } from "@/components/WhyList";
import { formatDate, formatPrice } from "@/lib/format";
import { marketData } from "@/lib/provider/yahoo";
import type { Quote } from "@/lib/provider/types";
import {
  getCongressTrades,
  getKnownTickers,
  getMostBoughtByCongress,
  getScoredStocks,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^IXIC", label: "Nasdaq" },
];

export default async function DashboardPage() {
  let indexQuotes: Quote[] = [];
  try {
    indexQuotes = await marketData.getQuotes(INDICES.map((i) => i.symbol));
  } catch {
    // indices strip just won't render
  }

  const stocks = getScoredStocks();
  const topPicks = stocks.filter((s) => s.score.grade !== "N/A").slice(0, 5);
  const { rows: recentTrades } = getCongressTrades({ limit: 8 });
  const mostBought = getMostBoughtByCongress(90, 5);
  const knownTickers = getKnownTickers();

  if (stocks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <EmptyState what="data" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {indexQuotes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {indexQuotes.map((q) => {
            const label =
              INDICES.find((i) => i.symbol === q.ticker)?.label ?? q.ticker;
            const up = (q.changePercent ?? 0) >= 0;
            return (
              <div
                key={q.ticker}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-lg text-white">
                    {q.price?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                  <span className={`font-mono text-sm ${up ? "text-emerald-400" : "text-red-400"}`}>
                    {q.changePercent != null
                      ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%`
                      : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today&apos;s top-scored stocks</h2>
            <Link href="/picks" className="text-sm text-emerald-400 hover:underline">
              All picks →
            </Link>
          </div>
          <div className="space-y-3">
            {topPicks.map((s, i) => (
              <Link
                key={s.ticker}
                href={`/stocks/${s.ticker}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-600"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 font-mono text-sm text-zinc-500">{i + 1}</span>
                  <GradeBadge grade={s.score.grade} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-semibold text-white">{s.ticker}</span>
                      <span className="ml-2 text-sm text-zinc-400">{s.name}</span>
                    </p>
                    <p className="text-xs text-zinc-500">{s.sector}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-zinc-200">{formatPrice(s.price)}</p>
                    <p className="text-xs text-zinc-500">
                      score {Math.round(s.score.composite)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-zinc-800/60 pt-3">
                  <WhyList bullets={s.why.filter((b) => b.sentiment === "strength")} max={2} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Congress: most bought</h2>
              <Link href="/congress" className="text-sm text-emerald-400 hover:underline">
                Tracker →
              </Link>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              {mostBought.length === 0 ? (
                <p className="text-sm text-zinc-500">No buys in the last 90 days.</p>
              ) : (
                <ul className="space-y-2">
                  {mostBought.map((r) => (
                    <li key={r.ticker} className="flex justify-between text-sm">
                      {r.ticker && knownTickers.has(r.ticker) ? (
                        <Link
                          href={`/stocks/${r.ticker}`}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          {r.ticker}
                        </Link>
                      ) : (
                        <span
                          className="font-semibold text-zinc-300"
                          title="Not in the scored S&P 500 universe"
                        >
                          {r.ticker}
                        </span>
                      )}
                      <span className="text-zinc-400">
                        {r.politicians} member{r.politicians === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Latest disclosures</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <ul className="space-y-2.5">
                {recentTrades.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <PartyBadge party={t.party} />
                    <span className="min-w-0 flex-1 truncate text-zinc-300">
                      {t.politician}
                    </span>
                    <TxTypeBadge txType={t.txType} />
                    {t.ticker ? (
                      knownTickers.has(t.ticker) ? (
                        <Link
                          href={`/stocks/${t.ticker}`}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          {t.ticker}
                        </Link>
                      ) : (
                        <span className="font-semibold text-zinc-300">{t.ticker}</span>
                      )
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {formatDate(t.transactionDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
