"use client";

import { type ReactNode, type RefObject, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
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
  CHARACTER_COLORS,
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
  type DecisionsDecisionsPresetDef,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import { decisionsPresetLabel } from "@/lib/decisions-preset-label";
import type { ServiceLocale } from "@/lib/i18n";
import { sts2NavItems } from "@/lib/site-nav-items";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const CARD_COLLECTION_ICON = "/images/sts2/nav/stats_cards.png";
const RELIC_COLLECTION_ICON = "/images/sts2/relics/bing_bong.webp";
const POTION_COLLECTION_ICON = "/images/sts2/potions/potion_shaped_rock.webp";
const ANCIENT_TOKEN_ICON = "/images/sts2/ancients/neow.webp";
const MONSTER_TYPE_ICON = "/images/sts2/nav/happy_cultist.png";
const MAP_ELITE_ICON = "/images/sts2/map/icons/map_elite.png";
const OVERGROWTH_ELITE_ICON = "/images/sts2/map/icons-by-act/overgrowth/map_elite.png";
const UNDERDOCKS_ELITE_ICON = "/images/sts2/map/icons-by-act/underdocks/map_elite.png";
const ANCIENT_ACCENT = "#60a5fa";
const PRESET_FAN_COUNT = 3;
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

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-service text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-service text-[11px] font-semibold text-zinc-500">
      {children}
    </p>
  );
}

function ComboStyleStack({ lead, trail }: { lead: string; trail: string }) {
  return (
    <span className="relative block h-8 w-10 shrink-0" aria-hidden>
      <Image
        src={lead}
        alt=""
        width={32}
        height={32}
        className="absolute left-0 top-0 z-10 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
      <Image
        src={trail}
        alt=""
        width={32}
        height={32}
        className="absolute left-2.5 top-0 z-20 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
    </span>
  );
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    next.push(url);
  }
  return next;
}

function shuffleTake<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = pool[index];
    const other = pool[swap];
    if (current === undefined || other === undefined) continue;
    pool[index] = other;
    pool[swap] = current;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function sampleAncientTokenUrls(entities: EntityInfo[]): string[] {
  return shuffleTake(
    uniqueUrls(entities.map((entity) => (
      entity.type === "ancient"
        ? entity.ancientData?.imageUrl ?? entity.imageUrl
        : null
    ))),
    PRESET_FAN_COUNT,
  );
}

function sampleBossTokenUrls(entities: EntityInfo[]): string[] {
  return shuffleTake(
    uniqueUrls(entities.map((entity) => (
      entity.type === "monster" ? entity.monsterData?.bossImageUrl : null
    ))),
    PRESET_FAN_COUNT,
  );
}

function TypeTokenFan({
  typeSrc,
  overlaySrcs,
}: {
  typeSrc: string;
  overlaySrcs: string[];
}) {
  const overlays = overlaySrcs.slice(0, PRESET_FAN_COUNT);
  return (
    <span
      className="relative block h-8 shrink-0"
      style={{ width: `${28 + Math.max(overlays.length, 1) * 10}px` }}
      aria-hidden
    >
      <Image
        src={typeSrc}
        alt=""
        width={28}
        height={28}
        className="absolute left-0 top-1 z-0 h-7 w-7 object-contain opacity-90 drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
      {overlays.map((src, index) => (
        <Image
          key={`${src}-${index}`}
          src={src}
          alt=""
          width={32}
          height={32}
          className="absolute top-0 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
          style={{ left: `${8 + index * 10}px`, zIndex: 10 + index }}
        />
      ))}
    </span>
  );
}

function ComboPresetJump({
  presetKey,
  lead,
  trail,
  accent,
  label,
  onClick,
}: {
  presetKey: string;
  lead: string;
  trail: string;
  accent?: string;
  label: string;
  onClick: () => void;
}) {
  return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        data-decisions-decisions-preset-jump={presetKey}
        className={cn(
          "group/preset relative inline-flex items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 py-1.5 pl-2 pr-2",
          "text-[11px] font-semibold text-primary shadow-[0_0_14px_rgba(239,200,81,0.05)]",
          "transition-[transform,border-color,background-color,box-shadow] duration-200",
          "hover:-translate-y-0.5 hover:border-primary/55 hover:bg-primary/15 hover:shadow-[0_6px_18px_rgba(239,200,81,0.1)]",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
          "active:translate-y-0 motion-reduce:transform-none",
        )}
      >
        {accent ? (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        <ComboStyleStack lead={lead} trail={trail} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 opacity-80 transition-transform duration-200 group-hover/preset:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
  );
}

function FanPresetJump({
  presetKey,
  typeSrc,
  overlaySrcs,
  accent,
  label,
  onClick,
}: {
  presetKey: string;
  typeSrc: string;
  overlaySrcs: string[];
  accent?: string;
  label: string;
  onClick: () => void;
}) {
  return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        data-decisions-decisions-preset-jump={presetKey}
        className={cn(
          "group/preset relative inline-flex items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 py-1.5 pl-2 pr-2",
          "text-[11px] font-semibold text-primary shadow-[0_0_14px_rgba(239,200,81,0.05)]",
          "transition-[transform,border-color,background-color,box-shadow] duration-200",
          "hover:-translate-y-0.5 hover:border-primary/55 hover:bg-primary/15 hover:shadow-[0_6px_18px_rgba(239,200,81,0.1)]",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
          "active:translate-y-0 motion-reduce:transform-none",
        )}
      >
        {accent ? (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
        <TypeTokenFan typeSrc={typeSrc} overlaySrcs={overlaySrcs} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 opacity-80 transition-transform duration-200 group-hover/preset:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
  );
}

function CardPresetJump({
  preset,
  label,
  onClick,
}: {
  preset: Extract<DecisionsDecisionsPresetDef, { kind: "cards" }>;
  label: string;
  onClick: () => void;
}) {
  const trail = preset.color === "colorless"
    ? COLORLESS_FILTER_ICON
    : CHARACTER_TOKEN_ICONS[preset.color];
  return (
    <ComboPresetJump
      presetKey={preset.key}
      lead={CARD_COLLECTION_ICON}
      trail={trail ?? COLORLESS_FILTER_ICON}
      accent={CHARACTER_COLORS[preset.color]}
      label={label}
      onClick={onClick}
    />
  );
}

function CatalogPresetJump({
  presetKey,
  icon,
  label,
  onClick,
}: {
  presetKey: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        data-decisions-decisions-preset-jump={presetKey}
        className={cn(
          "group/catalog inline-flex h-11 items-center gap-2 rounded-lg border border-primary/50 bg-primary/15 px-3",
          "text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.1)]",
          "transition-[transform,border-color,background-color,box-shadow] duration-200",
          "hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/20 hover:shadow-[0_8px_22px_rgba(239,200,81,0.14)]",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
          "active:translate-y-0 motion-reduce:transform-none",
        )}
      >
        <Image src={icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronRight
          className="h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 group-hover/catalog:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
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
  showPresets = true,
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
  onPreset?: (key: string) => void;
  onAdd: (entity: EntityInfo) => void;
  showPresets?: boolean;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const codex = serviceMessages[serviceLocale].codex;
  const pools = codex.labels.pools;
  const rarityDetails = codex.labels.rarityDetails;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const [query, setQuery] = useState("");
  const [fanOverlays, setFanOverlays] = useState<Record<string, string[]>>({});
  if (showPresets && Object.keys(fanOverlays).length === 0 && entities.length > 0) {
    setFanOverlays({
      "relics-ancient": sampleAncientTokenUrls(entities),
      "monsters-boss": sampleBossTokenUrls(entities),
    });
  }

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

  const ancientNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const entity of entities) {
      if (entity.type === "ancient") names.set(entity.id, entity.nameKo);
    }
    return names;
  }, [entities]);

  const keywordSourceLabels = serviceLocale === "ko"
    ? { cardKeyword: "카드 키워드", staticHoverTip: "툴팁 키워드" }
    : { cardKeyword: "Card keyword", staticHoverTip: "Hover tip" };

  const namedPresets = showPresets ? namedPresetDefs(entities) : [];
  const cardPresets = namedPresets.filter(
    (preset): preset is Extract<DecisionsDecisionsPresetDef, { kind: "cards" }> => (
      preset.kind === "cards"
    ),
  );
  const relicPresets = namedPresets.filter((preset) => (
    preset.kind === "relics"
    || preset.kind === "ancient-relics"
    || preset.kind === "ancient-relics-named"
  ));
  const monsterPresets = namedPresets.filter(
    (preset): preset is Extract<DecisionsDecisionsPresetDef, { kind: "monsters" }> => (
      preset.kind === "monsters"
    ),
  );
  const potionPresets = namedPresets.filter((preset) => preset.kind === "potions");
  const jumpLabel = (preset: DecisionsDecisionsPresetDef) => decisionsPresetLabel(
    preset,
    presetLabels,
    copy,
    ancientNames,
    codex.monstersView.monsterTypes,
  );
  const hasFilters = Boolean(major) && (
    affiliationChips.length > 0
    || major === "card"
    || major === "relic"
    || major === "potion"
    || major === "power"
    || major === "enchantment"
    || major === "monster"
    || major === "event"
    || major === "ancient"
    || major === "keyword"
    || major === "modifier"
  );

  return (
    <div className="space-y-3" data-decisions-decisions-pool-picker>
      {showPresets && (
      <div className="space-y-2" data-decisions-decisions-presets>
        <BlockTitle>{copy.presetSection}</BlockTitle>
        <div className="flex flex-wrap gap-1.5">
          {cardPresets.map((preset) => (
            <CardPresetJump
              key={preset.key}
              preset={preset}
              label={jumpLabel(preset)}
              onClick={() => onPreset?.(preset.key)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {relicPresets.map((preset) => {
            const label = jumpLabel(preset);
            if (preset.kind === "relics") {
              return (
                <CatalogPresetJump
                  key={preset.key}
                  presetKey={preset.key}
                  icon={RELIC_COLLECTION_ICON}
                  label={label}
                  onClick={() => onPreset?.(preset.key)}
                />
              );
            }
            if (preset.kind === "ancient-relics") {
              return (
                <FanPresetJump
                  key={preset.key}
                  presetKey={preset.key}
                  typeSrc={RELIC_COLLECTION_ICON}
                  overlaySrcs={fanOverlays[preset.key] ?? []}
                  accent={ANCIENT_ACCENT}
                  label={label}
                  onClick={() => onPreset?.(preset.key)}
                />
              );
            }
            return (
              <ComboPresetJump
                key={preset.key}
                presetKey={preset.key}
                lead={RELIC_COLLECTION_ICON}
                trail={entityMap.get(`ancient:${preset.ancientId}`)?.imageUrl ?? ANCIENT_TOKEN_ICON}
                accent={ANCIENT_ACCENT}
                label={label}
                onClick={() => onPreset?.(preset.key)}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {monsterPresets.map((preset) => (
            <FanPresetJump
              key={preset.key}
              presetKey={preset.key}
              typeSrc={MONSTER_TYPE_ICON}
              overlaySrcs={
                preset.key === "monsters-boss"
                  ? (fanOverlays[preset.key] ?? [])
                  : preset.key === "monsters-elite-act1"
                    ? [OVERGROWTH_ELITE_ICON, UNDERDOCKS_ELITE_ICON]
                    : [MAP_ELITE_ICON]
              }
              label={jumpLabel(preset)}
              onClick={() => onPreset?.(preset.key)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {potionPresets.map((preset) => (
            <CatalogPresetJump
              key={preset.key}
              presetKey={preset.key}
              icon={POTION_COLLECTION_ICON}
              label={jumpLabel(preset)}
              onClick={() => onPreset?.(preset.key)}
            />
          ))}
        </div>
      </div>
      )}

      <div
        className={cn(
          "space-y-3",
          showPresets && "border-t-2 border-primary/25 pt-4",
        )}
        data-decisions-decisions-pool-generator
      >
        {showPresets ? <BlockTitle>{copy.pickYourself}</BlockTitle> : null}
      <div className="space-y-1.5">
        <SectionLabel>{copy.typeSection}</SectionLabel>
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
      </div>

      {hasFilters && (
      <div className="space-y-2">
        <SectionLabel>{copy.filterSection}</SectionLabel>
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
      )}

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
      </div>
    </div>
  );
}
