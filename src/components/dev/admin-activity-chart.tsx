"use client";

import { useMemo, useState } from "react";
import {
  layoutAdminActivityChart,
  type RlsActivityDailyPoint,
} from "@/lib/admin-rls-activity";

export function AdminActivityChart({ daily }: { daily: RlsActivityDailyPoint[] }) {
  const layout = useMemo(() => layoutAdminActivityChart(daily), [daily]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hover = hoverIndex == null ? null : layout.points[hoverIndex] ?? null;
  const bottom = layout.pad.t + layout.innerH;

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">작성 시계열 (KST)</h3>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#d4a843]" />
          작성
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-zinc-500" />
          작성 횟수
        </span>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full"
        role="img"
        aria-label="일별 작성 시계열"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const svg = event.currentTarget;
          const rect = svg.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * layout.width;
          if (layout.points.length === 0) return;
          let best = 0;
          let bestDist = Number.POSITIVE_INFINITY;
          for (const [index, point] of layout.points.entries()) {
            const dist = Math.abs(point.x - x);
            if (dist < bestDist) {
              bestDist = dist;
              best = index;
            }
          }
          setHoverIndex(best);
        }}
      >
        <line
          x1={layout.pad.l}
          x2={layout.pad.l + layout.innerW}
          y1={bottom}
          y2={bottom}
          className="stroke-border"
          strokeWidth="1"
        />
        <path
          d={layout.writesPath}
          fill="none"
          stroke="#71717a"
          strokeWidth="1.5"
        />
        <path
          d={layout.usersPath}
          fill="none"
          stroke="#d4a843"
          strokeWidth="2"
        />
        {hover && (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={layout.pad.t}
              y2={bottom}
              className="stroke-white/30"
              strokeWidth="1"
            />
            <circle cx={hover.x} cy={hover.yUsers} r="3.5" fill="#d4a843" />
            <circle cx={hover.x} cy={hover.yWrites} r="3" fill="#71717a" />
          </g>
        )}
        {layout.xTicks.map((tick) => (
          <text
            key={tick.day}
            x={tick.x}
            y={layout.height - 10}
            textAnchor="middle"
            className="fill-zinc-500"
            fontSize="9"
          >
            {tick.label}
          </text>
        ))}
        <text
          x={layout.pad.l}
          y={layout.pad.t - 4}
          className="fill-zinc-500"
          fontSize="9"
        >
          작성 {layout.maxUsers}
        </text>
        <text
          x={layout.pad.l + layout.innerW}
          y={layout.pad.t - 4}
          textAnchor="end"
          className="fill-zinc-500"
          fontSize="9"
        >
          작성 횟수 {layout.maxWrites}
        </text>
      </svg>
      {hover && (
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          {hover.day}
          {" · "}
          작성 {hover.users.toLocaleString("ko-KR")}
          {" · "}
          신규 {hover.newUsers.toLocaleString("ko-KR")}
          {" · "}
          작성 횟수 {hover.writes.toLocaleString("ko-KR")}
        </p>
      )}
    </div>
  );
}
