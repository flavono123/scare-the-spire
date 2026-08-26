"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ComboResourceAsset } from "@/components/combo/combo-resource-stack";
import {
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
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
  CARD_POOL_MINORS,
  namedPresetDefs,
  POTION_POOL_MINORS,
  RELIC_POOL_MINORS,
  type DecisionsDecisionsPresetDef,
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

function chipColor(key: string): string {
  return CHARACTER_COLORS[key] ?? GOLD;
}

function VisualChip({
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

function presetChip(def: DecisionsDecisionsPresetDef): {
  icon: string;
  color: string;
} | null {
  if (def.kind === "cards") {
    return {
      icon: def.color === "colorless"
        ? COLORLESS_FILTER_ICON
        : CHARACTER_TOKEN_ICONS[def.color] ?? CARDS_NAV_ICON,
      color: chipColor(def.color),
    };
  }
  if (def.kind === "relics") {
    return {
      icon: def.pool === "shared"
        ? RELICS_NAV_ICON
        : CHARACTER_TOKEN_ICONS[def.pool] ?? RELICS_NAV_ICON,
      color: chipColor(def.pool),
    };
  }
  if (def.kind === "potions") {
    return {
      icon: POTIONS_NAV_ICON,
      color: PURPLE,
    };
  }
  return null;
}

export function DecisionsDecisionsPoolPicker({
  entities,
  entityMap,
  serviceLocale,
  presetLabels,
  presetKey,
  major,
  minor,
  onPreset,
  onFilter,
  onAdd,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  presetKey: string;
  major: DecisionsPoolMajor | null;
  minor: string | null;
  onPreset: (key: string) => void;
  onFilter: (major: DecisionsPoolMajor | null, minor: string | null) => void;
  onAdd: (entity: EntityInfo) => void;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const codex = serviceMessages[serviceLocale].codex;
  const pools = codex.labels.pools;
  const typeLabels = compendiumTypeLabels(serviceLocale);
  const [query, setQuery] = useState("");

  const catalog = useMemo(
    () => entities.filter((entity) => (
      entity.type === "card" || entity.type === "relic" || entity.type === "potion"
    )),
    [entities],
  );

  const scoped = useMemo(() => {
    if (!major) return catalog;
    return catalog.filter((entity) => entity.type === major);
  }, [catalog, major]);

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return matchEntities(trimmed, scoped, SEARCH_RESULT_LIMIT);
  }, [query, scoped]);

  const minorChips = useMemo(() => {
    if (major === "card") {
      return CARD_POOL_MINORS.map((key) => ({
        key,
        icon: key === "colorless"
          ? COLORLESS_FILTER_ICON
          : (CHARACTER_TOKEN_ICONS[key] ?? CARDS_NAV_ICON),
        color: chipColor(key),
        label: key === "colorless"
          ? (presetLabels["cards-colorless"] ?? pools.colorless)
          : (presetLabels[`cards-${key}`] ?? pools[key as keyof typeof pools]),
      }));
    }
    if (major === "relic") {
      return RELIC_POOL_MINORS.map((key) => ({
        key,
        icon: key === "shared"
          ? COLORLESS_FILTER_ICON
          : (CHARACTER_TOKEN_ICONS[key] ?? RELICS_NAV_ICON),
        color: chipColor(key),
        label: pools[key],
      }));
    }
    if (major === "potion") {
      return POTION_POOL_MINORS.map((key) => ({
        key,
        icon: key === "event"
          ? EVENT_FILTER_ICON
          : key === "all"
            ? POTIONS_NAV_ICON
            : key === "shared"
              ? COLORLESS_FILTER_ICON
              : (CHARACTER_TOKEN_ICONS[key] ?? POTIONS_NAV_ICON),
        color: key === "all" ? PURPLE : chipColor(key),
        label: key === "all"
          ? (presetLabels["potions-all"] ?? codex.potions)
          : pools[key],
      }));
    }
    return [];
  }, [codex.potions, major, pools, presetLabels]);

  return (
    <div className="space-y-3" data-decisions-decisions-pool-picker>
      <div className="flex flex-wrap gap-1.5" data-decisions-decisions-presets>
        {namedPresetDefs().map((def) => {
          const chip = presetChip(def);
          if (!chip) return null;
          const label = presetLabels[def.key] ?? def.key;
          return (
            <VisualChip
              key={def.key}
              icon={chip.icon}
              color={chip.color}
              label={label}
              pressed={presetKey === def.key}
              onClick={() => onPreset(def.key)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5" data-decisions-decisions-filter-major>
        <VisualChip
          icon={CARDS_NAV_ICON}
          color={GOLD}
          label={codex.cards}
          pressed={major === "card"}
          onClick={() => onFilter(major === "card" ? null : "card", null)}
        />
        <VisualChip
          icon={RELICS_NAV_ICON}
          color={GOLD}
          label={codex.relics}
          pressed={major === "relic"}
          onClick={() => onFilter(major === "relic" ? null : "relic", null)}
        />
        <VisualChip
          icon={POTIONS_NAV_ICON}
          color={PURPLE}
          label={codex.potions}
          pressed={major === "potion"}
          onClick={() => onFilter(major === "potion" ? null : "potion", null)}
        />
      </div>

      {minorChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-decisions-decisions-filter-minor>
          {minorChips.map((chip) => (
            <VisualChip
              key={chip.key}
              icon={chip.icon}
              color={chip.color}
              label={chip.label}
              pressed={minor === chip.key}
              onClick={() => onFilter(major, minor === chip.key ? null : chip.key)}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-popover/80">
        <div className="flex items-center gap-2 border-b border-border p-2.5">
          <Search className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
          <input
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
