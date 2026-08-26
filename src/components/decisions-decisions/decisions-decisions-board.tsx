"use client";

import { useMemo, type DragEvent } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  DecisionsDecisionsToken,
  DecisionsDecisionsTokenPlaceholder,
} from "@/components/decisions-decisions/decisions-decisions-token";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import {
  nextUnusedTierColor,
  resourceKey,
  TIER_PALETTE_KEYS,
  tierColorBar,
  tierColorHex,
  tierColorTextClass,
  UNRANKED_ROW_ID,
  usedTierColorHexes,
  type DecisionsDecisionsResourceRef,
  type TierPaletteKey,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

function parseDragPayload(event: DragEvent): DecisionsDecisionsResourceRef | null {
  const raw = event.dataTransfer.getData("text/plain");
  const [type, id] = raw.split(":");
  if ((type === "card" || type === "relic" || type === "potion") && id) {
    return { type, id };
  }
  return null;
}

function TierRowEditor({
  row,
  rows,
  serviceLocale,
  canRemove,
  onLabelChange,
  onColorChange,
  onMove,
  onRemove,
}: {
  row: TierRow;
  rows: TierRow[];
  serviceLocale: ServiceLocale;
  canRemove: boolean;
  onLabelChange: (label: string) => void;
  onColorChange: (color: TierPaletteKey) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const colorLabels = serviceMessages[serviceLocale].transfigure.tokenColors;
  const taken = usedTierColorHexes(rows, row.id);
  const rowHex = tierColorHex(row.color);
  const index = rows.findIndex((item) => item.id === row.id);

  return (
    <div
      data-decisions-decisions-row-editor
      className="flex w-[6.75rem] shrink-0 flex-col gap-1 border-l border-white/10 p-1 sm:w-[8.75rem]"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={copy.moveRowUp}
          disabled={index <= 0}
          onClick={() => onMove(-1)}
          className="rounded p-0.5 text-zinc-400 hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={copy.moveRowDown}
          disabled={index < 0 || index >= rows.length - 1}
          onClick={() => onMove(1)}
          className="rounded p-0.5 text-zinc-400 hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <input
          value={row.label}
          aria-label={copy.rowLabel}
          onChange={(event) => onLabelChange(event.target.value.slice(0, 12))}
          className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-[11px] font-semibold text-foreground outline-none focus:border-primary/40"
        />
        {canRemove && (
          <button
            type="button"
            aria-label={copy.removeRow}
            onClick={onRemove}
            className="rounded p-0.5 text-zinc-500 hover:text-red-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-0.5">
        {TIER_PALETTE_KEYS.map((color) => {
          const hex = tierColorBar(color);
          const active = hex.toLowerCase() === rowHex;
          const disabled = !active && taken.has(hex.toLowerCase());
          const label = colorLabels[color];
          return (
            <GameUiHoverTip
              key={color}
              label={label}
              delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
            >
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onColorChange(color);
                }}
                className={cn(
                  "h-5 w-5 rounded-md border-2 p-0.5 transition-all",
                  active
                    ? "border-primary bg-primary/20"
                    : disabled
                      ? "cursor-not-allowed border-white/5 opacity-25"
                      : "border-white/10 bg-white/5 hover:border-white/30",
                )}
              >
                <span
                  aria-hidden
                  className="block h-full w-full rounded-sm"
                  style={{ backgroundColor: hex }}
                />
              </button>
            </GameUiHoverTip>
          );
        })}
      </div>
    </div>
  );
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
  showUnranked,
  onSelect,
  onMove,
  onRowLabelChange,
  onRowColorChange,
  onMoveRow,
  onRemoveRow,
  onAddRow,
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
  showUnranked?: boolean;
  onSelect?: (ref: DecisionsDecisionsResourceRef) => void;
  onMove?: (ref: DecisionsDecisionsResourceRef, rowId: string) => void;
  onRowLabelChange?: (rowId: string, label: string) => void;
  onRowColorChange?: (rowId: string, color: TierPaletteKey) => void;
  onMoveRow?: (rowId: string, direction: -1 | 1) => void;
  onRemoveRow?: (rowId: string) => void;
  onAddRow?: () => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const includeUnranked = showUnranked ?? !compact;
  const editable = Boolean(!readOnly && onRowLabelChange && onRowColorChange && onMoveRow);

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
        <div key={row.id} className="flex border-b border-white/10 last:border-b-0">
          <div className="flex min-w-0 flex-1" {...dropProps(row.id)}>
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
          {editable && (
            <TierRowEditor
              row={row}
              rows={rows}
              serviceLocale={serviceLocale}
              canRemove={rows.length > 1 && Boolean(onRemoveRow)}
              onLabelChange={(label) => onRowLabelChange?.(row.id, label)}
              onColorChange={(color) => onRowColorChange?.(row.id, color)}
              onMove={(direction) => onMoveRow?.(row.id, direction)}
              onRemove={() => onRemoveRow?.(row.id)}
            />
          )}
        </div>
      ))}
      {editable && onAddRow && nextUnusedTierColor(rows) && (
        <div className="flex justify-end border-b border-white/10 px-2 py-1">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
          >
            <Plus className="h-3 w-3" />
            {copy.addRow}
          </button>
        </div>
      )}
      {includeUnranked && (
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
      )}
    </div>
  );
}
