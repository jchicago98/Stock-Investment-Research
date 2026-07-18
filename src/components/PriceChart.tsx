"use client";

import { useMemo, useRef, useState } from "react";
import type { PricePoint } from "@/lib/provider/types";

// Lightweight dependency-free SVG area chart. The path is drawn in a
// 0-100 viewBox stretched to fill the container; labels are HTML overlays
// so they don't distort.
export function PriceChart({ data }: { data: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = (max - min || max * 0.01 || 1) * 0.06;
    const lo = min - pad;
    const hi = max + pad;
    const x = (i: number) => (i / (data.length - 1)) * 100;
    const y = (c: number) => 100 - ((c - lo) / (hi - lo)) * 100;
    const line = data
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(d.close).toFixed(2)}`)
      .join("");
    const area = `${line}L100,100L0,100Z`;
    return { lo, hi, x, y, line, area };
  }, [data]);

  if (!geom || data.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Price history unavailable
      </div>
    );
  }

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const up = last >= first;
  const color = up ? "#34d399" : "#f87171";
  const gradientId = up ? "pc-up" : "pc-down";

  const fmtPrice = (v: number) =>
    `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 })}`;
  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  const fmtDateLong = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // ~5 evenly spaced x-axis labels
  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, k) =>
    Math.round((k * (data.length - 1)) / (tickCount - 1)),
  );

  const onMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIdx(Math.round(frac * (data.length - 1)));
  };

  const hover = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? geom.x(hoverIdx) : 0;

  return (
    <div className="select-none">
      <div
        ref={containerRef}
        className="relative h-64 w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={geom.area} fill={`url(#${gradientId})`} />
          <path
            d={geom.line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {hover && (
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={100}
              stroke="#71717a"
              strokeWidth={1}
              strokeDasharray="2,2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* y-axis labels */}
        <span className="absolute left-1 top-0 text-[11px] text-zinc-500">
          {fmtPrice(geom.hi)}
        </span>
        <span className="absolute bottom-0 left-1 text-[11px] text-zinc-500">
          {fmtPrice(geom.lo)}
        </span>

        {hover && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs shadow-lg"
            style={
              hoverX > 55
                ? { right: `${100 - hoverX + 2}%` }
                : { left: `${hoverX + 2}%` }
            }
          >
            <p className="text-zinc-400">{fmtDateLong(hover.date)}</p>
            <p className="font-mono text-sm text-white">
              ${hover.close.toFixed(2)}
            </p>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
        {xTicks.map((i) => (
          <span key={i}>{fmtDate(data[i].date)}</span>
        ))}
      </div>
    </div>
  );
}
