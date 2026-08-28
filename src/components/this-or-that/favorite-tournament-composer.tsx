"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { DecisionsDecisionsPoolPicker } from "@/components/decisions-decisions/decisions-decisions-pool-picker";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  cloneFilterDims,
  CUSTOM_PRESET_KEY,
  dimsHaveSelection,
  emptyFilterDims,
  entityToResourceRef,
  filterStateFromPresetKey,
  findPresetDef,
  namedPresetKeyFromFilter,
  poolFilterIsReady,
  resourceKey,
  sortPoolRefs,
  stampFilterIds,
  stampPresetIds,
  toggleFilterDim,
  type DecisionsDecisionsResourceRef,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import {
  byeCountForSize,
  FAVORITE_TOURNAMENT_MIN_POOL,
  FAVORITE_TOURNAMENT_NOTE_MAX_CHARS,
  FAVORITE_TOURNAMENT_TITLE_MAX_CHARS,
  type FavoriteTournamentPost,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export type FavoriteTournamentComposerValues = {
  nickname: string;
  title: string;
  note: string;
  presetKey: string;
  pool: FavoriteTournamentResourceRef[];
};

function mergePool(
  stamped: DecisionsDecisionsResourceRef[],
  extras: DecisionsDecisionsResourceRef[],
): DecisionsDecisionsResourceRef[] {
  const seen = new Set(stamped.map(resourceKey));
  return [...stamped, ...extras.filter((ref) => !seen.has(resourceKey(ref)))];
}

export function FavoriteTournamentComposer({
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
  initial?: FavoriteTournamentPost | null;
  onSubmit: (values: FavoriteTournamentComposerValues) => Promise<boolean>;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const decisionsCopy = serviceMessages[serviceLocale].decisionsDecisions;
  const initialFilter = filterStateFromPresetKey(initial?.preset_key ?? CUSTOM_PRESET_KEY);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(initial?.nickname ?? profileNickname);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [major, setMajor] = useState<DecisionsPoolMajor | null>(initialFilter.major);
  const [dims, setDims] = useState<DecisionsFilterDims>(
    () => cloneFilterDims(initialFilter.dims),
  );
  const [lockedPresetKey, setLockedPresetKey] = useState<string | null>(
    initial?.preset_key && initial.preset_key !== CUSTOM_PRESET_KEY
      ? initial.preset_key
      : null,
  );
  const [extraIds, setExtraIds] = useState<DecisionsDecisionsResourceRef[]>(
    () => initial?.pool ?? [],
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
    ? decisionsCopy.poolPickType
    : major === "card" && !dimsHaveSelection(dims)
      ? decisionsCopy.poolApplyFilter
      : decisionsCopy.poolAffordance;

  const canSubmit = pool.length >= FAVORITE_TOURNAMENT_MIN_POOL && title.trim().length >= 1;
  const byeCount = byeCountForSize(pool.length);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        nickname,
        title,
        note,
        presetKey: excludedKeys.size > 0 || extraIds.length > 0
          ? CUSTOM_PRESET_KEY
          : presetKey,
        pool,
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, excludedKeys, extraIds, nickname, note, onSubmit, pool, presetKey, title]);

  return (
    <div className="space-y-3" data-favorite-tournament-composer>
      <div className="min-w-0 space-y-2">
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
          onChange={(event) => setTitle(event.target.value.slice(0, FAVORITE_TOURNAMENT_TITLE_MAX_CHARS))}
          placeholder={copy.titlePlaceholder}
          maxLength={FAVORITE_TOURNAMENT_TITLE_MAX_CHARS}
          className="w-full bg-transparent font-service text-base font-semibold text-foreground outline-none placeholder:text-gray-600"
        />
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, FAVORITE_TOURNAMENT_NOTE_MAX_CHARS))}
          placeholder={copy.notePlaceholder}
          maxLength={FAVORITE_TOURNAMENT_NOTE_MAX_CHARS}
          className="w-full bg-transparent text-sm text-zinc-400 outline-none placeholder:text-gray-600"
        />
      </div>

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

      {pool.length > 0 && (
        <p className="font-game-text text-sm text-zinc-300">
          {copy.roundLabel.replace("{size}", String(pool.length))}
          {byeCount > 0 ? ` · ${copy.byeNote}` : null}
        </p>
      )}

      <DecisionsDecisionsBoard
        variant="pool"
        rows={[]}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={submitting || !canSubmit}
          onClick={() => { void handleSubmit(); }}
          className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {pool.length > 0 && pool.length < FAVORITE_TOURNAMENT_MIN_POOL && (
          <span className="text-xs text-muted-foreground">{copy.poolTooSmall}</span>
        )}
      </div>
    </div>
  );
}
