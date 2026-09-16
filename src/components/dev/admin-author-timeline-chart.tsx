"use client";

import { useMemo, useState } from "react";
import type { AuthorTimeSeries } from "@/lib/admin-rls-activity";
import { cn } from "@/lib/utils";

function formatTick(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function AdminAuthorTimelineChart({
  timeSeries,
}: {
  timeSeries: AuthorTimeSeries;
}) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const highlightedUserId = hoveredUserId ?? activeUserId;

  const activeAuthor = useMemo(() => {
    if (!highlightedUserId) return null;
    return timeSeries.authors.find((a) => a.userId === highlightedUserId) ?? null;
  }, [highlightedUserId, timeSeries.authors]);

  const { days, maxTotal, totalWrites } = timeSeries;

  // Chart layout dimensions
  const width = 720;
  const height = 180;
  const pad = { l: 36, r: 24, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bottom = pad.t + innerH;

  const count = Math.max(days.length, 1);
  const colWidth = innerW / count;
  const barWidth = Math.max(3, Math.min(20, colWidth * 0.7));

  // Compute points and bars
  const bars = useMemo(() => {
    return days.map((stat, index) => {
      const centerX = pad.l + (index + 0.5) * colWidth;
      const x = centerX - barWidth / 2;

      const totalH = (stat.total / maxTotal) * innerH;
      const totalY = bottom - totalH;

      const userCount = highlightedUserId ? (stat.userCounts[highlightedUserId] ?? 0) : 0;
      const userH = (userCount / maxTotal) * innerH;
      const userY = bottom - userH;

      return {
        day: stat.day,
        total: stat.total,
        userCount,
        centerX,
        x,
        totalY,
        totalH,
        userY,
        userH,
      };
    });
  }, [days, maxTotal, innerH, bottom, pad.l, colWidth, barWidth, highlightedUserId]);

  // X ticks: limit to ~8 ticks evenly spaced
  const xTicks = useMemo(() => {
    if (bars.length === 0) return [];
    const step = Math.max(1, Math.ceil(bars.length / 8));
    return bars.flatMap((bar, index) => {
      const isEdge = index === 0 || index === bars.length - 1;
      if (!isEdge && index % step !== 0) return [];
      return [{ day: bar.day, x: bar.centerX, label: formatTick(bar.day) }];
    });
  }, [bars]);

  const hoveredBar = hoveredDayIndex != null ? bars[hoveredDayIndex] ?? null : null;

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      {/* Top Header */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">작성 시계열 (KST 일별 통계)</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            날짜별 전체 작성 추이. 태그에 마우스를 올리면 해당 작성자만 하이라이트되며, 클릭하면 고정됩니다.
          </p>
        </div>
        <div className="text-right text-xs">
          <span className="font-semibold text-primary">
            총 {totalWrites.toLocaleString("ko-KR")}건
          </span>
          <span className="text-muted-foreground"> ({days.length}일간)</span>
        </div>
      </div>

      {/* Author Filter Chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => {
            setActiveUserId(null);
            setHoveredUserId(null);
          }}
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors",
            !highlightedUserId
              ? "border-amber-400/80 bg-amber-400/20 font-semibold text-amber-200"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          전체 ({totalWrites})
        </button>

        {timeSeries.authors.map((author) => {
          const isSelected = activeUserId === author.userId;
          const isHovered = hoveredUserId === author.userId;
          const isLit = isSelected || isHovered;
          return (
            <button
              key={author.userId}
              type="button"
              onMouseEnter={() => setHoveredUserId(author.userId)}
              onMouseLeave={() => setHoveredUserId(null)}
              onClick={() => {
                setActiveUserId((prev) => (prev === author.userId ? null : author.userId));
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-all",
                isLit
                  ? "border-amber-400 bg-amber-400/25 font-semibold text-amber-100 shadow-sm shadow-amber-500/10"
                  : highlightedUserId
                    ? "border-border/40 bg-muted/20 text-muted-foreground/60 hover:border-border hover:text-foreground"
                    : "border-border/70 bg-card/60 text-zinc-300 hover:border-amber-400/50 hover:text-amber-200",
              )}
              title={`UUID: ${author.userId}`}
            >
              <span className="max-w-[7rem] truncate">{author.latestNickname}</span>
              <span className="rounded bg-black/30 px-1 py-0.2 text-[10px] tabular-nums opacity-90">
                {author.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 bg-black/20 px-2.5 py-1 text-[11px]">
        <div className="flex items-center gap-2">
          {activeAuthor ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>
                <strong>{activeAuthor.latestNickname}</strong>
                <code className="ml-1 text-[10px] text-amber-200/70">({activeAuthor.userId.slice(0, 8)})</code>
                {" · "}총 {activeAuthor.total}건 ({((activeAuthor.total / Math.max(1, totalWrites)) * 100).toFixed(1)}%)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              <span>전체 작성자 표시 중 (태그 hover 시 작성자별 분리)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-zinc-600/70" />
            전체 작성
          </span>
          {highlightedUserId && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
              선택 작성자
            </span>
          )}
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="relative overflow-hidden rounded border border-border/60 bg-black/40">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="작성자별 일별 시계열 차트"
          onMouseLeave={() => setHoveredDayIndex(null)}
          onMouseMove={(event) => {
            const svg = event.currentTarget;
            const rect = svg.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * width;
            if (bars.length === 0) return;
            let best = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            for (const [index, bar] of bars.entries()) {
              const dist = Math.abs(bar.centerX - x);
              if (dist < bestDist) {
                bestDist = dist;
                best = index;
              }
            }
            setHoveredDayIndex(best);
          }}
        >
          {/* Baseline */}
          <line
            x1={pad.l}
            x2={pad.l + innerW}
            y1={bottom}
            y2={bottom}
            stroke="#52525b"
            strokeWidth="1"
          />

          {/* Grid lines (horizontal) */}
          <line
            x1={pad.l}
            x2={pad.l + innerW}
            y1={pad.t}
            y2={pad.t}
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <line
            x1={pad.l}
            x2={pad.l + innerW}
            y1={pad.t + innerH / 2}
            y2={pad.t + innerH / 2}
            stroke="#27272a"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Day Columns */}
          {bars.map((bar, index) => {
            const isColHovered = hoveredDayIndex === index;
            return (
              <g key={bar.day}>
                {/* Hover column background highlight */}
                {isColHovered && (
                  <rect
                    x={bar.centerX - colWidth / 2}
                    y={pad.t}
                    width={colWidth}
                    height={innerH}
                    fill="rgba(255, 255, 255, 0.05)"
                  />
                )}

                {/* Total Bar (Background) */}
                {bar.totalH > 0 && (
                  <rect
                    x={bar.x}
                    y={bar.totalY}
                    width={barWidth}
                    height={bar.totalH}
                    rx="1.5"
                    fill={
                      highlightedUserId
                        ? isColHovered
                          ? "#52525b"
                          : "#3f3f46"
                        : isColHovered
                          ? "#eab308"
                          : "#ca8a04"
                    }
                    className="transition-colors duration-150"
                  />
                )}

                {/* Highlighted User Overlay Bar */}
                {highlightedUserId && bar.userH > 0 && (
                  <rect
                    x={bar.x}
                    y={bar.userY}
                    width={barWidth}
                    height={bar.userH}
                    rx="1.5"
                    fill={isColHovered ? "#fde047" : "#f59e0b"}
                    className="transition-all duration-150"
                  />
                )}
              </g>
            );
          })}

          {/* Hover indicator line & dot */}
          {hoveredBar && (
            <g>
              <line
                x1={hoveredBar.centerX}
                x2={hoveredBar.centerX}
                y1={pad.t}
                y2={bottom}
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {hoveredBar.totalH > 0 && (
                <circle
                  cx={hoveredBar.centerX}
                  cy={hoveredBar.totalY}
                  r="3"
                  fill="#fafafa"
                  stroke="#18181b"
                  strokeWidth="1"
                />
              )}
              {highlightedUserId && hoveredBar.userH > 0 && (
                <circle
                  cx={hoveredBar.centerX}
                  cy={hoveredBar.userY}
                  r="3"
                  fill="#f59e0b"
                  stroke="#18181b"
                  strokeWidth="1"
                />
              )}
            </g>
          )}

          {/* X Axis Ticks */}
          {xTicks.map((tick) => (
            <text
              key={tick.day}
              x={tick.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-zinc-400"
              fontSize="9"
              fontFamily="monospace"
            >
              {tick.label}
            </text>
          ))}

          {/* Y Axis Labels */}
          <text
            x={pad.l - 4}
            y={pad.t + 4}
            textAnchor="end"
            className="fill-zinc-500 font-mono text-[9px]"
          >
            {maxTotal}
          </text>
          <text
            x={pad.l - 4}
            y={bottom}
            textAnchor="end"
            className="fill-zinc-500 font-mono text-[9px]"
          >
            0
          </text>
        </svg>
      </div>

      {/* Hover Information Banner */}
      <div className="mt-2 min-h-6 text-[11px] tabular-nums text-zinc-300">
        {hoveredBar ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-100">{hoveredBar.day}</span>
            <span>·</span>
            <span>전체 {hoveredBar.total}건</span>
            {highlightedUserId && (
              <>
                <span>·</span>
                <span className="text-amber-300 font-medium">
                  {activeAuthor?.latestNickname ?? "선택 작성자"} {hoveredBar.userCount}건
                  {hoveredBar.total > 0 && (
                    <span className="text-[10px] text-amber-200/80 ml-1">
                      ({((hoveredBar.userCount / hoveredBar.total) * 100).toFixed(0)}%)
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-zinc-500">
            차트 위에 마우스를 올리면 해당 날짜의 작성 건수가 표시됩니다.
          </span>
        )}
      </div>
    </div>
  );
}
