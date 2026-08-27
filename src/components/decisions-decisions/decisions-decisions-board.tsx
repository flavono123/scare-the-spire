"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  DecisionsDecisionsToken,
  DecisionsDecisionsTokenPlaceholder,
  setDecisionsTokenDragImage,
} from "@/components/decisions-decisions/decisions-decisions-token";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import {
  isDecisionsDecisionsResourceType,
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

const ROW_DRAG_PREFIX = "row:";

type DragKind = "token" | "row";

function parseTokenPayload(raw: string): DecisionsDecisionsResourceRef | null {
  const [type, id] = raw.split(":");
  if (!type || !id || !isDecisionsDecisionsResourceType(type as EntityType)) return null;
  return { type, id };
}

function parseRowPayload(raw: string): string | null {
  if (!raw.startsWith(ROW_DRAG_PREFIX)) return null;
  const id = raw.slice(ROW_DRAG_PREFIX.length).trim();
  return id || null;
}

function TierRowEditor({
  row,
  serviceLocale,
  canRemove,
  onLabelChange,
  onOpenPalette,
  onRemove,
  onRowDragStart,
  onRowDragEnd,
}: {
  row: TierRow;
  serviceLocale: ServiceLocale;
  canRemove: boolean;
  onLabelChange: (label: string) => void;
  onOpenPalette: () => void;
  onRemove: () => void;
  onRowDragStart: () => void;
  onRowDragEnd: () => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;

  return (
    <div
      data-decisions-decisions-row-editor
      className="flex w-[6.75rem] shrink-0 items-center gap-0.5 border-l border-white/10 px-1 py-1 sm:w-[8.75rem]"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        draggable
        aria-label={copy.moveRow}
        onDragStart={(event) => {
          onRowDragStart();
          event.dataTransfer.setData("text/plain", `${ROW_DRAG_PREFIX}${row.id}`);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setDragImage(event.currentTarget, 8, 8);
        }}
        onDragEnd={onRowDragEnd}
        className="cursor-grab rounded p-0.5 text-zinc-500 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <GameUiHoverTip
        label={copy.rowColor}
        delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
      >
        <button
          type="button"
          aria-label={copy.rowColor}
          onClick={onOpenPalette}
          className="h-5 w-5 shrink-0 rounded-md border border-white/20 p-0.5 hover:border-white/40"
        >
          <span
            aria-hidden
            className="block h-full w-full rounded-sm"
            style={{ backgroundColor: tierColorBar(row.color) }}
          />
        </button>
      </GameUiHoverTip>
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
  );
}

function PoolEmptyAffordance({
  label,
}: {
  label: string;
}) {
  return (
    <div
      role="note"
      className="flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-primary/35 bg-primary/[0.04] px-3 py-4 text-primary/80"
    >
      <span aria-hidden className="flex items-center gap-2">
        <span className="flex h-9 w-7 items-center justify-center rounded-[4px] border border-dashed border-primary/40" />
        <span className="flex h-9 w-7 items-center justify-center rounded-[4px] border border-dashed border-primary/25" />
        <span className="flex h-9 w-7 items-center justify-center rounded-[4px] border border-dashed border-primary/15" />
      </span>
      <span className="text-center text-xs font-medium">{label}</span>
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
  showNames,
  selectedKey,
  readOnly = false,
  compact = false,
  variant = "board",
  showUnranked,
  emptyPoolLabel,
  onSelect,
  onMove,
  onRemoveFromPool,
  onRowLabelChange,
  onRowColorChange,
  onReorderRows,
  onRemoveRow,
  onAddRow,
}: {
  rows: TierRow[];
  placements: TierPlacement[];
  pool: DecisionsDecisionsResourceRef[];
  entitiesByKey: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  showNames: boolean;
  selectedKey: string | null;
  readOnly?: boolean;
  compact?: boolean;
  variant?: "board" | "pool";
  showUnranked?: boolean;
  emptyPoolLabel?: string;
  onSelect?: (ref: DecisionsDecisionsResourceRef) => void;
  onMove?: (ref: DecisionsDecisionsResourceRef, rowId: string) => void;
  onRemoveFromPool?: (ref: DecisionsDecisionsResourceRef) => void;
  onRowLabelChange?: (rowId: string, label: string) => void;
  onRowColorChange?: (rowId: string, color: TierPaletteKey) => void;
  onReorderRows?: (fromId: string, toId: string) => void;
  onRemoveRow?: (rowId: string) => void;
  onAddRow?: () => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const poolOnly = variant === "pool";
  const includeUnranked = showUnranked ?? (!compact || poolOnly);
  const editable = Boolean(!readOnly && !poolOnly && onRowLabelChange && onRowColorChange && onReorderRows);
  const canDrag = Boolean(!readOnly && !poolOnly);
  const dragKindRef = useRef<DragKind | null>(null);
  const [rowDropId, setRowDropId] = useState<string | null>(null);
  const [colorRowId, setColorRowId] = useState<string | null>(null);
  const colorRow = rows.find((row) => row.id === colorRowId) ?? null;
  const colorLabels = serviceMessages[serviceLocale].transfigure.tokenColors;
  const availableColors = colorRow
    ? TIER_PALETTE_KEYS.filter((color) => {
      const hex = tierColorHex(color);
      return hex === tierColorHex(colorRow.color)
        || !usedTierColorHexes(rows, colorRow.id).has(hex);
    })
    : [];

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

  const unrankedItems = byRow.get(UNRANKED_ROW_ID) ?? [];

  const renderTokens = (
    items: TierPlacement[],
    options: { removable?: boolean } = {},
  ) => (
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
            draggable={canDrag}
            className="relative [&_img]:pointer-events-none [&_*]:[-webkit-user-drag:none]"
            onDragStart={(event) => {
              if ((event.target as HTMLElement).closest("button")) {
                event.preventDefault();
                return;
              }
              dragKindRef.current = "token";
              event.dataTransfer.setData("text/plain", key);
              event.dataTransfer.effectAllowed = "move";
              setDecisionsTokenDragImage(event);
            }}
            onDragEnd={() => {
              dragKindRef.current = null;
              setRowDropId(null);
            }}
          >
            {options.removable && onRemoveFromPool && (
              <button
                type="button"
                aria-label={copy.removeFromPool}
                draggable={false}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemoveFromPool(item);
                }}
                className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-black/80 text-zinc-300 hover:text-red-300"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
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

  const tokenDropProps = (rowId: string) => (!canDrag && !onMove) ? {} : {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragKindRef.current === "row" && rowId !== UNRANKED_ROW_ID) {
        setRowDropId(rowId);
      }
    },
    onDragLeave: () => {
      if (rowDropId === rowId) setRowDropId(null);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setRowDropId(null);
      const raw = event.dataTransfer.getData("text/plain");
      const draggedRowId = parseRowPayload(raw);
      if (draggedRowId) {
        if (rowId !== UNRANKED_ROW_ID) onReorderRows?.(draggedRowId, rowId);
        dragKindRef.current = null;
        return;
      }
      const ref = parseTokenPayload(raw);
      if (ref) onMove?.(ref, rowId);
      dragKindRef.current = null;
    },
    onClick: () => {
      if (!selectedKey) return;
      const [type, id] = selectedKey.split(":");
      if (type && id && isDecisionsDecisionsResourceType(type as EntityType)) {
        onMove?.({ type, id }, rowId);
      }
    },
  };

  return (
    <>
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-black/40",
        compact && "text-[10px]",
        poolOnly && "max-h-[min(28rem,50dvh)] overflow-y-auto",
      )}
    >
      {!poolOnly && rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            "flex border-b border-white/10 last:border-b-0",
            rowDropId === row.id && "bg-primary/10",
          )}
          {...tokenDropProps(row.id)}
        >
          <div className="flex min-w-0 flex-1">
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
              serviceLocale={serviceLocale}
              canRemove={rows.length > 1 && Boolean(onRemoveRow)}
              onLabelChange={(label) => onRowLabelChange?.(row.id, label)}
              onOpenPalette={() => setColorRowId(row.id)}
              onRemove={() => onRemoveRow?.(row.id)}
              onRowDragStart={() => {
                dragKindRef.current = "row";
              }}
              onRowDragEnd={() => {
                dragKindRef.current = null;
                setRowDropId(null);
              }}
            />
          )}
        </div>
      ))}
      {!poolOnly && editable && onAddRow && nextUnusedTierColor(rows) && (
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
      {includeUnranked && !(readOnly && unrankedItems.length === 0) && (
        <div
          className={cn(!poolOnly && "border-t border-white/10")}
          data-decisions-decisions-pool
          {...(poolOnly ? {} : tokenDropProps(UNRANKED_ROW_ID))}
        >
          <div className="min-w-0 flex-1 overflow-x-auto p-2">
            {unrankedItems.length === 0
              ? (
                readOnly
                  ? null
                  : (
                    <PoolEmptyAffordance
                      label={emptyPoolLabel ?? copy.poolAffordance}
                    />
                  )
              )
              : renderTokens(unrankedItems, { removable: Boolean(onRemoveFromPool) })}
          </div>
        </div>
      )}
    </div>
    {colorRow && (
      <ServiceModalFrame
        title={copy.rowColor}
        titleId={`decisions-decisions-row-color-${colorRow.id}`}
        closeLabel={copy.close}
        onClose={() => setColorRowId(null)}
        panelClassName="max-h-[min(24rem,80dvh)] max-w-sm"
      >
        <div className="flex flex-wrap gap-2">
          {availableColors.map((color) => {
            const hex = tierColorBar(color);
            const active = hex.toLowerCase() === tierColorHex(colorRow.color);
            const label = colorLabels[color];
            return (
              <button
                key={color}
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => {
                  onRowColorChange?.(colorRow.id, color);
                  setColorRowId(null);
                }}
                className={cn(
                  "h-8 w-8 rounded-md border-2 p-0.5 transition-all",
                  active
                    ? "border-primary bg-primary/20"
                    : "border-white/10 bg-white/5 hover:border-white/30",
                )}
              >
                <span
                  aria-hidden
                  className="block h-full w-full rounded-sm"
                  style={{ backgroundColor: hex }}
                />
              </button>
            );
          })}
        </div>
      </ServiceModalFrame>
    )}
    </>
  );
}
