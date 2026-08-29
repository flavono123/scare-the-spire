"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { DecisionsDecisionsPoolPicker } from "@/components/decisions-decisions/decisions-decisions-pool-picker";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  cloneFilterDims,
  dimsHaveSelection,
  emptyFilterDims,
  entityToResourceRef,
  poolFilterIsReady,
  resourceKey,
  sortPoolRefs,
  stampFilterIds,
  toggleFilterDim,
  type DecisionsDecisionsResourceRef,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import {
  formatBracketRoundLabel,
  FAVORITE_TOURNAMENT_MIN_POOL,
  FAVORITE_TOURNAMENT_NOTE_MAX_CHARS,
  FAVORITE_TOURNAMENT_NOTE_MIN_CHARS,
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(initial?.nickname ?? profileNickname);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [major, setMajor] = useState<DecisionsPoolMajor | null>(null);
  const [dims, setDims] = useState<DecisionsFilterDims>(() => cloneFilterDims(emptyFilterDims()));
  const [extraIds, setExtraIds] = useState<DecisionsDecisionsResourceRef[]>(
    () => initial?.pool ?? [],
  );
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const filterReady = poolFilterIsReady(major, dims);

  const filteredStamp = useMemo(() => {
    if (!filterReady) return [];
    return stampFilterIds(entities, major, dims);
  }, [dims, entities, filterReady, major]);

  const pool = useMemo(() => {
    const next = mergePool(filteredStamp, extraIds).filter(
      (ref) => !excludedKeys.has(resourceKey(ref)),
    );
    return sortPoolRefs(next, entityMap);
  }, [entityMap, excludedKeys, extraIds, filteredStamp]);

  const handleMajor = useCallback((nextMajor: DecisionsPoolMajor | null) => {
    setMajor(nextMajor);
    setDims(emptyFilterDims());
    setExcludedKeys(new Set());
  }, []);

  const handleToggleDim = useCallback((dim: DecisionsFilterDim, key: string) => {
    setDims((current) => toggleFilterDim(current, dim, key));
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

  const titleOk = title.trim().length >= 1;
  const noteOk = note.trim().length >= FAVORITE_TOURNAMENT_NOTE_MIN_CHARS;
  const poolOk = pool.length >= FAVORITE_TOURNAMENT_MIN_POOL;
  const canSubmit = titleOk && noteOk && poolOk;
  const titleError = attempted && !titleOk;
  const noteError = attempted && !noteOk;
  const submitHint = !titleOk || !noteOk
    ? copy.submitHint
    : !poolOk
      ? copy.poolTooSmall
      : submitLabel;

  const handleSubmit = useCallback(async () => {
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        nickname,
        title,
        note,
        pool,
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, nickname, note, onSubmit, pool, title]);

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
            className="service-input"
          />
        )}
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, FAVORITE_TOURNAMENT_TITLE_MAX_CHARS))}
          placeholder={copy.titlePlaceholder}
          maxLength={FAVORITE_TOURNAMENT_TITLE_MAX_CHARS}
          aria-invalid={titleError}
          className={`service-input font-service text-base font-semibold ${titleError ? "border-red-500" : ""}`}
        />
        {titleError && (
          <p className="text-xs text-red-500">{copy.titleRequired}</p>
        )}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, FAVORITE_TOURNAMENT_NOTE_MAX_CHARS))}
          placeholder={copy.notePlaceholder}
          maxLength={FAVORITE_TOURNAMENT_NOTE_MAX_CHARS}
          rows={3}
          aria-invalid={noteError}
          className={`service-textarea ${noteError ? "border-red-500" : ""}`}
        />
        {noteError && (
          <p className="text-xs text-red-500">{copy.noteRequired}</p>
        )}
      </div>

      <DecisionsDecisionsPoolPicker
        entities={entities}
        entityMap={entityMap}
        serviceLocale={serviceLocale}
        presetLabels={presetLabels}
        major={major}
        dims={dims}
        searchInputRef={searchInputRef}
        showPresets={false}
        onMajor={handleMajor}
        onToggleDim={handleToggleDim}
        onAdd={handleAdd}
      />

      {pool.length > 0 && (
        <p className="font-game-text text-sm text-muted-foreground">
          {formatBracketRoundLabel(pool.length, copy)}
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
        <GameUiHoverTip label={submitHint}>
          <button
            type="button"
            disabled={submitting}
            onClick={() => { void handleSubmit(); }}
            className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </GameUiHoverTip>
        {attempted && pool.length > 0 && pool.length < FAVORITE_TOURNAMENT_MIN_POOL && (
          <span className="text-xs text-muted-foreground">{copy.poolTooSmall}</span>
        )}
      </div>
    </div>
  );
}
