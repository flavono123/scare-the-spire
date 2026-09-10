"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Plus, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  DecisionsDecisionsToken,
  DecisionsDecisionsTokenPlaceholder,
  setDecisionsTokenDragImage,
} from "@/components/decisions-decisions/decisions-decisions-token";
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
import { DECISIONS_BOARD_CONTAINER_CLASS, DECISIONS_BOARD_TOKEN_VARS_CLASS } from "@/lib/decisions-token-layout";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const ROW_DRAG_PREFIX = "row:";

type DragKind = "token" | "row";

function parseTokenPayload(raw: string): DecisionsDecisionsResourceRef | null {
  const [type, id] = raw.split(":");
  if (!type || !id || !isDecisionsDecisionsResourceType(type as EntityType)) return null;
  return { type, id } as DecisionsDecisionsResourceRef;
}

function parseRowPayload(raw: string): string | null {
  if (!raw.startsWith(ROW_DRAG_PREFIX)) return null;
  const id = raw.slice(ROW_DRAG_PREFIX.length).trim();
  return id || null;
}

function setRowDragImage(event: DragEvent<HTMLElement>, rowEl: HTMLElement | null) {
  if (!rowEl) return;
  const rect = rowEl.getBoundingClientRect();
  const clone = rowEl.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "fixed";
  clone.style.top = "-1600px";
  clone.style.left = "-1600px";
  clone.style.width = `${rect.width}px`;
  clone.style.margin = "0";
  clone.style.opacity = "0.95";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = "-1";
  clone.style.transform = "none";
  clone.style.boxShadow = "0 12px 28px rgba(0,0,0,0.45)";
  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(
    clone,
    Math.min(Math.max(event.clientX - rect.left, 16), rect.width),
    Math.min(Math.max(event.clientY - rect.top, 8), rect.height),
  );
  const cleanup = () => clone.remove();
  event.currentTarget.addEventListener("dragend", cleanup, { once: true });
  window.setTimeout(cleanup, 1500);
}

function palettePosition(anchor: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}) {
  const width = 152;
  const height = 72;
  const viewW = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewH = typeof window === "undefined" ? 800 : window.innerHeight;
  let left = anchor.right - width;
  let top = anchor.bottom + 6;
  if (left < 8) left = 8;
  if (left + width > viewW - 8) left = Math.max(8, viewW - width - 8);
  if (top + height > viewH - 8) top = Math.max(8, anchor.top - height - 6);
  return { left, top };
}

function TierColorPaletteDropdown({
  row,
  colors,
  colorLabels,
  anchor,
  onPick,
  onClose,
}: {
  row: TierRow;
  colors: TierPaletteKey[];
  colorLabels: Record<string, string>;
  anchor: { left: number; top: number; right: number; bottom: number };
  onPick: (color: TierPaletteKey) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = palettePosition(anchor);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (
        target instanceof Element
        && target.closest("[data-decisions-decisions-color-trigger]")
      ) {
        return;
      }
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label={row.label}
      data-decisions-decisions-color-palette=""
      className="fixed z-[80] grid grid-cols-5 gap-1 rounded-lg border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl backdrop-blur-sm"
      style={{ left: pos.left, top: pos.top }}
    >
      {colors.map((color) => {
        const hex = tierColorBar(color);
        const active = hex.toLowerCase() === tierColorHex(row.color);
        const label = colorLabels[color];
        return (
          <button
            key={color}
            type="button"
            role="option"
            aria-label={label}
            aria-selected={active}
            onClick={() => onPick(color)}
            className={cn(
              "h-6 w-6 rounded-md border p-0.5 transition-all",
              active
                ? "border-primary bg-primary/20"
                : "border-white/10 bg-white/5 hover:border-white/35",
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
    </div>,
    document.body,
  );
}

function TierRowEditor({
  row,
  serviceLocale,
  canRemove,
  paletteOpen,
  onLabelChange,
  onOpenPalette,
  onRemove,
  onRowDragStart,
  onRowDragEnd,
}: {
  row: TierRow;
  serviceLocale: ServiceLocale;
  canRemove: boolean;
  paletteOpen: boolean;
  onLabelChange: (label: string) => void;
  onOpenPalette: (anchor: DOMRect) => void;
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
          const rowEl = event.currentTarget.closest("[data-decisions-decisions-row]");
          setRowDragImage(event, rowEl instanceof HTMLElement ? rowEl : null);
        }}
        onDragEnd={onRowDragEnd}
        className="cursor-grab rounded p-0.5 text-zinc-500 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <button
        type="button"
        aria-label={copy.rowColor}
        aria-haspopup="listbox"
        aria-expanded={paletteOpen}
        data-decisions-decisions-color-trigger={row.id}
        onClick={(event) => {
          event.stopPropagation();
          onOpenPalette(event.currentTarget.getBoundingClientRect());
        }}
        className="h-5 w-5 shrink-0 rounded-md border border-white/20 p-0.5 hover:border-white/40"
      >
        <span
          aria-hidden
          className="block h-full w-full rounded-sm"
          style={{ backgroundColor: tierColorBar(row.color) }}
        />
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
  disablePreview = false,
  thumbnail = false,
  staticOnly = false,
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
  disablePreview?: boolean;
  thumbnail?: boolean;
  staticOnly?: boolean;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const poolOnly = variant === "pool";
  const includeUnranked = showUnranked ?? (!compact || poolOnly);
  const editable = Boolean(!readOnly && !poolOnly && onRowLabelChange && onRowColorChange && onReorderRows);
  const canDrag = Boolean(!readOnly && !poolOnly);
  const dragKindRef = useRef<DragKind | null>(null);
  const [rowDropId, setRowDropId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [palette, setPalette] = useState<{
    rowId: string;
    rect: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const colorRow = rows.find((row) => row.id === palette?.rowId) ?? null;
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
    <div
      className={cn(
        "flex flex-wrap content-start",
        thumbnail ? "px-1 py-1" : "min-h-0 px-[var(--dd-pad,6px)] py-1",
      )}
      style={{ gap: "var(--dd-gap, 4px)" }}
    >
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
              onSelect={onSelect ? () => onSelect(item) : undefined}
              disablePreview={disablePreview}
              staticOnly={staticOnly || thumbnail}
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
        setRowDropId((current) => current === rowId ? current : rowId);
      }
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
        onMove?.({ type, id } as DecisionsDecisionsResourceRef, rowId);
      }
    },
  };

  return (
    <>
      <div
        className={cn(
          DECISIONS_BOARD_CONTAINER_CLASS,
          !thumbnail && "overflow-hidden rounded-lg border border-border bg-black/40",
          compact && "text-[10px]",
          poolOnly && !thumbnail && "max-h-[min(28rem,50dvh)] overflow-y-auto",
          thumbnail && "bg-transparent",
        )}
      >
        <div className={DECISIONS_BOARD_TOKEN_VARS_CLASS}>
          {!poolOnly && rows.map((row) => (
        <div
          key={row.id}
          data-decisions-decisions-row={row.id}
          className={cn(
            "flex border-b border-white/10 last:border-b-0",
            draggingRowId
              && rowDropId === row.id
              && draggingRowId !== row.id
              && "bg-primary/10",
            draggingRowId === row.id && "relative z-10 bg-primary/10 opacity-45 ring-1 ring-primary/50",
          )}
          {...tokenDropProps(row.id)}
        >
          <div className="flex min-w-0 flex-1">
            <div
              className="flex w-[var(--dd-label,48px)] shrink-0 items-center justify-center px-0.5"
              style={{ backgroundColor: `${tierColorBar(row.color)}22` }}
            >
              <span className={cn(
                "line-clamp-3 px-0.5 text-center font-service text-[10px] font-bold leading-tight @xl:line-clamp-none @xl:text-base",
                tierColorTextClass(row.color),
              )}>
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
              paletteOpen={palette?.rowId === row.id}
              onLabelChange={(label) => onRowLabelChange?.(row.id, label)}
              onOpenPalette={(rect) => {
                setPalette((current) => (
                  current?.rowId === row.id
                    ? null
                    : {
                      rowId: row.id,
                      rect: {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                      },
                    }
                ));
              }}
              onRemove={() => onRemoveRow?.(row.id)}
              onRowDragStart={() => {
                dragKindRef.current = "row";
                setDraggingRowId(row.id);
                setRowDropId(row.id);
              }}
              onRowDragEnd={() => {
                dragKindRef.current = null;
                setDraggingRowId(null);
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
      </div>
    {colorRow && palette && (
      <TierColorPaletteDropdown
        row={colorRow}
        colors={availableColors}
        colorLabels={colorLabels}
        anchor={palette.rect}
        onPick={(color) => {
          onRowColorChange?.(colorRow.id, color);
          setPalette(null);
        }}
        onClose={() => setPalette(null)}
      />
    )}
    </>
  );
}
