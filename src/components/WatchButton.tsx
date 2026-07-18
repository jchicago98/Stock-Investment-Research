"use client";

import { useTransition } from "react";
import { toggleWatchlist } from "@/lib/actions";

export function WatchButton({
  ticker,
  watched,
}: {
  ticker: string;
  watched: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => toggleWatchlist(ticker))}
      disabled={pending}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        watched
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
      }`}
    >
      {watched ? "★ Watching" : "☆ Watch"}
    </button>
  );
}
