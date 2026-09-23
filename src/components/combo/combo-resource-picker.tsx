"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GameScrollArea } from "@/components/game-scroll-area";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
import { SearchBar } from "@/components/codex/search-bar";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import { useCardConLocale } from "@/hooks/use-card-con-locale";
import { useGameLocale } from "@/hooks/use-game-locale";
import { applyCardConLocale } from "@/lib/card-con-locale";
import {
  CARD_CON_BROWSE_LIMIT,
  CARD_CON_PICKER_TILE_CLASS,
  CARD_CON_SEARCH_LIMIT,
} from "@/lib/card-con";
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

interface ComboResourcePickerProps {
  entities: EntityInfo[];
  serviceLocale: ServiceLocale;
  onSelect: (entity: EntityInfo) => void;
  secondaryAction?: ReactNode;
  /** Paint card matches as CardTiles and hide the type chips. */
  cardTiles?: boolean;
  /** Always show the result panel. Hides the combo trigger row. */
  embedded?: boolean;
  searchPlaceholder?: string;
  panelLabel?: string;
}

export function ComboResourcePicker({
  entities,
  serviceLocale,
  onSelect,
  secondaryAction,
  cardTiles = false,
  embedded = false,
  searchPlaceholder,
  panelLabel,
}: ComboResourcePickerProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const gameLocale = useGameLocale();
  const cardLocale = useCardConLocale(cardTiles ? gameLocale : "kor");
  const commonCopy = serviceMessages[serviceLocale].codex.common;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const [openState, setOpenState] = useState(false);
  const open = embedded || openState;
  const setOpen = setOpenState;
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<EntityType | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<EntityInfo | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const sourceEntities = useMemo(
    () => cardTiles
      ? entities.filter((entity) => entity.type === "card" && entity.cardData)
      : entities,
    [cardTiles, entities],
  );

  const availableTypes = useMemo(() => {
    const types = new Set(sourceEntities.map((entity) => entity.type));
    return PICKER_TYPE_ORDER.filter((type) => types.has(type));
  }, [sourceEntities]);

  const scopedEntities = useMemo(() => {
    const scoped = !cardTiles && activeType
      ? sourceEntities.filter((entity) => entity.type === activeType)
      : sourceEntities;
    return [...scoped].sort((left, right) => left.nameKo.localeCompare(right.nameKo));
  }, [activeType, cardTiles, sourceEntities]);

  const browseLimit = cardTiles ? CARD_CON_BROWSE_LIMIT : BROWSE_RESULT_LIMIT;
  const searchLimit = cardTiles ? CARD_CON_SEARCH_LIMIT : SEARCH_RESULT_LIMIT;
  const normalizedQuery = query.trim();
  const results = useMemo(
    () => normalizedQuery
      ? matchEntities(normalizedQuery, scopedEntities, searchLimit)
      : scopedEntities.slice(0, browseLimit),
    [browseLimit, normalizedQuery, scopedEntities, searchLimit],
  );
  const hasMoreBrowseResults = !normalizedQuery && scopedEntities.length > results.length;
  const [hintBeforeKeyword, hintAfterKeyword] = copy.composerHint.split("{keyword}");

  useEffect(() => {
    if (!open) return;

    searchInputRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenState(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenState(false);
    };

    if (embedded) return;

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [embedded, open]);

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

  const resolvedSearchPlaceholder = searchPlaceholder ?? copy.resourceSearchPlaceholder;

  return (
    <div ref={rootRef} className={cn("min-w-0 flex-1", embedded && "flex min-h-0 flex-col")} data-combo-resource-picker>
      {!embedded && (
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="combo-resource-picker-panel"
            data-combo-picker-trigger
            onClick={() => setOpen((current) => !current)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/15 active:translate-y-0 motion-reduce:transform-none"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.addResource}
          </button>
          {secondaryAction}
        </div>
        <p className="col-span-2 row-start-2 min-w-0 text-xs leading-relaxed text-zinc-500 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {hintBeforeKeyword}
          <KeywordHoverTip
            title={copy.composerHintKeyword}
            description={copy.composerHintKeywordDescription}
            className="opacity-70 hover:opacity-100 focus-visible:opacity-100"
          >
            {copy.composerHintKeyword}
          </KeywordHoverTip>
          {hintAfterKeyword}
        </p>
        <span
          aria-live="polite"
          className="col-start-2 row-start-1 inline-flex min-h-5 min-w-0 items-center justify-self-end text-[11px] font-semibold text-primary sm:col-start-3"
        >
          {recentlyAdded && (
            <span
              key={`${recentlyAdded.type}:${recentlyAdded.id}`}
              className="inline-flex min-w-0 items-center gap-1 motion-safe:animate-pulse"
              data-combo-picker-feedback
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {copy.resourceAdded.replace("{name}", recentlyAdded.nameKo)}
              </span>
            </span>
          )}
        </span>
      </div>
      )}

      {open && (
        <div
          id={embedded ? undefined : "combo-resource-picker-panel"}
          role={embedded ? undefined : "dialog"}
          aria-label={panelLabel ?? copy.resourcePickerLabel}
          data-combo-picker-panel={embedded ? undefined : ""}
          data-card-con-picker={cardTiles ? "" : undefined}
          className={cn(
            "flex w-full min-h-0 flex-col overflow-hidden",
            cardTiles
              ? "h-[min(22rem,52dvh)]"
              : "mt-2 max-h-72 rounded-xl border border-border bg-popover shadow-lg",
            embedded ? "mt-3" : "",
          )}
        >
          {cardTiles ? (
            <div className="shrink-0 pb-2">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder={resolvedSearchPlaceholder}
                ariaLabel={resolvedSearchPlaceholder}
                inputRef={searchInputRef}
                autoFocus={open}
              />
            </div>
          ) : (
          <div className="flex items-center gap-2 border-b border-border p-2.5">
            <Search className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={resolvedSearchPlaceholder}
              aria-label={resolvedSearchPlaceholder}
              data-combo-picker-search
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={commonCopy.close}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          )}

          {!cardTiles && (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2.5 py-2">
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
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-border hover:text-foreground",
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
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {typeLabels[type] ?? type}
              </button>
            ))}
          </div>
          )}

          <GameScrollArea className="min-h-0 flex-1" size="small" scrollerClassName={cardTiles ? "px-1 py-1" : "p-2"}>
            <div role="list">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                {commonCopy.noResults}
              </p>
            ) : cardTiles ? (
              <div className="grid grid-cols-3 gap-x-3 gap-y-4">
                {results.map((entity) => (
                  entity.cardData ? (
                    <button
                      key={entity.id}
                      type="button"
                      role="listitem"
                      data-card-con-result={entity.id}
                      aria-label={applyCardConLocale(entity.cardData, cardLocale?.[entity.id]).name}
                      onClick={() => selectEntity(entity)}
                      className="mx-auto w-full max-w-[7.5rem] rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className={cn("block", CARD_CON_PICKER_TILE_CLASS)}>
                        <FittedCardTile
                          card={applyCardConLocale(entity.cardData, cardLocale?.[entity.id])}
                          serviceLocale={serviceLocale}
                          showUpgrade={false}
                          showBeta={false}
                          interactive={false}
                        />
                      </span>
                    </button>
                  ) : null
                ))}
              </div>
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
                      "flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/10 focus-visible:border-primary/40 focus-visible:bg-primary/10 focus-visible:outline-none active:translate-y-0 motion-reduce:transform-none",
                      recentlyAdded?.id === entity.id && recentlyAdded.type === entity.type
                        ? "border-primary/45 bg-primary/15"
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
                        <span className="font-game-title text-sm font-bold text-primary/70">
                          {entity.nameKo.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {entity.nameKo}
                      </span>
                      {entity.nameEn !== entity.nameKo && (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {entity.nameEn}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {recentlyAdded?.id === entity.id && recentlyAdded.type === entity.type ? (
                        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                      ) : (
                        typeLabels[entity.type] ?? entity.type
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {hasMoreBrowseResults && (
              <p className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                {copy.refineResourceSearch}
              </p>
            )}
            </div>
          </GameScrollArea>
        </div>
      )}
    </div>
  );
}
