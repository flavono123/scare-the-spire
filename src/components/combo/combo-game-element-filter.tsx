"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { matchEntities } from "@/lib/chemical-utils";
import {
  comboResourceKey,
  type ComboPost,
  type ComboResourceRef,
} from "@/lib/combo-types";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";
import { ComboResourceAsset } from "./combo-resource-stack";

const GAME_ELEMENT_TYPE_ORDER = [
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

function getGameElementTypeLabels(
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
    monster: codex.monsters,
    encounter: codex.encounters,
    ancient: codex.ancients,
    epoch: codex.epochs,
  };
}

interface ComboGameElementFilterProps {
  entities: EntityInfo[];
  posts: ComboPost[];
  selected: ComboResourceRef[];
  serviceLocale: ServiceLocale;
  onSelectedChange: (selected: ComboResourceRef[]) => void;
}

export function ComboGameElementFilter({
  entities,
  posts,
  selected,
  serviceLocale,
  onSelectedChange,
}: ComboGameElementFilterProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const commonCopy = serviceMessages[serviceLocale].codex.common;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntityType | null>(null);
  const typeLabels = getGameElementTypeLabels(serviceLocale);

  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [
      `${entity.type}:${entity.id}`,
      entity,
    ])),
    [entities],
  );
  const referencedKeys = useMemo(
    () => new Set(posts.flatMap((post) => post.resources.map(comboResourceKey))),
    [posts],
  );
  const selectedKeys = useMemo(
    () => new Set(selected.map(comboResourceKey)),
    [selected],
  );
  const availableTypes = useMemo(() => {
    const types = new Set(entities.map((entity) => entity.type));
    return GAME_ELEMENT_TYPE_ORDER.filter((type) => types.has(type));
  }, [entities]);

  const normalizedQuery = query.trim();
  const scopedEntities = useMemo(
    () => activeType
      ? entities.filter((entity) => entity.type === activeType)
      : entities,
    [activeType, entities],
  );
  const results = useMemo(() => {
    const matches = normalizedQuery
      ? matchEntities(normalizedQuery, scopedEntities, 80)
      : scopedEntities.filter((entity) => referencedKeys.has(`${entity.type}:${entity.id}`));

    return [...matches].sort((left, right) => {
      const leftSelected = selectedKeys.has(`${left.type}:${left.id}`);
      const rightSelected = selectedKeys.has(`${right.type}:${right.id}`);
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      const leftName = serviceLocale === "en" ? left.nameEn : left.nameKo;
      const rightName = serviceLocale === "en" ? right.nameEn : right.nameKo;
      return leftName.localeCompare(rightName);
    });
  }, [
    normalizedQuery,
    referencedKeys,
    scopedEntities,
    selectedKeys,
    serviceLocale,
  ]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;
    if (mobileQuery.matches) document.body.style.overflow = "hidden";

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggleEntity = (entity: EntityInfo) => {
    const reference: ComboResourceRef = { type: entity.type, id: entity.id };
    const key = comboResourceKey(reference);
    onSelectedChange(
      selectedKeys.has(key)
        ? selected.filter((item) => comboResourceKey(item) !== key)
        : [...selected, reference],
    );
  };

  const openPanel = () => {
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="relative space-y-2" data-combo-game-element-filter>
      <div className="flex min-w-0 items-center rounded-xl border border-white/10 bg-black/25 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.18)] transition-colors focus-within:border-yellow-500/25">
        <Search className="ml-2.5 h-4 w-4 shrink-0 text-yellow-300/60" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={copy.filterSearchPlaceholder}
          aria-label={copy.filterSearchPlaceholder}
          aria-controls="combo-game-element-filter-panel"
          className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="combo-game-element-filter-panel"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              openPanel();
            }
          }}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-[border-color,background-color,color] sm:px-3",
            open || selected.length > 0
              ? "border-yellow-400/30 bg-yellow-500/10 text-yellow-200"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden min-[390px]:inline">{copy.browseGameElements}</span>
          {selected.length > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-yellow-300/15 px-1.5 py-0.5 text-[10px] text-yellow-100">
              {selected.length}
            </span>
          )}
        </button>
      </div>

      {selected.length > 0 && (
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          aria-label={copy.selectedGameElements.replace("{count}", String(selected.length))}
        >
          {selected.map((reference) => {
            const key = comboResourceKey(reference);
            const entity = entityMap.get(key);
            const name = entity
              ? (serviceLocale === "en" ? entity.nameEn : entity.nameKo)
              : reference.id;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectedChange(
                  selected.filter((item) => comboResourceKey(item) !== key),
                )}
                className="group/chip inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-500/[0.08] pl-2 pr-1.5 text-[11px] font-semibold text-yellow-100 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
                title={copy.removeGameElement.replace("{name}", name)}
              >
                <span className="max-w-28 truncate">{name}</span>
                <X className="h-3 w-3 opacity-60 transition-opacity group-hover/chip:opacity-100" aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            className="h-8 shrink-0 px-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {copy.clearGameElements}
          </button>
        </div>
      )}

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px] sm:hidden"
            onClick={() => setOpen(false)}
            aria-label={commonCopy.close}
          />
          <div
            id="combo-game-element-filter-panel"
            role="dialog"
            aria-label={copy.gameElementFilterLabel}
            data-combo-game-element-filter-panel
            className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[78svh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-yellow-500/25 bg-[#080810] shadow-[0_-18px_60px_rgba(0,0,0,0.65)] sm:absolute sm:inset-auto sm:left-0 sm:right-0 sm:top-full sm:z-40 sm:mt-2 sm:max-h-[28rem] sm:rounded-xl sm:border-b sm:shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4">
              <div>
                <h2 className="text-xs font-semibold text-yellow-100">
                  {copy.gameElementFilterLabel}
                </h2>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {normalizedQuery ? copy.gameElementSearchResults : copy.gameElementsInPosts}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label={commonCopy.close}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
              <button
                type="button"
                aria-pressed={activeType == null}
                onClick={() => setActiveType(null)}
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
                  onClick={() => setActiveType(type)}
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

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {results.length === 0 ? (
                <p className="px-3 py-12 text-center text-xs text-zinc-600">
                  {commonCopy.noResults}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 min-[390px]:grid-cols-4 sm:grid-cols-6">
                  {results.map((entity) => {
                    const key = `${entity.type}:${entity.id}`;
                    const isSelected = selectedKeys.has(key);
                    const name = serviceLocale === "en" ? entity.nameEn : entity.nameKo;

                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleEntity(entity)}
                        className={cn(
                          "group/token relative flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-[transform,border-color,background-color,filter] duration-150 hover:-translate-y-0.5 hover:border-yellow-400/30 hover:bg-yellow-500/[0.08] hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70 active:translate-y-0 motion-reduce:transform-none",
                          isSelected
                            ? "border-yellow-300/45 bg-yellow-500/15"
                            : "border-transparent bg-white/[0.02]",
                        )}
                      >
                        <span className="relative flex h-12 w-14 items-center justify-center">
                          <ComboResourceAsset
                            entity={entity}
                            serviceLocale={serviceLocale}
                          />
                          {isSelected && (
                            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-300 text-black shadow-[0_0_8px_rgba(253,224,71,0.6)]">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </span>
                        <span className="w-full truncate text-[10px] font-semibold text-zinc-300">
                          {name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
