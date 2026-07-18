export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
