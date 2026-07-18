import Link from "next/link";
import { FactorBars } from "@/components/FactorBars";
import { GradeBadge } from "@/components/GradeBadge";
import { WatchButton } from "@/components/WatchButton";
import { formatPrice } from "@/lib/format";
import { getStock, getWatchlist } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  const tickers = getWatchlist();
  const stocks = tickers
    .map((t) => getStock(t))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .sort((a, b) => b.score.composite - a.score.composite);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      {stocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center">
          <p className="text-lg font-medium text-zinc-200">Nothing watched yet</p>
          <p className="mt-2 text-sm text-zinc-400">
            Browse{" "}
            <Link href="/picks" className="text-emerald-400 hover:underline">
              Top Picks
            </Link>{" "}
            and hit ☆ Watch on any stock to track it here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2.5">Grade</th>
                <th className="px-3 py-2.5">Company</th>
                <th className="px-3 py-2.5 text-right">Score</th>
                <th className="px-3 py-2.5">Factors</th>
                <th className="px-3 py-2.5 text-right">Price</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.ticker} className="border-b border-zinc-800/60 hover:bg-zinc-900/50">
                  <td className="px-3 py-3">
                    <GradeBadge grade={s.score.grade} />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/stocks/${s.ticker}`} className="group">
                      <span className="font-semibold text-white group-hover:text-emerald-400">
                        {s.ticker}
                      </span>
                      <span className="ml-2 text-zinc-400">{s.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-200">
                    {s.score.grade === "N/A" ? "—" : Math.round(s.score.composite)}
                  </td>
                  <td className="px-3 py-3">
                    <FactorBars score={s.score} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-300">
                    {formatPrice(s.price)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <WatchButton ticker={s.ticker} watched />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
