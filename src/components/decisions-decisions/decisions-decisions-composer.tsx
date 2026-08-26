"use client";

import { useCallback, useMemo, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { matchEntities } from "@/lib/chemical-utils";
import {
  cloneDefaultRows,
  DECISIONS_DECISIONS_NOTE_MAX_CHARS,
  DECISIONS_DECISIONS_PRESET_DEFS,
  DECISIONS_DECISIONS_TITLE_MAX_CHARS,
  entityToResourceRef,
  isDecisionsDecisionsResourceType,
  resourceKey,
  UNRANKED_ROW_ID,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
  type TierColorKey,
  type TierPlacement,
  type TierRow,
  SPIRE_TIER_COLOR_KEYS,
  CHARACTER_TIER_COLOR_KEYS,
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
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const [nickname, setNickname] = useState(initial?.nickname ?? profileNickname);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [presetKey, setPresetKey] = useState(initial?.preset_key ?? "custom");
  const [rows, setRows] = useState<TierRow[]>(
    initial?.rows?.length ? initial.rows.map((row) => ({ ...row })) : cloneDefaultRows(),
  );
  const [placements, setPlacements] = useState<TierPlacement[]>(
    initial?.placements ?? [],
  );
  const [extraIds, setExtraIds] = useState<DecisionsDecisionsResourceRef[]>(
    initial?.extra_ids ?? [],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pool = useMemo(() => {
    const stamped = stamps[presetKey] ?? [];
    const seen = new Set(stamped.map(resourceKey));
    const extras = extraIds.filter((ref) => !seen.has(resourceKey(ref)));
    return [...stamped, ...extras];
  }, [extraIds, presetKey, stamps]);

  const catalog = useMemo(
    () => entities.filter((entity) => isDecisionsDecisionsResourceType(entity.type)),
    [entities],
  );
  const matches = useMemo(
    () => matchEntities(query.trim(), catalog, 8),
    [catalog, query],
  );

  const handlePreset = useCallback((nextKey: string) => {
    setPresetKey(nextKey);
    setPlacements([]);
    setSelectedKey(null);
    if (nextKey !== "custom") setExtraIds([]);
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
    setExtraIds((current) => {
      if (current.some((item) => resourceKey(item) === resourceKey(ref))) return current;
      return [...current, ref];
    });
    setQuery("");
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        nickname,
        title,
        note,
        presetKey,
        rows,
        placements,
        extraIds,
      });
      return ok;
    } finally {
      setSubmitting(false);
    }
  }, [extraIds, nickname, note, onSubmit, placements, presetKey, rows, title]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/20 p-3">
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

      <label className="block text-xs text-muted-foreground">
        {copy.presetLabel}
        <select
          value={presetKey}
          onChange={(event) => handlePreset(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-sm text-foreground"
        >
          {DECISIONS_DECISIONS_PRESET_DEFS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.key === "custom"
                ? copy.presetCustom
                : presetLabels[preset.key] ?? preset.key}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-sm"
        />
        {query.trim() && (
          <div className="flex flex-wrap gap-1">
            {matches.map((entity) => (
              <button
                key={`${entity.type}:${entity.id}`}
                type="button"
                onClick={() => handleAdd(entity)}
                className="rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:border-primary/40 hover:text-primary"
              >
                {entity.nameKo}
              </button>
            ))}
          </div>
        )}
      </div>

      <DecisionsDecisionsBoard
        rows={rows}
        placements={placements}
        pool={pool}
        entitiesByKey={entityMap}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        unrankedLabel={copy.unranked}
        showNames
        selectedKey={selectedKey}
        onSelect={(ref) => setSelectedKey(resourceKey(ref))}
        onMove={handleMove}
      />

      <div className="flex flex-wrap items-center gap-2">
        {rows.map((row, index) => (
          <label key={row.id} className="flex items-center gap-1 text-xs text-zinc-400">
            <input
              value={row.label}
              onChange={(event) => {
                const label = event.target.value.slice(0, 12);
                setRows((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, label } : item
                )));
              }}
              className="w-10 rounded border border-border bg-transparent px-1 py-0.5 text-center"
            />
            <select
              value={row.color}
              onChange={(event) => {
                const color = event.target.value as TierColorKey;
                setRows((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, color } : item
                )));
              }}
              className="rounded border border-border bg-background/60 px-1 py-0.5"
            >
              {[...SPIRE_TIER_COLOR_KEYS, ...CHARACTER_TIER_COLOR_KEYS].map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="button"
          onClick={() => setRows((current) => [
            ...current,
            {
              id: `row-${current.length + 1}`,
              label: String(current.length + 1),
              color: "gold",
            },
          ])}
          className="text-xs text-primary"
        >
          {copy.addRow}
        </button>
      </div>

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
