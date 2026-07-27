"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, Sparkles, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import type { ServiceLocale } from "@/lib/i18n";
import {
  getTransfigureSourceText,
  TRANSFIGURE_RESOURCE_TYPES,
} from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const BROWSE_RESULT_LIMIT = 48;
const SEARCH_RESULT_LIMIT = 80;

function getEntityTypeLabels(
  serviceLocale: ServiceLocale,
): Partial<Record<EntityType, string>> {
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
    ancient: codex.ancients,
    epoch: codex.epochs,
  };
}

interface TransfigureResourcePickerProps {
  entities: EntityInfo[];
  selected: EntityInfo | null;
  serviceLocale: ServiceLocale;
  defaultOpen?: boolean;
  onSelect: (entity: EntityInfo) => void;
}

export function TransfigureResourcePicker({
  entities,
  selected,
  serviceLocale,
  defaultOpen = false,
  onSelect,
}: TransfigureResourcePickerProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const commonCopy = serviceMessages[serviceLocale].codex.common;
  const typeLabels = getEntityTypeLabels(serviceLocale);
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntityType | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableTypes = useMemo(() => {
    const types = new Set(entities.map((entity) => entity.type));
    return TRANSFIGURE_RESOURCE_TYPES.filter((type) => types.has(type));
  }, [entities]);

  const scopedEntities = useMemo(() => {
    const scoped = activeType
      ? entities.filter((entity) => entity.type === activeType)
      : entities;
    return [...scoped].sort((left, right) => (
      left.nameKo.localeCompare(right.nameKo, "ko")
    ));
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

  const selectEntity = (entity: EntityInfo) => {
    onSelect(entity);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative" data-transfigure-resource-picker>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="transfigure-resource-picker-panel"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2.5 text-left transition-[border-color,background-color] hover:border-yellow-300/40 hover:bg-yellow-500/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/25">
          {selected?.imageUrl ? (
            <Image
              src={selected.imageUrl}
              alt=""
              width={38}
              height={38}
              className="max-h-9 max-w-9 object-contain"
            />
          ) : (
            <Sparkles className="h-5 w-5 text-yellow-200/80" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="spire-gold block text-xs font-semibold">
            {copy.selectResource}
          </span>
          <span className="block truncate text-sm text-zinc-400">
            {selected
              ? copy.reselectResource.replace("{name}", selected.nameKo)
              : copy.searchPlaceholder}
          </span>
        </span>
      </button>

      {open && (
        <div
          id="transfigure-resource-picker-panel"
          role="dialog"
          aria-label={copy.pickerLabel}
          className="relative z-10 mt-2 flex max-h-[min(34rem,70svh)] flex-col overflow-hidden rounded-xl border border-yellow-500/25 bg-[#080b14]/98 shadow-[0_18px_48px_rgba(0,0,0,0.58)]"
        >
          <div className="flex items-center gap-2 border-b border-white/10 p-2.5">
            <Search className="h-4 w-4 shrink-0 text-yellow-200/70" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
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
              onClick={() => setActiveType(null)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                activeType == null
                  ? "border-yellow-300/40 bg-yellow-500/15 text-yellow-100"
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
                onClick={() => setActiveType(type)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  activeType === type
                    ? "border-yellow-300/40 bg-yellow-500/15 text-yellow-100"
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
                {results.map((entity) => {
                  const isSelected = (
                    selected?.id === entity.id && selected.type === entity.type
                  );
                  return (
                    <button
                      key={`${entity.type}:${entity.id}`}
                      type="button"
                      role="listitem"
                      onClick={() => selectEntity(entity)}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-yellow-400/25 hover:bg-yellow-500/10 focus-visible:border-yellow-300/50 focus-visible:bg-yellow-500/10 focus-visible:outline-none active:translate-y-0 motion-reduce:transform-none",
                        isSelected
                          ? "border-yellow-300/45 bg-yellow-500/15"
                          : "border-transparent",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/25">
                        {entity.imageUrl ? (
                          <Image
                            src={entity.imageUrl}
                            alt=""
                            width={36}
                            height={36}
                            className="max-h-9 max-w-9 object-contain"
                          />
                        ) : (
                          <span className="font-game-title text-sm font-bold text-yellow-100/70">
                            {entity.nameKo.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-zinc-200">
                          {entity.nameKo}
                        </span>
                        <span className="block truncate text-[10px] text-zinc-600">
                          {getTransfigureSourceText(entity)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[9px] text-zinc-600">
                        {isSelected ? (
                          <Check className="h-4 w-4 text-yellow-200" aria-hidden="true" />
                        ) : (
                          typeLabels[entity.type] ?? entity.type
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {hasMoreBrowseResults && (
              <p className="px-3 py-2 text-center text-[10px] text-zinc-600">
                {copy.refineSearch}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
