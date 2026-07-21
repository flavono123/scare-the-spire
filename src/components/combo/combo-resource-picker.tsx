"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const PICKER_TYPE_ORDER = [
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "monster",
  "encounter",
  "event",
  "ancient",
  "epoch",
  "character",
  "keyword",
] as const satisfies readonly EntityType[];

const BROWSE_RESULT_LIMIT = 48;
const SEARCH_RESULT_LIMIT = 80;

function getEntityTypeLabels(serviceLocale: ServiceLocale): Partial<Record<EntityType, string>> {
  const codex = serviceMessages[serviceLocale].codex;
  return {
    character: codex.characters,
    card: codex.cards,
    keyword: codex.keywords,
    relic: codex.relics,
    potion: codex.potions,
    power: codex.powers,
    enchantment: codex.enchantments,
    affliction: codex.afflictions,
    event: codex.events,
    monster: codex.monsters,
    encounter: codex.encounters,
    ancient: codex.ancients,
    epoch: codex.epochs,
  };
}

interface ComboResourcePickerProps {
  entities: EntityInfo[];
  serviceLocale: ServiceLocale;
  onSelect: (entity: EntityInfo) => void;
}

export function ComboResourcePicker({
  entities,
  serviceLocale,
  onSelect,
}: ComboResourcePickerProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const commonCopy = serviceMessages[serviceLocale].codex.common;
  const typeLabels = getEntityTypeLabels(serviceLocale);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntityType | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<EntityInfo | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const availableTypes = useMemo(() => {
    const types = new Set(entities.map((entity) => entity.type));
    return PICKER_TYPE_ORDER.filter((type) => types.has(type));
  }, [entities]);

  const scopedEntities = useMemo(() => {
    const scoped = activeType
      ? entities.filter((entity) => entity.type === activeType)
      : entities;
    return [...scoped].sort((left, right) => left.nameKo.localeCompare(right.nameKo));
  }, [activeType, entities]);

  const normalizedQuery = query.trim();
  const results = useMemo(
    () => normalizedQuery
      ? matchEntities(normalizedQuery, scopedEntities, SEARCH_RESULT_LIMIT)
      : scopedEntities.slice(0, BROWSE_RESULT_LIMIT),
    [normalizedQuery, scopedEntities],
  );
  const hasMoreBrowseResults = !normalizedQuery && scopedEntities.length > results.length;

  useEffect(() => {
    if (!open) return;

    searchInputRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const selectEntity = (entity: EntityInfo) => {
    onSelect(entity);
    setRecentlyAdded(entity);
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setRecentlyAdded(null);
      feedbackTimeoutRef.current = null;
    }, 1600);
    setQuery("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="min-w-0 flex-1" data-combo-resource-picker>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="combo-resource-picker-panel"
          data-combo-picker-trigger
          onClick={() => setOpen((current) => !current)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-yellow-400/25 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-200 transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-yellow-300/45 hover:bg-yellow-500/15 active:translate-y-0 motion-reduce:transform-none"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.addResource}
        </button>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-500">
          {copy.composerHint}
        </p>
        <span
          aria-live="polite"
          className="inline-flex min-h-5 shrink-0 items-center gap-1 text-[11px] font-semibold text-yellow-200"
        >
          {recentlyAdded && (
            <span
              key={`${recentlyAdded.type}:${recentlyAdded.id}`}
              className="inline-flex items-center gap-1 motion-safe:animate-pulse"
              data-combo-picker-feedback
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.resourceAdded.replace("{name}", recentlyAdded.nameKo)}
            </span>
          )}
        </span>
      </div>

      {open && (
        <div
          id="combo-resource-picker-panel"
          role="dialog"
          aria-label={copy.resourcePickerLabel}
          data-combo-picker-panel
          className="mt-2 flex max-h-72 w-full flex-col overflow-hidden rounded-xl border border-yellow-500/25 bg-[#090913]/98 shadow-[0_14px_36px_rgba(0,0,0,0.48)]"
        >
          <div className="flex items-center gap-2 border-b border-white/10 p-2.5">
            <Search className="h-4 w-4 shrink-0 text-yellow-300/70" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.resourceSearchPlaceholder}
              aria-label={copy.resourceSearchPlaceholder}
              data-combo-picker-search
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={commonCopy.close}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-2.5 py-2">
            <button
              type="button"
              aria-pressed={activeType == null}
              onClick={() => {
                setActiveType(null);
                searchInputRef.current?.focus();
              }}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                activeType == null
                  ? "border-yellow-300/40 bg-yellow-500/15 text-yellow-200"
                  : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
              )}
            >
              {copy.allResources}
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={activeType === type}
                onClick={() => {
                  setActiveType(type);
                  searchInputRef.current?.focus();
                }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  activeType === type
                    ? "border-yellow-300/40 bg-yellow-500/15 text-yellow-200"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
                )}
              >
                {typeLabels[type] ?? type}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-zinc-600">
                {commonCopy.noResults}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {results.map((entity) => (
                  <button
                    key={`${entity.type}:${entity.id}`}
                    type="button"
                    role="listitem"
                    data-combo-picker-result
                    onClick={() => selectEntity(entity)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-yellow-500/20 hover:bg-yellow-500/10 focus-visible:border-yellow-400/40 focus-visible:bg-yellow-500/10 focus-visible:outline-none active:translate-y-0 motion-reduce:transform-none",
                      recentlyAdded?.id === entity.id && recentlyAdded.type === entity.type
                        ? "border-yellow-300/45 bg-yellow-500/15"
                        : "border-transparent",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/25">
                      {entity.imageUrl ? (
                        <Image
                          src={entity.imageUrl}
                          alt=""
                          width={34}
                          height={34}
                          className="max-h-8 max-w-8 object-contain"
                        />
                      ) : (
                        <span className="font-game-title text-sm font-bold text-yellow-200/70">
                          {entity.nameKo.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-zinc-200">
                        {entity.nameKo}
                      </span>
                      {entity.nameEn !== entity.nameKo && (
                        <span className="block truncate text-[10px] text-zinc-600">
                          {entity.nameEn}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[9px] text-zinc-600">
                      {recentlyAdded?.id === entity.id && recentlyAdded.type === entity.type ? (
                        <Check className="h-4 w-4 text-yellow-300" aria-hidden="true" />
                      ) : (
                        typeLabels[entity.type] ?? entity.type
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {hasMoreBrowseResults && (
              <p className="px-3 py-2 text-center text-[10px] text-zinc-600">
                {copy.refineResourceSearch}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
