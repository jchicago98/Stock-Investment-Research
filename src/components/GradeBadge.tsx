const gradeStyles: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  B: "bg-lime-500/15 text-lime-400 border-lime-500/40",
  C: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  D: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  F: "bg-red-500/15 text-red-400 border-red-500/40",
  "N/A": "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
};

export function GradeBadge({ grade, size = "md" }: { grade: string; size?: "md" | "lg" }) {
  const style = gradeStyles[grade] ?? gradeStyles["N/A"];
  const sizeCls =
    size === "lg" ? "h-12 w-12 text-2xl" : "h-8 w-8 text-sm";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border font-bold ${sizeCls} ${style}`}
      title={grade === "N/A" ? "Not enough data to grade" : `Grade ${grade}`}
    >
      {grade}
    </span>
  );
}
