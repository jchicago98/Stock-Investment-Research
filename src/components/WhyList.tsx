import type { WhyBullet } from "@/lib/scoring/why";

export function WhyList({ bullets, max }: { bullets: WhyBullet[]; max?: number }) {
  const shown = max ? bullets.slice(0, max) : bullets;
  if (shown.length === 0) {
    return <p className="text-sm text-zinc-500">No standout metrics either way.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {shown.map((b, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className={
              b.sentiment === "strength"
                ? "mt-0.5 text-emerald-400"
                : "mt-0.5 text-red-400"
            }
          >
            {b.sentiment === "strength" ? "▲" : "▼"}
          </span>
          <span className="text-zinc-300">{b.text}</span>
        </li>
      ))}
    </ul>
  );
}
