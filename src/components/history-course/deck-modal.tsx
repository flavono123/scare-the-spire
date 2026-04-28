"use client";

import { useEffect, useMemo, useState } from "react";
import { CardTile } from "@/components/codex/card-tile";
import type { CodexCard } from "@/lib/codex-types";
import { localize } from "@/lib/sts2-i18n";
import { cn } from "@/lib/utils";

const TYPE_FILTERS = [
  { key: "all", label: "전체" },
  { key: "공격", label: "공격" },
  { key: "스킬", label: "스킬" },
  { key: "파워", label: "파워" },
  { key: "저주", label: "저주" },
  { key: "상태이상", label: "상태" },
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number]["key"];

interface DeckModalProps {
  open: boolean;
  onClose: () => void;
  deck: { id: string; count: number; upgradeCount: number; firstFloor: number }[];
  cardsById: Record<string, CodexCard>;
  currentFloor: number;
}

export function DeckModal({
  open,
  onClose,
  deck,
  cardsById,
  currentFloor,
}: DeckModalProps) {
  const [filter, setFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset the filter the moment `open` flips from false → true. React 19's
  // set-state-in-effect rule pushes us toward this conditional-render pattern
  // instead of a useEffect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFilter("all");
  }

  const expanded = useMemo(() => {
    const items: {
      card: CodexCard | null;
      id: string;
      key: string;
      upgraded: boolean;
      firstFloor: number;
    }[] = [];
    for (const entry of deck) {
      const card = cardsById[entry.id] ?? null;
      // Upgraded copies render first inside this id group so the deck looks
      // organized when sort order keeps them adjacent.
      for (let i = 0; i < entry.count; i++) {
        items.push({
          card,
          id: entry.id,
          key: `${entry.id}-${i}`,
          upgraded: i < entry.upgradeCount,
          firstFloor: entry.firstFloor,
        });
      }
    }
    // 획득순 (floor asc) — starter deck (floor 0) first, then by acquisition
    // floor. Within the same floor: upgraded copies first, then 가나다.
    return items.sort((a, b) => {
      if (a.firstFloor !== b.firstFloor) return a.firstFloor - b.firstFloor;
      if (a.upgraded !== b.upgraded) return Number(b.upgraded) - Number(a.upgraded);
      const an = a.card?.name ?? a.id;
      const bn = b.card?.name ?? b.id;
      return an.localeCompare(bn, "ko");
    });
  }, [deck, cardsById]);

  const filtered =
    filter === "all"
      ? expanded
      : expanded.filter((item) => item.card?.type === filter);
  const totalCount = expanded.length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop is its own fixed-viewport layer so it never scrolls out of
          view when the deck list is taller than the screen. */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-[3px]"
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 sm:p-10">
        <div className="pointer-events-auto relative w-full max-w-6xl rounded-xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-50">
                현재 덱
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                {currentFloor}층 기준 · {totalCount}장
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {TYPE_FILTERS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilter(opt.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition",
                    filter === opt.key
                      ? "border-amber-300/60 bg-amber-500/15 text-amber-100"
                      : "border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/30",
                  )}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-white/10 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
              >
                닫기
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="mt-12 text-center text-sm text-zinc-500">
              해당하는 카드가 없습니다.
            </p>
          ) : (
            // Card banners overhang ±9% per side (≈18px on a 200px tile).
            // Gap-x must clear that on both sides plus breathing room or
            // adjacent ribbon tails collide. Inner padding gets bumped to
            // match the gap so the outermost cards sit symmetric inside
            // the modal body.
            <div
              className="mt-5 grid justify-center gap-x-12 gap-y-7 px-6"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(160px, max-content))",
                placeContent: "start center",
              }}
            >
              {filtered.map((item) =>
                item.card ? (
                  <CardTile
                    key={item.key}
                    card={item.card}
                    showUpgrade={item.upgraded}
                    showBeta={false}
                  />
                ) : (
                  <UnknownCardTile key={item.key} id={item.id} />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function UnknownCardTile({ id }: { id: string }) {
  const label = localize("cards", id) ?? id.replace(/^CARD\./, "");
  return (
    <div className="flex aspect-[2/3] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/60 text-center">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
        미등록
      </p>
      <p className="mt-1 text-xs text-zinc-300">{label}</p>
    </div>
  );
}
