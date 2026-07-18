export function EmptyState({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center">
      <p className="text-lg font-medium text-zinc-200">No {what} yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
        The local database hasn&apos;t been populated. Run{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-emerald-400">
          npm run refresh-data
        </code>{" "}
        in the project folder to fetch stock fundamentals, compute scores, and
        pull congressional trades. It takes a few minutes.
      </p>
    </div>
  );
}
