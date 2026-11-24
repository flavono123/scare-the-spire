"use client";

import { useState } from "react";

export type GlyphRow = {
  id: string;
  labelKo: string;
  noteKo: string;
  sourceText: string;
  real: string[];
  /** Parallel real writing system of the family (structure, not letter shapes). */
  parallel: string;
  familyNoteKo: string;
  /** Filterable labels, keyed by axis id. */
  labels: Record<string, string[]>;
};

export type GlyphAxis = { id: string; titleKo: string; noteKo: string };

// "Same script" is the axis the catalogue exists for, so its chips are coloured.
const CLUSTER_TONE: [string, string][] = [
  ["도형 문자", "border-amber-400/60 bg-amber-400/15 text-amber-200"],
  ["지식의 악마 문자", "border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-200"],
  ["붓점", "border-sky-400/60 bg-sky-400/15 text-sky-200"],
  ["각진 블록", "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"],
  ["각진 미로", "border-orange-400/60 bg-orange-400/15 text-orange-200"],
];
const tone = (value: string) => CLUSTER_TONE.find(([prefix]) => value.startsWith(prefix))?.[1] ?? "border-border bg-background/60";

export function SpireGlyphsList({ rows, axes }: { rows: GlyphRow[]; axes: GlyphAxis[] }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [imagesOnly, setImagesOnly] = useState(false);

  // Values within one axis are alternatives; axes narrow each other.
  const matches = (row: GlyphRow, skipAxis?: string) =>
    axes.every((axis) => axis.id === skipAxis || !picked[axis.id]?.length || picked[axis.id].some((value) => row.labels[axis.id].includes(value)));
  const shown = rows.filter((row) => matches(row));
  const toggle = (axis: string, value: string) =>
    setPicked((current) => {
      const values = current[axis] ?? [];
      return { ...current, [axis]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value] };
    });

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">
          그림 {shown.length} / {rows.length}
        </h2>
        <button type="button" onClick={() => setImagesOnly((value) => !value)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
          {imagesOnly ? "레이블과 함께 보기" : "그림만 모아 보기"}
        </button>
        <button type="button" onClick={() => setPicked({})} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
          필터 지우기
        </button>
      </div>
      <dl className="mt-3 space-y-2">
        {axes.map((axis) => {
          // Counts follow the other axes' filters, so a chip shows what picking it would leave.
          const pool = rows.filter((row) => matches(row, axis.id));
          const values = [...new Set(rows.flatMap((row) => row.labels[axis.id]))];
          return (
            <div key={axis.id} className="grid gap-1 md:grid-cols-[10rem_1fr]">
              <dt className="text-xs font-semibold" title={axis.noteKo}>
                {axis.titleKo}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {values.map((value) => {
                  const on = picked[axis.id]?.includes(value);
                  const count = pool.filter((row) => row.labels[axis.id].includes(value)).length;
                  if (!count && !on) return null;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(axis.id, value)}
                      className={`rounded border px-2 py-0.5 text-xs ${axis.id === "cluster" ? tone(value) : "border-border bg-background/60"} ${on ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
                    >
                      {value} <span className="text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </dd>
            </div>
          );
        })}
      </dl>
      {imagesOnly ? (
        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {shown.map((row) => (
            <li key={row.id} className="rounded-md border border-border bg-[#18181e] p-1.5">
              <Thumb row={row} className="h-28" />
              <div className="mt-1 truncate text-[11px]" title={row.labelKo}>
                {row.labelKo}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-md border border-border">
          {shown.map((row) => (
            <li key={row.id} className="grid gap-3 p-3 md:grid-cols-[11rem_1fr]">
              <Thumb row={row} className="h-40 rounded bg-[#18181e]" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{row.labelKo}</div>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {axes.flatMap((axis) =>
                    row.labels[axis.id].map((value) => (
                      <li key={`${axis.id}-${value}`} className={`rounded border px-1.5 py-0.5 text-[11px] ${axis.id === "cluster" ? tone(value) : "border-border bg-background/60"}`}>
                        <span className="text-muted-foreground">{axis.titleKo}</span> {value}
                      </li>
                    )),
                  )}
                </ul>
                <div className="mt-2 text-xs">
                  <span className="font-semibold">닮은 실제 글자</span>
                  {row.real.length ? (
                    <ul className="mt-0.5 list-disc pl-5 leading-relaxed text-muted-foreground">
                      {row.real.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground"> 없음</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">짜임이 닮은 문자 체계</span> {row.parallel}
                </p>
                {row.noteKo && <p className="mt-1 text-xs leading-relaxed">{row.noteKo}</p>}
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">계열 설명</summary>
                  <p className="mt-1 leading-relaxed">{row.familyNoteKo}</p>
                </details>
                <code className="mt-1 block break-all text-[10px] text-muted-foreground/80">{row.sourceText}</code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thumb({ row, className }: { row: GlyphRow; className: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dev-only image served from data/dev */}
      <img src={`/api/dev/spire-glyphs/${row.id}.webp`} alt={row.labelKo} loading="lazy" className="max-h-full max-w-full object-contain" />
    </div>
  );
}
