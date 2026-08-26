"use client";

import { type RefObject, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ComboResourceAsset } from "@/components/combo/combo-resource-stack";
import {
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
  QUEST_FILTER_ICON,
  TOKEN_FILTER_ICON,
  CHARACTER_TOKEN_ICONS,
} from "@/components/codex/codex-filter-assets";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import { CHARACTER_COLORS } from "@/lib/codex-types";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import {
  CARD_AFFILIATION_MINORS,
  POTION_AFFILIATION_MINORS,
  RELIC_AFFILIATION_MINORS,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const GOLD = "#EFC851";
const PURPLE = "#c084fc";
const SEARCH_RESULT_LIMIT = 80;

const CARDS_NAV_ICON = "/images/sts2/nav/stats_cards.png";
const RELICS_NAV_ICON = "/images/sts2/relics/bing_bong.webp";
const POTIONS_NAV_ICON = "/images/sts2/potions/potion_shaped_rock.webp";

const CARD_EXTRA_ICONS: Record<string, string> = {
  colorless: COLORLESS_FILTER_ICON,
  token: TOKEN_FILTER_ICON,
  event: EVENT_FILTER_ICON,
  quest: QUEST_FILTER_ICON,
  curse: "/images/game-assets/card-library/filter_curse.webp",
  status: "/images/game-assets/card-library/filter_status.webp",
  ancient: "/images/sts2/ancients/neow.webp",
};

function chipColor(key: string): string {
  return CHARACTER_COLORS[key] ?? GOLD;
}

function RoundTypeChip({
  icon,
  color,
  label,
  pressed,
  onClick,
}: {
  icon: string;
  color: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border-2 p-0.5 transition-all",
          pressed
            ? "border-primary bg-primary/20"
            : "border-white/10 bg-white/5 hover:border-white/30",
        )}
      >
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{
            backgroundColor: `${color}33`,
            boxShadow: `inset 0 0 0 1.5px ${color}`,
          }}
        >
          <Image
            src={icon}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        </span>
      </button>
    </GameUiHoverTip>
  );
}

/** Compendium sidebar `IconFilterButton`: square, not a round type chip. */
function AffiliationChip({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          "relative h-9 w-9 rounded-lg border-2 transition-all",
          pressed
            ? "border-primary bg-primary/20"
            : "border-white/10 bg-white/5 hover:border-white/30",
        )}
      >
        <Image
          src={icon}
          alt=""
          width={28}
          height={28}
          className={cn(
            "h-full w-full object-contain p-0.5",
            pressed ? "" : "opacity-50",
          )}
        />
      </button>
    </GameUiHoverTip>
  );
}

function cardAffiliationIcon(key: string): string {
  return CARD_EXTRA_ICONS[key] ?? CHARACTER_TOKEN_ICONS[key] ?? CARDS_NAV_ICON;
}

function relicAffiliationIcon(key: string): string {
  if (key === "shared") return COLORLESS_FILTER_ICON;
  if (key === "event") return EVENT_FILTER_ICON;
  return CHARACTER_TOKEN_ICONS[key] ?? RELICS_NAV_ICON;
}

function potionAffiliationIcon(key: string): string {
  if (key === "shared") return COLORLESS_FILTER_ICON;
  if (key === "event") return EVENT_FILTER_ICON;
  return CHARACTER_TOKEN_ICONS[key] ?? POTIONS_NAV_ICON;
}

export function DecisionsDecisionsPoolPicker({
  entities,
  entityMap,
  serviceLocale,
  presetLabels,
  major,
  minors,
  searchInputRef,
  onMajor,
  onToggleMinor,
  onAdd,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  major: DecisionsPoolMajor | null;
  minors: ReadonlySet<string>;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onMajor: (major: DecisionsPoolMajor | null) => void;
  onToggleMinor: (minor: string) => void;
  onAdd: (entity: EntityInfo) => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const codex = serviceMessages[serviceLocale].codex;
  const pools = codex.labels.pools;
  const rarityDetails = codex.labels.rarityDetails;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const [query, setQuery] = useState("");

  const catalog = useMemo(
    () => entities.filter((entity) => (
      entity.type === "card" || entity.type === "relic" || entity.type === "potion"
    )),
    [entities],
  );

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return matchEntities(trimmed, catalog, SEARCH_RESULT_LIMIT);
  }, [query, catalog]);

  const affiliationChips = useMemo(() => {
    if (major === "card") {
      return CARD_AFFILIATION_MINORS.map((key) => ({
        key,
        icon: cardAffiliationIcon(key),
        label: key === "token" || key === "quest" || key === "ancient"
          ? rarityDetails[key]
          : (presetLabels[`cards-${key}`]
            ?? pools[key as keyof typeof pools]
            ?? rarityDetails[key as keyof typeof rarityDetails]
            ?? key),
      }));
    }
    if (major === "relic") {
      return RELIC_AFFILIATION_MINORS.map((key) => ({
        key,
        icon: relicAffiliationIcon(key),
        label: key === "event"
          ? (codex.labels.relicRarities["이벤트 유물"] ?? pools.event)
          : (presetLabels[`cards-${key}`]
            ?? presetLabels[`relics-${key}`]
            ?? pools[key as keyof typeof pools]
            ?? key),
      }));
    }
    if (major === "potion") {
      return POTION_AFFILIATION_MINORS.map((key) => ({
        key,
        icon: potionAffiliationIcon(key),
        label: presetLabels[`cards-${key}`]
          ?? presetLabels[`potions-${key}`]
          ?? pools[key as keyof typeof pools]
          ?? key,
      }));
    }
    return [];
  }, [codex.labels.relicRarities, major, pools, presetLabels, rarityDetails]);

  return (
    <div className="space-y-3" data-decisions-decisions-pool-picker>
      <div className="flex flex-wrap gap-1.5" data-decisions-decisions-filter-major>
        <RoundTypeChip
          icon={CARDS_NAV_ICON}
          color={GOLD}
          label={codex.cards}
          pressed={major === "card"}
          onClick={() => onMajor(major === "card" ? null : "card")}
        />
        <RoundTypeChip
          icon={RELICS_NAV_ICON}
          color={chipColor("gold")}
          label={codex.relics}
          pressed={major === "relic"}
          onClick={() => onMajor(major === "relic" ? null : "relic")}
        />
        <RoundTypeChip
          icon={POTIONS_NAV_ICON}
          color={PURPLE}
          label={codex.potions}
          pressed={major === "potion"}
          onClick={() => onMajor(major === "potion" ? null : "potion")}
        />
      </div>

      {affiliationChips.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          data-decisions-decisions-filter-minor
        >
          {affiliationChips.map((chip) => (
            <AffiliationChip
              key={chip.key}
              icon={chip.icon}
              label={chip.label}
              pressed={minors.has(chip.key)}
              onClick={() => onToggleMinor(chip.key)}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-popover/80">
        <div className="flex items-center gap-2 border-b border-border p-2.5">
          <Search className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {query.trim() && (
          <div className="max-h-72 overflow-y-auto p-2">
            {matches.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                {codex.common.noResults}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {matches.map((entity) => (
                  <button
                    key={`${entity.type}:${entity.id}`}
                    type="button"
                    onClick={() => {
                      onAdd(entity);
                      setQuery("");
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/10 focus-visible:border-primary/40 focus-visible:bg-primary/10 focus-visible:outline-none active:translate-y-0 motion-reduce:transform-none"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/25">
                      <span className="pointer-events-none origin-center scale-[0.7]">
                        <ComboResourceAsset
                          entity={entity}
                          entityMap={entityMap}
                          serviceLocale={serviceLocale}
                        />
                      </span>
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
                      {typeLabels[entity.type] ?? entity.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
