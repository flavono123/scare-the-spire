"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { DecisionsDecisionsPoolPicker } from "@/components/decisions-decisions/decisions-decisions-pool-picker";
import {
  cloneDefaultRows,
  CUSTOM_PRESET_KEY,
  DECISIONS_DECISIONS_NOTE_MAX_CHARS,
  DECISIONS_DECISIONS_TITLE_MAX_CHARS,
  entityToResourceRef,
  filterStateFromPresetKey,
  namedPresetKeyFromFilter,
  nextUnusedTierColor,
  poolFilterIsReady,
  reorderTierRows,
  resourceKey,
  stampFilterIds,
  UNRANKED_ROW_ID,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
  type DecisionsPoolMajor,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
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

function toggleMinor(current: Set<string>, minor: string): Set<string> {
  const next = new Set(current);
  if (next.has(minor)) next.delete(minor);
  else next.add(minor);
  return next;
}

export function DecisionsDecisionsComposer({
  entities,
  entityMap,
  gameLocale,
  serviceLocale,
  presetLabels,
  submitLabel,
  profileNickname,
  hideNickname = false,
  initial,
  onSubmit,
  onClose,
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
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const initialFilter = filterStateFromPresetKey(initial?.preset_key ?? CUSTOM_PRESET_KEY);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(initial?.nickname ?? profileNickname);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [major, setMajor] = useState<DecisionsPoolMajor | null>(initialFilter.major);
  const [minors, setMinors] = useState<Set<string>>(
    () => initialFilter.minor ? new Set([initialFilter.minor]) : new Set(),
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

  const filterReady = poolFilterIsReady(major, minors);
  const minorList = useMemo(() => [...minors], [minors]);
  const presetKey = namedPresetKeyFromFilter(major, minorList);

  const filteredStamp = useMemo(() => {
    if (!filterReady) return [];
    return stampFilterIds(entities, major, minorList);
  }, [entities, filterReady, major, minorList]);

  const pool = useMemo(() => {
    return mergePool(filteredStamp, extraIds).filter(
      (ref) => !excludedKeys.has(resourceKey(ref)),
    );
  }, [excludedKeys, extraIds, filteredStamp]);

  const handleMajor = useCallback((nextMajor: DecisionsPoolMajor | null) => {
    setMajor(nextMajor);
    setMinors(new Set());
  }, []);

  const handleToggleMinor = useCallback((minor: string) => {
    setMinors((current) => toggleMinor(current, minor));
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
      className="space-y-3 rounded-lg border border-border bg-card/20 p-3"
      data-decisions-decisions-composer
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
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
        </div>
        {onClose && (
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
        onRemoveFromPool={handleRemoveFromPool}
        onEmptyPoolActivate={() => searchInputRef.current?.focus()}
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

      <DecisionsDecisionsPoolPicker
        entities={entities}
        entityMap={entityMap}
        serviceLocale={serviceLocale}
        presetLabels={presetLabels}
        major={major}
        minors={minors}
        searchInputRef={searchInputRef}
        onMajor={handleMajor}
        onToggleMinor={handleToggleMinor}
        onAdd={handleAdd}
      />

      <button
        type="button"
        disabled={submitting || title.trim().length < 1}
        onClick={() => { void handleSubmit(); }}
        className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
