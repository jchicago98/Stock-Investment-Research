import type { ScoreRow } from "@/lib/queries";

const FACTORS = [
  { key: "value", label: "Value" },
  { key: "quality", label: "Quality" },
  { key: "growth", label: "Growth" },
  { key: "momentum", label: "Momentum" },
] as const;

function barColor(v: number): string {
  if (v >= 70) return "bg-emerald-500";
  if (v >= 45) return "bg-yellow-500";
  return "bg-red-500";
}

// Compact 4-bar factor readout used in tables.
export function FactorBars({ score }: { score: ScoreRow }) {
  return (
    <div className="flex flex-col gap-0.5 w-24">
      {FACTORS.map((f) => {
        const v = score[f.key];
        return (
          <div key={f.key} className="flex items-center gap-1.5" title={`${f.label}: ${Math.round(v)}/100`}>
            <span className="w-3 text-[10px] text-zinc-500">{f.label[0]}</span>
            <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${barColor(v)}`}
                style={{ width: `${Math.max(2, v)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Full-width labeled version for the stock detail page.
export function FactorBarsLarge({ score }: { score: ScoreRow }) {
  return (
    <div className="flex flex-col gap-3">
      {FACTORS.map((f) => {
        const v = score[f.key];
        return (
          <div key={f.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-zinc-300">{f.label}</span>
              <span className="font-mono text-zinc-400">{Math.round(v)}/100</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${barColor(v)}`}
                style={{ width: `${Math.max(2, v)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
