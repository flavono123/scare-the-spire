"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { DecisionsDecisionsPoolPicker } from "@/components/decisions-decisions/decisions-decisions-pool-picker";
import { GameConfirmModal } from "@/components/game-confirm-modal";
import {
  cloneDefaultRows,
  cloneFilterDims,
  CUSTOM_PRESET_KEY,
  DECISIONS_DECISIONS_NOTE_MAX_CHARS,
  DECISIONS_DECISIONS_TITLE_MAX_CHARS,
  emptyFilterDims,
  entityToResourceRef,
  filterStateFromPresetKey,
  findPresetDef,
  namedPresetKeyFromFilter,
  nextUnusedTierColor,
  placedPool,
  dimsHaveSelection,
  poolFilterIsReady,
  reorderTierRows,
  resourceKey,
  stampFilterIds,
  stampPresetIds,
  sortPoolRefs,
  tierColorBar,
  tierColorTextClass,
  toggleFilterDim,
  UNRANKED_ROW_ID,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

function refFromKey(key: string): DecisionsDecisionsResourceRef {
  const [type, id] = key.split(":");
  return { type, id } as DecisionsDecisionsResourceRef;
}

/**
 * Tier buttons for the selected piece (random.gg shows them in a modal; this
 * bar keeps the board in view and takes number keys).
 */
function TierAssignBar({
  rows,
  selectedName,
  currentRowId,
  serviceLocale,
  onAssign,
}: {
  rows: TierRow[];
  selectedName: string | null;
  currentRowId: string | null;
  serviceLocale: ServiceLocale;
  onAssign: (rowId: string) => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const disabled = !selectedName;
  return (
    <div
      role="toolbar"
      aria-label={copy.assignTier}
      data-decisions-decisions-assign-bar
      className="sticky bottom-0 z-20 -mx-1 space-y-1.5 rounded-t-lg border border-b-0 border-white/15 bg-zinc-950/95 px-2 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className={cn("font-semibold", selectedName ? "text-primary" : "text-zinc-400")}>
          {selectedName ?? copy.assignHint}
        </span>
        <span className="hidden text-[11px] text-zinc-500 sm:inline">
          {copy.assignKeys.replace("{count}", String(Math.min(rows.length, 9)))}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((row, index) => {
          const bar = tierColorBar(row.color);
          const active = currentRowId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onAssign(row.id)}
              className={cn(
                "inline-flex min-h-9 min-w-[3.25rem] flex-1 items-center justify-center gap-1.5 rounded-md border px-2 font-service text-sm font-bold transition-[transform,filter] hover:brightness-125 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none",
                tierColorTextClass(row.color),
                active && "ring-2 ring-white/70",
              )}
              style={{ backgroundColor: `${bar}2e`, borderColor: `${bar}88` }}
            >
              {index < 9 && (
                <kbd className="hidden rounded border border-white/15 px-1 font-sans text-[10px] font-normal text-zinc-400 sm:inline">
                  {index + 1}
                </kbd>
              )}
              <span className="truncate">{row.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled || currentRowId === null}
          onClick={() => onAssign(UNRANKED_ROW_ID)}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <kbd className="hidden rounded border border-white/15 px-1 font-sans text-[10px] font-normal text-zinc-400 sm:inline">0</kbd>
          {copy.unranked}
        </button>
      </div>
    </div>
  );
}

export type DecisionsDecisionsComposerValues = {
  nickname: string;
  title: string;
  note: string;
  presetKey: string;
  rows: TierRow[];
  placements: TierPlacement[];
  extraIds: DecisionsDecisionsResourceRef[];
};

function mergePool(
  stamped: DecisionsDecisionsResourceRef[],
  extras: DecisionsDecisionsResourceRef[],
): DecisionsDecisionsResourceRef[] {
  const seen = new Set(stamped.map(resourceKey));
  return [...stamped, ...extras.filter((ref) => !seen.has(resourceKey(ref)))];
}

type BoardBaseline = {
  rows: TierRow[];
  placements: TierPlacement[];
  title: string;
  note: string;
  nickname: string;
};

function cloneBoardBaseline(value: BoardBaseline): BoardBaseline {
  return {
    rows: value.rows.map((row) => ({ ...row })),
    placements: value.placements.map((item) => ({ ...item })),
    title: value.title,
    note: value.note,
    nickname: value.nickname,
  };
}

function boardStatesMatch(left: BoardBaseline, right: BoardBaseline): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function DecisionsDecisionsComposer({
  entities,
  entityMap,
  stamps,
  gameLocale,
  serviceLocale,
  presetLabels,
  submitLabel,
  profileNickname,
  hideNickname = false,
  initial,
  onSubmit,
  onClose,
  embedded = false,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  stamps: Record<string, DecisionsDecisionsResourceRef[]>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  submitLabel: string;
  profileNickname: string;
  hideNickname?: boolean;
  initial?: DecisionsDecisionsPost | null;
  onSubmit: (values: DecisionsDecisionsComposerValues) => Promise<boolean>;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const confirmCopy = serviceMessages[serviceLocale].deleteConfirm;
  const initialFilter = filterStateFromPresetKey(CUSTOM_PRESET_KEY);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardBaselineRef = useRef<BoardBaseline | null>(null);
  const previousStepRef = useRef<"template" | "board">("template");
  const [step, setStep] = useState<"template" | "board">(initial ? "board" : "template");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [nickname, setNickname] = useState(initial?.nickname ?? profileNickname);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [major, setMajor] = useState<DecisionsPoolMajor | null>(initialFilter.major);
  const [dims, setDims] = useState<DecisionsFilterDims>(
    () => cloneFilterDims(initialFilter.dims),
  );
  const [lockedPresetKey, setLockedPresetKey] = useState<string | null>(null);
  const [rows, setRows] = useState<TierRow[]>(
    initial?.rows?.length ? initial.rows.map((row) => ({ ...row })) : cloneDefaultRows(),
  );
  const [placements, setPlacements] = useState<TierPlacement[]>(
    initial?.placements ?? [],
  );
  const [extraIds, setExtraIds] = useState<DecisionsDecisionsResourceRef[]>(
    () => initial ? placedPool(initial.placements) : [],
  );
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filterReady = poolFilterIsReady(major, dims);
  const presetKey = lockedPresetKey ?? namedPresetKeyFromFilter(major, dims);

  const filteredStamp = useMemo(() => {
    if (lockedPresetKey) {
      return stamps[lockedPresetKey]
        ?? stampPresetIds(findPresetDef(lockedPresetKey), entities);
    }
    if (!filterReady) return [];
    return stampFilterIds(entities, major, dims);
  }, [dims, entities, filterReady, lockedPresetKey, major, stamps]);

  const pool = useMemo(() => {
    const next = mergePool(filteredStamp, extraIds).filter(
      (ref) => !excludedKeys.has(resourceKey(ref)),
    );
    return sortPoolRefs(next, entityMap);
  }, [entityMap, excludedKeys, extraIds, filteredStamp]);

  const handleMajor = useCallback((nextMajor: DecisionsPoolMajor | null) => {
    setMajor(nextMajor);
    setDims(emptyFilterDims());
    setLockedPresetKey(null);
    setExcludedKeys(new Set());
  }, []);

  const handleToggleDim = useCallback((dim: DecisionsFilterDim, key: string) => {
    setLockedPresetKey(null);
    setDims((current) => toggleFilterDim(current, dim, key));
  }, []);

  const handlePreset = useCallback((key: string) => {
    const next = filterStateFromPresetKey(key);
    setMajor(next.major);
    setDims(cloneFilterDims(next.dims));
    setLockedPresetKey(key);
    setExtraIds([]);
    setExcludedKeys(new Set());
    setSelectedKey(null);
    setStep("board");
  }, []);

  const handleMove = useCallback((
    ref: DecisionsDecisionsResourceRef,
    rowId: string,
  ) => {
    setPlacements((current) => {
      const without = current.filter((item) => resourceKey(item) !== resourceKey(ref));
      if (rowId === UNRANKED_ROW_ID) return without;
      const sameRow = without.filter((item) => item.rowId === rowId);
      return [...without, { ...ref, rowId, sort: sameRow.length }];
    });
    setSelectedKey(null);
  }, []);

  const toggleSelect = useCallback((ref: DecisionsDecisionsResourceRef) => {
    const key = resourceKey(ref);
    setSelectedKey((current) => (current === key ? null : key));
  }, []);

  const handleAdd = useCallback((entity: EntityInfo) => {
    const ref = entityToResourceRef(entity);
    if (!ref) return;
    const key = resourceKey(ref);
    setSelectedKey(key);
    setExcludedKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setExtraIds((current) => {
      if (current.some((item) => resourceKey(item) === key)) return current;
      if (filteredStamp.some((item) => resourceKey(item) === key)) return current;
      return [...current, ref];
    });
  }, [filteredStamp]);

  const handleRemoveFromPool = useCallback((ref: DecisionsDecisionsResourceRef) => {
    const key = resourceKey(ref);
    setPlacements((current) => current.filter((item) => resourceKey(item) !== key));
    setExtraIds((current) => current.filter((item) => resourceKey(item) !== key));
    setExcludedKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
    if (selectedKey === key) setSelectedKey(null);
  }, [selectedKey]);

  const emptyPoolLabel = !major
    ? copy.poolPickType
    : major === "card" && !dimsHaveSelection(dims)
      ? copy.poolApplyFilter
      : copy.poolAffordance;

  const currentBoard = useMemo<BoardBaseline>(() => ({
    rows,
    placements,
    title,
    note,
    nickname,
  }), [nickname, note, placements, rows, title]);

  useEffect(() => {
    if (step === "board" && previousStepRef.current !== "board") {
      boardBaselineRef.current = cloneBoardBaseline(currentBoard);
    }
    previousStepRef.current = step;
  }, [currentBoard, step]);

  const requestPrepare = useCallback(() => {
    if (step !== "board") {
      setStep("template");
      return;
    }
    const baseline = boardBaselineRef.current;
    if (baseline && !boardStatesMatch(baseline, currentBoard)) {
      setLeaveConfirmOpen(true);
      return;
    }
    setStep("template");
  }, [currentBoard, step]);

  const confirmLeaveBoard = useCallback(() => {
    const baseline = boardBaselineRef.current;
    if (baseline) {
      const restored = cloneBoardBaseline(baseline);
      setRows(restored.rows);
      setPlacements(restored.placements);
      setTitle(restored.title);
      setNote(restored.note);
      setNickname(restored.nickname);
    } else {
      setRows(cloneDefaultRows());
      setPlacements([]);
    }
    setSelectedKey(null);
    setLeaveConfirmOpen(false);
    setStep("template");
  }, []);

  const placedForSave = useMemo(() => placedPool(placements), [placements]);
  const hasUnplacedPool = useMemo(() => {
    const placedKeys = new Set(placedForSave.map(resourceKey));
    return pool.some((ref) => !placedKeys.has(resourceKey(ref)));
  }, [placedForSave, pool]);

  const extrasForSave = useMemo(() => {
    if (hasUnplacedPool || excludedKeys.size > 0 || presetKey === CUSTOM_PRESET_KEY) {
      return placedForSave;
    }
    const stampedKeys = new Set(filteredStamp.map(resourceKey));
    return placedForSave.filter((ref) => !stampedKeys.has(resourceKey(ref)));
  }, [excludedKeys, filteredStamp, hasUnplacedPool, placedForSave, presetKey]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        nickname,
        title,
        note,
        presetKey: hasUnplacedPool || excludedKeys.size > 0
          ? CUSTOM_PRESET_KEY
          : presetKey,
        rows,
        placements,
        extraIds: extrasForSave,
      });
      return ok;
    } finally {
      setSubmitting(false);
    }
  }, [
    excludedKeys,
    extrasForSave,
    hasUnplacedPool,
    nickname,
    note,
    onSubmit,
    placements,
    presetKey,
    rows,
    title,
  ]);

  const selectedRowId = useMemo(() => {
    if (!selectedKey) return null;
    return placements.find((item) => resourceKey(item) === selectedKey)?.rowId ?? null;
  }, [placements, selectedKey]);

  // Assign, then jump to the next unranked piece so a whole pool goes by keys alone.
  const assignSelected = useCallback((rowId: string) => {
    if (!selectedKey) return;
    handleMove(refFromKey(selectedKey), rowId);
    if (rowId === UNRANKED_ROW_ID) return;
    const placedKeys = new Set(placements.map(resourceKey));
    placedKeys.add(selectedKey);
    const index = pool.findIndex((ref) => resourceKey(ref) === selectedKey);
    const next = [...pool.slice(index + 1), ...pool.slice(0, Math.max(index, 0))]
      .find((ref) => !placedKeys.has(resourceKey(ref)));
    setSelectedKey(next ? resourceKey(next) : null);
  }, [handleMove, placements, pool, selectedKey]);

  useEffect(() => {
    if (step !== "board") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape" && selectedKey) {
        setSelectedKey(null);
        return;
      }
      if (!selectedKey || !/^[0-9]$/.test(event.key)) return;
      const digit = Number(event.key);
      const rowId = digit === 0 ? UNRANKED_ROW_ID : rows[digit - 1]?.id;
      if (!rowId) return;
      event.preventDefault();
      assignSelected(rowId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assignSelected, rows, selectedKey, step]);

  const canMakeTiers = pool.length > 0;
  const goToBoard = useCallback(() => {
    if (!canMakeTiers) return;
    setStep("board");
  }, [canMakeTiers]);

  return (
    <div
      className={cn("space-y-3", !embedded && "rounded-lg border border-border bg-card/20 p-3")}
      data-decisions-decisions-composer
      data-decisions-decisions-step={step}
    >
      {canMakeTiers && (
      <nav
        aria-label={`${copy.stepPrepare} / ${copy.continueToBoard}`}
        data-decisions-decisions-steps
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        <button
          type="button"
          aria-current={step === "template" ? "step" : undefined}
          onClick={requestPrepare}
          className={cn(
            "rounded-md px-2 py-1 font-semibold transition-colors",
            step === "template"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          {copy.stepPrepare}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
        <button
          type="button"
          aria-current={step === "board" ? "step" : undefined}
          onClick={goToBoard}
          className={cn(
            "rounded-md px-2 py-1 font-semibold transition-colors",
            step === "board"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          {copy.continueToBoard}
        </button>
      </nav>
      )}

      {(step === "board" || (onClose && !embedded)) && (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {step === "board" && (
            <>
              {!hideNickname && (
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value.slice(0, 20))}
                  placeholder={copy.nicknamePlaceholder}
                  maxLength={20}
                  className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
                />
              )}
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, DECISIONS_DECISIONS_TITLE_MAX_CHARS))}
                placeholder={copy.titlePlaceholder}
                maxLength={DECISIONS_DECISIONS_TITLE_MAX_CHARS}
                className="w-full bg-transparent font-service text-base font-semibold text-foreground outline-none placeholder:text-gray-600"
              />
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, DECISIONS_DECISIONS_NOTE_MAX_CHARS))}
                placeholder={copy.notePlaceholder}
                maxLength={DECISIONS_DECISIONS_NOTE_MAX_CHARS}
                className="w-full bg-transparent text-sm text-zinc-400 outline-none placeholder:text-gray-600"
              />
            </>
          )}
        </div>
        {onClose && !embedded && (
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      )}

      {step === "template" && (
        <>
          <DecisionsDecisionsPoolPicker
            entities={entities}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            presetLabels={presetLabels}
            major={major}
            dims={dims}
            searchInputRef={searchInputRef}
            onMajor={handleMajor}
            onToggleDim={handleToggleDim}
            onPreset={handlePreset}
            onAdd={handleAdd}
          />
          <DecisionsDecisionsBoard
            variant="pool"
            rows={rows}
            placements={[]}
            pool={pool}
            entitiesByKey={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            showNames={false}
            selectedKey={selectedKey}
            onSelect={(ref) => setSelectedKey(resourceKey(ref))}
            onRemoveFromPool={handleRemoveFromPool}
            emptyPoolLabel={emptyPoolLabel}
          />
          {canMakeTiers && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToBoard}
                data-decisions-decisions-continue-board
                className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
              >
                {copy.continueToBoard}
              </button>
            </div>
          )}
        </>
      )}

      {step === "board" && (
        <>
          <DecisionsDecisionsBoard
            rows={rows}
            placements={placements}
            pool={pool}
            entitiesByKey={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            showNames={false}
            selectedKey={selectedKey}
            onSelect={toggleSelect}
            onMove={handleMove}
            rowMinCards={2}
            onRowLabelChange={(rowId, label) => {
              setRows((current) => current.map((row) => (
                row.id === rowId ? { ...row, label } : row
              )));
            }}
            onRowColorChange={(rowId, color) => {
              setRows((current) => current.map((row) => (
                row.id === rowId ? { ...row, color } : row
              )));
            }}
            onReorderRows={(fromId, toId) => {
              setRows((current) => reorderTierRows(current, fromId, toId));
            }}
            onRemoveRow={(rowId) => {
              setRows((current) => current.length <= 1
                ? current
                : current.filter((row) => row.id !== rowId));
              setPlacements((current) => current.filter((item) => item.rowId !== rowId));
            }}
            onAddRow={() => {
              const color = nextUnusedTierColor(rows);
              if (!color) return;
              setRows((current) => [
                ...current,
                {
                  id: `row-${Date.now()}`,
                  label: String(current.length + 1),
                  color,
                },
              ]);
            }}
          />
          <TierAssignBar
            rows={rows}
            selectedName={selectedKey ? entityMap.get(selectedKey)?.nameKo ?? selectedKey : null}
            currentRowId={selectedRowId}
            serviceLocale={serviceLocale}
            onAssign={assignSelected}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submitting || title.trim().length < 1}
              onClick={() => { void handleSubmit(); }}
              className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </>
      )}

      <GameConfirmModal
        open={leaveConfirmOpen}
        title={copy.leaveBoardConfirm.title}
        body={copy.leaveBoardConfirm.body}
        confirmLabel={confirmCopy.confirm}
        cancelLabel={confirmCopy.cancel}
        onConfirm={confirmLeaveBoard}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </div>
  );
}
