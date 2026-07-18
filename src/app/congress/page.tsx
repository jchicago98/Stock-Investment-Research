import Link from "next/link";
import { PartyBadge, TxTypeBadge } from "@/components/CongressPill";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import {
  getCongressTrades,
  getKnownTickers,
  getMostActiveTraders,
  getMostBoughtByCongress,
  getRefreshInfo,
  getStock,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function filterHref(
  params: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const merged = { ...params, ...overrides };
  const qs = Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `/congress?${qs}` : "/congress";
}

export default async function CongressPage({
  searchParams,
}: {
  searchParams: Promise<{
    chamber?: string;
    type?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const chamber =
    sp.chamber === "house" || sp.chamber === "senate" ? sp.chamber : undefined;
  const txType = sp.type;
  const search = sp.search;

  const { rows: trades, total } = getCongressTrades({
    chamber,
    txType,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const mostBought = getMostBoughtByCongress();
  const mostActive = getMostActiveTraders();
  const knownTickers = getKnownTickers();
  const refresh = getRefreshInfo();
  const params = { chamber: sp.chamber, type: sp.type, search: sp.search };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0 && !chamber && !txType && !search) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Congress Trades</h1>
        <EmptyState what="congressional trades" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Congress Trades</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Public STOCK Act disclosures. Members have up to 45 days to
            disclose, so the &quot;traded&quot; and &quot;disclosed&quot; dates
            can differ substantially.
          </p>
        </div>
        {refresh.congress?.refreshedAt && (
          <p className="text-xs text-zinc-500">
            Data refreshed{" "}
            {new Date(refresh.congress.refreshedAt).toLocaleString("en-US")}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Most bought (last 90 days)
          </h2>
          {mostBought.length === 0 ? (
            <p className="text-sm text-zinc-500">No buys in window.</p>
          ) : (
            <ul className="space-y-1.5">
              {mostBought.map((r) => {
                const scored = r.ticker ? getStock(r.ticker) : undefined;
                return (
                  <li key={r.ticker} className="flex items-center justify-between text-sm">
                    <span>
                      {scored ? (
                        <Link
                          href={`/stocks/${r.ticker}`}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          {r.ticker}
                        </Link>
                      ) : (
                        <span className="font-semibold text-zinc-300">{r.ticker}</span>
                      )}
                      {scored && (
                        <span className="ml-2 text-xs text-zinc-500">
                          grade {scored.score.grade}
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-400">
                      {r.buys} buy{r.buys === 1 ? "" : "s"} · {r.politicians}{" "}
                      member{r.politicians === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Most active traders (last 90 days)
          </h2>
          {mostActive.length === 0 ? (
            <p className="text-sm text-zinc-500">No trades in window.</p>
          ) : (
            <ul className="space-y-1.5">
              {mostActive.map((r) => (
                <li key={r.politician} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-200">
                    <PartyBadge party={r.party} />
                    <Link
                      href={filterHref({}, { search: r.politician })}
                      className="hover:text-emerald-400"
                    >
                      {r.politician}
                    </Link>
                  </span>
                  <span className="text-zinc-400">
                    {r.trades} trade{r.trades === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action="/congress" className="mr-2">
          {chamber && <input type="hidden" name="chamber" value={chamber} />}
          {txType && <input type="hidden" name="type" value={txType} />}
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search politician or ticker…"
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
          />
        </form>
        {[
          { label: "All", overrides: { chamber: undefined, type: undefined, page: undefined } },
          { label: "Senate", overrides: { chamber: "senate", page: undefined } },
          { label: "House", overrides: { chamber: "house", page: undefined } },
          { label: "Buys", overrides: { type: "buy", page: undefined } },
          { label: "Sells", overrides: { type: "sell", page: undefined } },
        ].map((f) => {
          const active =
            (f.label === "Senate" && chamber === "senate") ||
            (f.label === "House" && chamber === "house") ||
            (f.label === "Buys" && txType === "buy") ||
            (f.label === "Sells" && txType === "sell") ||
            (f.label === "All" && !chamber && !txType);
          return (
            <Link
              key={f.label}
              href={filterHref(params, f.overrides)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-zinc-500">
          {total.toLocaleString("en-US")} trades
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5">Politician</th>
              <th className="px-3 py-2.5">Party</th>
              <th className="px-3 py-2.5">Chamber</th>
              <th className="px-3 py-2.5">Asset</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Amount</th>
              <th className="px-3 py-2.5">Traded</th>
              <th className="px-3 py-2.5">Disclosed</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/50">
                <td className="px-3 py-2.5 text-zinc-200">{t.politician}</td>
                <td className="px-3 py-2.5"><PartyBadge party={t.party} /></td>
                <td className="px-3 py-2.5 capitalize text-zinc-400">{t.chamber}</td>
                <td className="max-w-64 px-3 py-2.5">
                  {t.ticker ? (
                    knownTickers.has(t.ticker) ? (
                      <Link
                        href={`/stocks/${t.ticker}`}
                        className="font-semibold text-emerald-400 hover:underline"
                      >
                        {t.ticker}
                      </Link>
                    ) : (
                      <span
                        className="font-semibold text-zinc-300"
                        title="Not in the scored S&P 500 universe"
                      >
                        {t.ticker}
                      </span>
                    )
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                  <span className="ml-2 truncate text-xs text-zinc-500">
                    {t.assetDescription?.slice(0, 60)}
                  </span>
                </td>
                <td className="px-3 py-2.5"><TxTypeBadge txType={t.txType} /></td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">
                  {t.amountRange ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-zinc-400">{formatDate(t.transactionDate)}</td>
                <td className="px-3 py-2.5 text-zinc-500">{formatDate(t.disclosureDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={filterHref(params, { page: String(page - 1) })}
              className="text-emerald-400 hover:underline"
            >
              ← Newer
            </Link>
          )}
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={filterHref(params, { page: String(page + 1) })}
              className="text-emerald-400 hover:underline"
            >
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
