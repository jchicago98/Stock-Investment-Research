import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { FactorBars } from "@/components/FactorBars";
import { GradeBadge } from "@/components/GradeBadge";
import { CongressPill } from "@/components/CongressPill";
import { formatMarketCap, formatPrice } from "@/lib/format";
import {
  getCongressBuySignals,
  getRefreshInfo,
  getScoredStocks,
  getSectors,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector } = await searchParams;
  const stocks = getScoredStocks({ sector });
  const sectors = getSectors();
  const refresh = getRefreshInfo();
  const congressSignals = getCongressBuySignals(stocks.map((s) => s.ticker));

  if (stocks.length === 0 && !sector) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Top Picks</h1>
        <EmptyState what="scored stocks" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Top Picks</h1>
          <p className="mt-1 text-sm text-zinc-400">
            S&amp;P 500 ranked by evidence-based factors: quality (30%), value
            (25%), growth (25%), momentum (20%). Higher percentile = better.
          </p>
        </div>
        {refresh.stocks?.refreshedAt && (
          <p className="text-xs text-zinc-500">
            Data refreshed{" "}
            {new Date(refresh.stocks.refreshedAt).toLocaleString("en-US")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/picks"
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !sector
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700 text-zinc-400 hover:text-white"
          }`}
        >
          All sectors
        </Link>
        {sectors.map((s) => (
          <Link
            key={s}
            href={`/picks?sector=${encodeURIComponent(s)}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              sector === s
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Grade</th>
              <th className="px-3 py-2.5">Company</th>
              <th className="px-3 py-2.5 text-right">Score</th>
              <th className="px-3 py-2.5">Factors</th>
              <th className="px-3 py-2.5">Why</th>
              <th className="px-3 py-2.5 text-right">Price</th>
              <th className="px-3 py-2.5 text-right">Mkt Cap</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => {
              const signal = congressSignals.get(s.ticker);
              const topWhy = s.why[0];
              return (
                <tr
                  key={s.ticker}
                  className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-3 font-mono text-zinc-500">{i + 1}</td>
                  <td className="px-3 py-3">
                    <GradeBadge grade={s.score.grade} />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/stocks/${s.ticker}`} className="group block">
                      <span className="font-semibold text-white group-hover:text-emerald-400">
                        {s.ticker}
                      </span>
                      <span className="ml-2 text-zinc-400">{s.name}</span>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                        {s.sector}
                        {signal && (
                          <CongressPill
                            buys={signal.buys}
                            politicians={signal.politicians}
                          />
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-200">
                    {s.score.grade === "N/A" ? "—" : Math.round(s.score.composite)}
                  </td>
                  <td className="px-3 py-3">
                    <FactorBars score={s.score} />
                  </td>
                  <td className="max-w-72 px-3 py-3 text-xs text-zinc-400">
                    {topWhy ? (
                      <span>
                        <span
                          className={
                            topWhy.sentiment === "strength"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {topWhy.sentiment === "strength" ? "▲ " : "▼ "}
                        </span>
                        {topWhy.text}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-300">
                    {formatPrice(s.price)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-400">
                    {formatMarketCap(s.marketCap)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
