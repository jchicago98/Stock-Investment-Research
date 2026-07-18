export function CongressPill({
  buys,
  politicians,
}: {
  buys: number;
  politicians: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300"
      title={`${buys} congressional buy${buys === 1 ? "" : "s"} by ${politicians} member${politicians === 1 ? "" : "s"} in the last 90 days`}
    >
      🏛 {politicians === 1 ? "1 member" : `${politicians} members`} bought
    </span>
  );
}

export function PartyBadge({ party }: { party: string | null }) {
  if (!party) return <span className="text-zinc-500">—</span>;
  const cls = party.startsWith("Rep")
    ? "bg-red-500/10 text-red-400 border-red-500/30"
    : party.startsWith("Dem")
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs ${cls}`}>
      {party[0]}
    </span>
  );
}

export function TxTypeBadge({ txType }: { txType: string }) {
  const cls =
    txType === "buy"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : txType === "sell"
        ? "bg-red-500/10 text-red-400 border-red-500/30"
        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs uppercase ${cls}`}>
      {txType}
    </span>
  );
}
