"use client";

import { useMemo, type DragEvent } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  DecisionsDecisionsToken,
  DecisionsDecisionsTokenPlaceholder,
} from "@/components/decisions-decisions/decisions-decisions-token";
import {
  resourceKey,
  tierColorBar,
  tierColorTextClass,
  UNRANKED_ROW_ID,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function parseDragPayload(event: DragEvent): DecisionsDecisionsResourceRef | null {
  const raw = event.dataTransfer.getData("text/plain");
  const [type, id] = raw.split(":");
  if ((type === "card" || type === "relic" || type === "potion") && id) {
    return { type, id };
  }
  return null;
}

export function DecisionsDecisionsBoard({
  rows,
  placements,
  pool,
  entitiesByKey,
  serviceLocale,
  gameLocale,
  unrankedLabel,
  showNames,
  selectedKey,
  readOnly = false,
  compact = false,
  onSelect,
  onMove,
}: {
  rows: TierRow[];
  placements: TierPlacement[];
  pool: DecisionsDecisionsResourceRef[];
  entitiesByKey: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  unrankedLabel: string;
  showNames: boolean;
  selectedKey: string | null;
  readOnly?: boolean;
  compact?: boolean;
  onSelect?: (ref: DecisionsDecisionsResourceRef) => void;
  onMove?: (ref: DecisionsDecisionsResourceRef, rowId: string) => void;
}) {
  const byRow = useMemo(() => {
    const grouped = new Map<string, TierPlacement[]>();
    for (const row of rows) grouped.set(row.id, []);
    grouped.set(UNRANKED_ROW_ID, []);
    const placed = new Set<string>();
    for (const item of placements) {
      const list = grouped.get(item.rowId);
      if (!list) continue;
      list.push(item);
      placed.add(resourceKey(item));
    }
    for (const list of grouped.values()) {
      list.sort((left, right) => left.sort - right.sort);
    }
    const unranked = grouped.get(UNRANKED_ROW_ID) ?? [];
    for (const ref of pool) {
      const key = resourceKey(ref);
      if (placed.has(key)) continue;
      unranked.push({ ...ref, rowId: UNRANKED_ROW_ID, sort: unranked.length });
    }
    return grouped;
  }, [placements, pool, rows]);

  const renderTokens = (items: TierPlacement[]) => (
    <div className="flex min-h-16 flex-wrap content-start gap-1 px-2 py-1.5">
      {items.map((item) => {
        const entity = entitiesByKey.get(resourceKey(item));
        const key = resourceKey(item);
        if (!entity) {
          return <DecisionsDecisionsTokenPlaceholder key={key} refItem={item} />;
        }
        return (
          <div
            key={key}
            draggable={!readOnly}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", key);
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            <DecisionsDecisionsToken
              entity={entity}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              showName={showNames}
              selected={selectedKey === key}
              onSelect={() => onSelect?.(item)}
            />
          </div>
        );
      })}
    </div>
  );

  const dropProps = (rowId: string) => readOnly ? {} : {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const ref = parseDragPayload(event);
      if (ref) onMove?.(ref, rowId);
    },
    onClick: () => {
      if (!selectedKey) return;
      const [type, id] = selectedKey.split(":");
      if ((type === "card" || type === "relic" || type === "potion") && id) {
        onMove?.({ type, id }, rowId);
      }
    },
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-black/40",
        compact && "text-[10px]",
      )}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex border-b border-white/10 last:border-b-0"
          {...dropProps(row.id)}
        >
          <div
            className="flex w-12 shrink-0 items-center justify-center px-1 sm:w-16"
            style={{ backgroundColor: `${tierColorBar(row.color)}22` }}
          >
            <span className={cn("font-service text-sm font-bold sm:text-base", tierColorTextClass(row.color))}>
              {row.label}
            </span>
          </div>
          <div className="min-w-0 flex-1">{renderTokens(byRow.get(row.id) ?? [])}</div>
        </div>
      ))}
      <div
        className="flex border-t border-white/10"
        {...dropProps(UNRANKED_ROW_ID)}
      >
        <div className="flex w-12 shrink-0 items-center justify-center px-1 text-[10px] text-zinc-500 sm:w-16">
          {unrankedLabel}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          {renderTokens(byRow.get(UNRANKED_ROW_ID) ?? [])}
        </div>
      </div>
    </div>
  );
}
