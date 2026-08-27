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
  isDecisionsDecisionsPresetKey,
  namedPresetKeyFromFilter,
  nextUnusedTierColor,
  dimsHaveSelection,
  poolFilterIsReady,
  reorderTierRows,
  resourceKey,
  stampFilterIds,
  stampPresetIds,
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

function namedLockedKey(key: string | undefined): string | null {
  if (!key || key === CUSTOM_PRESET_KEY || !isDecisionsDecisionsPresetKey(key)) return null;
  return key;
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
  const initialFilter = filterStateFromPresetKey(initial?.preset_key ?? CUSTOM_PRESET_KEY);
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
  const [lockedPresetKey, setLockedPresetKey] = useState<string | null>(
    () => namedLockedKey(initial?.preset_key),
  );
  const [rows, setRows] = useState<TierRow[]>(
    initial?.rows?.length ? initial.rows.map((row) => ({ ...row })) : cloneDefaultRows(),
  );
  const [placements, setPlacements] = useState<TierPlacement[]>(
    initial?.placements ?? [],
  );
  const [extraIds, setExtraIds] = useState<DecisionsDecisionsResourceRef[]>(
    initial?.extra_ids ?? [],
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
    return mergePool(filteredStamp, extraIds).filter(
      (ref) => !excludedKeys.has(resourceKey(ref)),
    );
  }, [excludedKeys, extraIds, filteredStamp]);

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

  const extrasForSave = useMemo(() => {
    const hasExclusions = excludedKeys.size > 0;
    if (presetKey === CUSTOM_PRESET_KEY || hasExclusions) return pool;
    const stampedKeys = new Set(filteredStamp.map(resourceKey));
    return pool.filter((ref) => !stampedKeys.has(resourceKey(ref)));
  }, [excludedKeys, filteredStamp, pool, presetKey]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        nickname,
        title,
        note,
        presetKey: excludedKeys.size > 0 ? CUSTOM_PRESET_KEY : presetKey,
        rows,
        placements,
        extraIds: extrasForSave,
      });
      return ok;
    } finally {
      setSubmitting(false);
    }
  }, [excludedKeys, extrasForSave, nickname, note, onSubmit, placements, presetKey, rows, title]);

  return (
    <div
      className={cn("space-y-3", !embedded && "rounded-lg border border-border bg-card/20 p-3")}
      data-decisions-decisions-composer
      data-decisions-decisions-step={step}
    >
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
          disabled={pool.length === 0}
          onClick={() => {
            if (pool.length === 0) return;
            setStep("board");
          }}
          className={cn(
            "rounded-md px-2 py-1 font-semibold transition-colors disabled:opacity-40",
            step === "board"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          {copy.continueToBoard}
        </button>
      </nav>

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
            onSelect={(ref) => setSelectedKey(resourceKey(ref))}
            onMove={handleMove}
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
