import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CongressPill, TxTypeBadge, PartyBadge } from "@/components/CongressPill";
import { FactorBarsLarge } from "@/components/FactorBars";
import { GradeBadge } from "@/components/GradeBadge";
import { PriceChart } from "@/components/PriceChart";
import { WatchButton } from "@/components/WatchButton";
import { WhyList } from "@/components/WhyList";
import {
  formatDate,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
} from "@/lib/format";
import { marketData } from "@/lib/provider/yahoo";
import type { PricePoint } from "@/lib/provider/types";
import {
  getCongressBuySignals,
  getCongressTrades,
  getStock,
  getWatchlist,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// Fetched live from Yahoo, so it streams in behind a Suspense boundary
// while the rest of the page (local DB reads) renders immediately.
async function ChartSection({ ticker }: { ticker: string }) {
  let history: PricePoint[] = [];
  try {
    history = await marketData.getDailyHistory(ticker, 365);
  } catch {
    // chart shows its own empty state
  }
  return <PriceChart data={history} />;
}

function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-lg bg-zinc-800/50" />;
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const stock = getStock(ticker);
  if (!stock) notFound();

  const watched = getWatchlist().includes(ticker);
  const { rows: trades } = getCongressTrades({ ticker, limit: 25 });
  const signal = getCongressBuySignals([ticker]).get(ticker);

  const fundamentals: { label: string; value: string }[] = [
    { label: "Market cap", value: formatMarketCap(stock.marketCap) },
    { label: "P/E (trailing)", value: formatRatio(stock.trailingPE) },
    { label: "Price / FCF", value: formatRatio(stock.priceToFcf) },
    { label: "EV / EBITDA", value: formatRatio(stock.evToEbitda) },
    { label: "Return on equity", value: formatPct(stock.returnOnEquity) },
    { label: "Operating margin", value: formatPct(stock.operatingMargin) },
    {
      label: "Debt / equity",
      value: stock.debtToEquity != null ? `${stock.debtToEquity.toFixed(0)}%` : "—",
    },
    { label: "Revenue growth", value: formatPct(stock.revenueGrowth) },
    { label: "EPS growth", value: formatPct(stock.earningsGrowth) },
    { label: "12-mo momentum", value: formatPct(stock.momentum12m1m) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <GradeBadge grade={stock.score.grade} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">
              {stock.ticker}
              <span className="ml-3 text-lg font-normal text-zinc-400">
                {stock.name}
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <span>{stock.sector}</span>
              {stock.subIndustry && <span>· {stock.subIndustry}</span>}
              {signal && (
                <CongressPill buys={signal.buys} politicians={signal.politicians} />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-mono text-2xl text-white">{formatPrice(stock.price)}</p>
            <p className="text-xs text-zinc-500">
              as of {stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString("en-US") : "last refresh"}
            </p>
          </div>
          <WatchButton ticker={ticker} watched={watched} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          1-year price
        </h2>
        <Suspense fallback={<ChartSkeleton />}>
          <ChartSection ticker={ticker} />
        </Suspense>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Why this score
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            Composite {stock.score.grade === "N/A" ? "—" : Math.round(stock.score.composite)}
            /100 vs. the S&amp;P 500
          </p>
          <div className="mb-5">
            <FactorBarsLarge score={stock.score} />
          </div>
          <WhyList bullets={stock.why} />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Key fundamentals
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {fundamentals.map((f) => (
              <div key={f.label} className="flex justify-between border-b border-zinc-800/60 pb-1.5 text-sm">
                <dt className="text-zinc-400">{f.label}</dt>
                <dd className="font-mono text-zinc-200">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Congressional activity in {ticker}
          </h2>
          <Link
            href={`/congress?search=${ticker}`}
            className="text-xs text-emerald-400 hover:underline"
          >
            View all →
          </Link>
        </div>
        {trades.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No disclosed congressional trades in this stock in the tracked window.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-1.5 pr-3">Politician</th>
                <th className="py-1.5 pr-3">Party</th>
                <th className="py-1.5 pr-3">Type</th>
                <th className="py-1.5 pr-3">Amount</th>
                <th className="py-1.5 pr-3">Traded</th>
                <th className="py-1.5">Disclosed</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-200">{t.politician}</td>
                  <td className="py-2 pr-3"><PartyBadge party={t.party} /></td>
                  <td className="py-2 pr-3"><TxTypeBadge txType={t.txType} /></td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-400">
                    {t.amountRange ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{formatDate(t.transactionDate)}</td>
                  <td className="py-2 text-zinc-500">{formatDate(t.disclosureDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
