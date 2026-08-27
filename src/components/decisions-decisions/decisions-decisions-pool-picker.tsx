"use client";

import { type ReactNode, type RefObject, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ComboResourceAsset } from "@/components/combo/combo-resource-stack";
import { getEpochAffiliationLabel } from "@/components/codex/epoch-display";
import {
  CARD_TYPE_FILTER_ICONS,
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
  QUEST_FILTER_ICON,
  TOKEN_FILTER_ICON,
  CHARACTER_TOKEN_ICONS,
  getCardTypeFilterIcon,
} from "@/components/codex/codex-filter-assets";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  ENCHANTMENT_CARD_TYPE_CONFIG,
  MONSTER_TYPE_CONFIG,
  POTION_RARITY_CONFIG,
  POWER_TYPE_CONFIG,
  RELIC_RARITY_COLORS,
} from "@/lib/codex-types";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import {
  ACT_MINORS,
  CARD_AFFILIATION_MINORS,
  CARD_KIND_MINORS,
  CARD_RARITY_MINORS,
  ENCHANTMENT_KIND_MINORS,
  EPOCH_AFFILIATION_MINORS,
  KEYWORD_KIND_MINORS,
  MODIFIER_KIND_MINORS,
  MONSTER_KIND_MINORS,
  namedPresetDefs,
  POTION_AFFILIATION_MINORS,
  POTION_RARITY_MINORS,
  POWER_KIND_MINORS,
  RELIC_AFFILIATION_MINORS,
  RELIC_RARITY_MINORS,
  isDecisionsDecisionsResourceType,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import type { ServiceLocale } from "@/lib/i18n";
import { sts2NavItems } from "@/lib/site-nav-items";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const GOLD = "#EFC851";
const PURPLE = "#c084fc";
const ACT_COLOR = "#60a5fa";
const SEARCH_RESULT_LIMIT = 80;

const CARD_RARITY_COLORS: Record<string, string> = {
  일반: "#b0b0b0",
  고급: "#4fc3f7",
  희귀: "#ffd740",
  기타: "#81c784",
};

const CARD_EXTRA_ICONS: Record<string, string> = {
  colorless: COLORLESS_FILTER_ICON,
  token: TOKEN_FILTER_ICON,
  event: EVENT_FILTER_ICON,
  quest: QUEST_FILTER_ICON,
  curse: "/images/game-assets/card-library/filter_curse.webp",
  status: "/images/game-assets/card-library/filter_status.webp",
  ancient: "/images/sts2/ancients/neow.webp",
};

const EPOCH_AFFILIATION_ICONS: Record<string, string> = {
  ironclad: CHARACTER_TOKEN_ICONS.ironclad,
  silent: CHARACTER_TOKEN_ICONS.silent,
  regent: CHARACTER_TOKEN_ICONS.regent,
  necrobinder: CHARACTER_TOKEN_ICONS.necrobinder,
  defect: CHARACTER_TOKEN_ICONS.defect,
  neow: "/images/sts2/run-history/neow.png",
  darv: "/images/sts2/run-history/darv.png",
  orobas: "/images/sts2/run-history/orobas.png",
  pael: "/images/sts2/run-history/pael.png",
  tanx: "/images/sts2/run-history/tanx.png",
  tezcatara: "/images/sts2/run-history/tezcatara.png",
  nonupeipe: "/images/sts2/run-history/nonupeipe.png",
  vakuu: "/images/sts2/run-history/vakuu.png",
  world: "/images/sts2/icons/app_icon.png",
  spire: "/images/sts2/relics/storybook.webp",
  reopening: "/images/sts2/relics/new_leaf.webp",
  unknown: EVENT_FILTER_ICON,
};

const KEYWORD_SOURCE_COLORS: Record<string, string> = {
  cardKeyword: "#efc851",
  staticHoverTip: "#7dd3fc",
};

const NAV_TYPE_BY_HREF: Record<string, DecisionsPoolMajor> = {
  "/compendium/characters": "character",
  "/compendium/cards": "card",
  "/compendium/relics": "relic",
  "/compendium/potions": "potion",
  "/compendium/powers": "power",
  "/compendium/enchantments": "enchantment",
  "/compendium/bestiary": "monster",
  "/compendium/events": "event",
  "/compendium/ancients": "ancient",
  "/compendium/epochs": "epoch",
  "/compendium/keywords": "keyword",
  "/compendium/ascensions": "ascension",
  "/compendium/modifiers": "modifier",
};

const TYPE_CHIPS = sts2NavItems.flatMap((item) => {
  const type = NAV_TYPE_BY_HREF[item.href];
  if (!type || !isDecisionsDecisionsResourceType(type)) return [];
  return [{
    type,
    icon: item.icon,
    iconClassName: "iconClassName" in item ? item.iconClassName : undefined,
  }];
});

function chipColor(type: DecisionsPoolMajor): string {
  return type === "potion" ? PURPLE : GOLD;
}

function RoundTypeChip({
  icon,
  iconClassName,
  color,
  label,
  pressed,
  onClick,
}: {
  icon: string;
  iconClassName?: string;
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
            className={cn("h-5 w-5 object-contain", iconClassName)}
          />
        </span>
      </button>
    </GameUiHoverTip>
  );
}

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

function DotChip({
  color,
  label,
  pressed,
  onClick,
}: {
  color: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border-2 px-2 text-[11px] font-semibold transition-all",
        pressed
          ? "border-primary bg-primary/20 text-primary"
          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30",
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </button>
  );
}

function cardAffiliationIcon(key: string): string {
  return CARD_EXTRA_ICONS[key] ?? CHARACTER_TOKEN_ICONS[key] ?? CARD_TYPE_FILTER_ICONS["공격"];
}

function relicAffiliationIcon(key: string): string {
  if (key === "shared") return COLORLESS_FILTER_ICON;
  if (key === "event") return EVENT_FILTER_ICON;
  return CHARACTER_TOKEN_ICONS[key] ?? "/images/sts2/relics/bing_bong.webp";
}

function potionAffiliationIcon(key: string): string {
  if (key === "shared") return COLORLESS_FILTER_ICON;
  if (key === "event") return EVENT_FILTER_ICON;
  return CHARACTER_TOKEN_ICONS[key] ?? "/images/sts2/potions/potion_shaped_rock.webp";
}

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-decisions-decisions-filter-minor>
      {children}
    </div>
  );
}

export function DecisionsDecisionsPoolPicker({
  entities,
  entityMap,
  serviceLocale,
  presetLabels,
  major,
  dims,
  searchInputRef,
  onMajor,
  onToggleDim,
  onPreset,
  onAdd,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  major: DecisionsPoolMajor | null;
  dims: DecisionsFilterDims;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onMajor: (major: DecisionsPoolMajor | null) => void;
  onToggleDim: (dim: DecisionsFilterDim, key: string) => void;
  onPreset: (key: string) => void;
  onAdd: (entity: EntityInfo) => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const codex = serviceMessages[serviceLocale].codex;
  const pools = codex.labels.pools;
  const rarityDetails = codex.labels.rarityDetails;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const [query, setQuery] = useState("");

  const catalog = useMemo(
    () => entities.filter((entity) => isDecisionsDecisionsResourceType(entity.type)),
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
    if (major === "epoch") {
      const serviceText = getCodexServiceMessages(serviceLocale);
      return EPOCH_AFFILIATION_MINORS.map((key) => ({
        key,
        icon: EPOCH_AFFILIATION_ICONS[key] ?? EVENT_FILTER_ICON,
        label: getEpochAffiliationLabel(key, serviceText, serviceLocale),
      }));
    }
    return [];
  }, [codex.labels.relicRarities, major, pools, presetLabels, rarityDetails, serviceLocale]);

  const keywordSourceLabels = serviceLocale === "ko"
    ? { cardKeyword: "카드 키워드", staticHoverTip: "툴팁 키워드" }
    : { cardKeyword: "Card keyword", staticHoverTip: "Hover tip" };

  return (
    <div className="space-y-3" data-decisions-decisions-pool-picker>
      <div
        className="flex flex-wrap gap-1.5"
        data-decisions-decisions-presets
      >
        {namedPresetDefs().map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onPreset(preset.key)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            {presetLabels[preset.key] ?? preset.key}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-popover/80 p-2.5">
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
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
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

      <div className="flex flex-wrap gap-1.5" data-decisions-decisions-filter-major>
        {TYPE_CHIPS.map((chip) => (
          <RoundTypeChip
            key={chip.type}
            icon={chip.icon}
            iconClassName={chip.iconClassName}
            color={chipColor(chip.type)}
            label={typeLabels[chip.type] ?? chip.type}
            pressed={major === chip.type}
            onClick={() => onMajor(major === chip.type ? null : chip.type)}
          />
        ))}
      </div>

      {affiliationChips.length > 0 && (
        <ChipRow>
          {affiliationChips.map((chip) => (
            <AffiliationChip
              key={chip.key}
              icon={chip.icon}
              label={chip.label}
              pressed={dims.affiliation.has(chip.key)}
              onClick={() => onToggleDim("affiliation", chip.key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "card" && (
        <>
          <ChipRow>
            {CARD_KIND_MINORS.map((key) => (
              <AffiliationChip
                key={key}
                icon={getCardTypeFilterIcon(key)}
                label={codex.labels.cardTypes[key]}
                pressed={dims.kind.has(key)}
                onClick={() => onToggleDim("kind", key)}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {CARD_RARITY_MINORS.map((key) => (
              <DotChip
                key={key}
                color={CARD_RARITY_COLORS[key] ?? GOLD}
                label={codex.labels.cardRarities[key]}
                pressed={dims.rarity.has(key)}
                onClick={() => onToggleDim("rarity", key)}
              />
            ))}
          </ChipRow>
        </>
      )}

      {major === "relic" && (
        <ChipRow>
          {RELIC_RARITY_MINORS.map((key) => (
            <DotChip
              key={key}
              color={RELIC_RARITY_COLORS[key]}
              label={codex.labels.relicRarities[key]}
              pressed={dims.rarity.has(key)}
              onClick={() => onToggleDim("rarity", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "potion" && (
        <ChipRow>
          {POTION_RARITY_MINORS.map((key) => (
            <DotChip
              key={key}
              color={POTION_RARITY_CONFIG[key].color}
              label={codex.labels.potionRarities[key]}
              pressed={dims.rarity.has(key)}
              onClick={() => onToggleDim("rarity", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "power" && (
        <ChipRow>
          {POWER_KIND_MINORS.map((key) => (
            <DotChip
              key={key}
              color={POWER_TYPE_CONFIG[key].color}
              label={codex.labels.powerTypes[key].label}
              pressed={dims.kind.has(key)}
              onClick={() => onToggleDim("kind", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "enchantment" && (
        <ChipRow>
          {ENCHANTMENT_KIND_MINORS.map((key) => (
            <DotChip
              key={key}
              color={ENCHANTMENT_CARD_TYPE_CONFIG[key].color}
              label={codex.labels.enchantmentCardTypes[key].label}
              pressed={dims.kind.has(key)}
              onClick={() => onToggleDim("kind", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "monster" && (
        <>
          <ChipRow>
            {MONSTER_KIND_MINORS.map((key) => (
              <DotChip
                key={key}
                color={MONSTER_TYPE_CONFIG[key].color}
                label={codex.monstersView.monsterTypes[key].label}
                pressed={dims.kind.has(key)}
                onClick={() => onToggleDim("kind", key)}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {ACT_MINORS.map((key) => (
              <DotChip
                key={key}
                color={key === "none" ? "#a1a1aa" : ACT_COLOR}
                label={codex.labels.acts[key as keyof typeof codex.labels.acts] ?? key}
                pressed={dims.act.has(key)}
                onClick={() => onToggleDim("act", key)}
              />
            ))}
          </ChipRow>
        </>
      )}

      {(major === "event" || major === "ancient") && (
        <ChipRow>
          {ACT_MINORS.map((key) => (
            <DotChip
              key={key}
              color={key === "none" ? "#a1a1aa" : ACT_COLOR}
              label={codex.labels.acts[key as keyof typeof codex.labels.acts] ?? key}
              pressed={dims.act.has(key)}
              onClick={() => onToggleDim("act", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "keyword" && (
        <ChipRow>
          {KEYWORD_KIND_MINORS.map((key) => (
            <DotChip
              key={key}
              color={KEYWORD_SOURCE_COLORS[key] ?? GOLD}
              label={keywordSourceLabels[key]}
              pressed={dims.kind.has(key)}
              onClick={() => onToggleDim("kind", key)}
            />
          ))}
        </ChipRow>
      )}

      {major === "modifier" && (
        <ChipRow>
          {MODIFIER_KIND_MINORS.map((key) => (
            <DotChip
              key={key}
              color={key === "good" ? "#7fff00" : "#ff5555"}
              label={codex.modifiersView[key === "good" ? "positive" : "negative"]}
              pressed={dims.kind.has(key)}
              onClick={() => onToggleDim("kind", key)}
            />
          ))}
        </ChipRow>
      )}
    </div>
  );
}
