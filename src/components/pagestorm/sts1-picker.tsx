"use client";

import { useMemo, useState } from "react";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { IconFilterButton } from "@/components/codex/codex-filters";
import { SearchBar } from "@/components/codex/search-bar";
import { GameScrollArea } from "@/components/game-scroll-area";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import Image from "@/components/ui/static-image";
import { useSts1MentionIndex } from "@/hooks/use-sts1-mention-index";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { serviceMessages } from "@/messages/service";
import { STS1_FILTER_ICONS } from "@/lib/sts1/card-style";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
import { sts1MatchesCostFilter } from "@/lib/sts1/stats";
import type { Sts1MentionEntry } from "@/lib/sts1-mention-index";
import type { Sts1CardColor, Sts1CardType, Sts1PotionRarity, Sts1PowerType, Sts1RelicPool, Sts1RelicTier, Sts1ResourceType } from "@/lib/sts1/types";
import { sts1NavItems } from "@/lib/site-nav-items";

const COST_OPTIONS = ["0", "1", "2", "3", "3+", "X"] as const;
const CARD_TYPES: Array<Extract<Sts1CardType, "attack" | "skill" | "power">> = ["attack", "skill", "power"];
const RARITIES = ["common", "uncommon", "rare", "other"] as const;
const RELIC_TIERS: Array<Exclude<Sts1RelicTier, "deprecated">> = [
  "starter", "common", "uncommon", "rare", "shop", "special", "boss",
];
const POTION_RARITIES: Sts1PotionRarity[] = ["common", "uncommon", "rare"];
const POWER_TYPES: Sts1PowerType[] = ["buff", "debuff"];

type ColorFilter = Sts1CardColor | "status" | "special";

function toggleMember<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function matchesColor(entry: Sts1MentionEntry, filter: ColorFilter): boolean {
  switch (filter) {
    case "status":
      return entry.cardType === "status";
    case "special":
      return entry.rarity === "special";
    case "colorless":
      return entry.color === "colorless" && entry.cardType !== "status" && entry.rarity !== "special";
    case "curse":
      return entry.color === "curse" || entry.cardType === "curse";
    default:
      return entry.color === filter;
  }
}

function rarityKey(entry: Sts1MentionEntry): (typeof RARITIES)[number] {
  if (entry.rarity === "basic" || entry.rarity === "special" || entry.rarity === "curse" || entry.cardType === "status") {
    return "other";
  }
  if (entry.rarity === "common" || entry.rarity === "uncommon" || entry.rarity === "rare") return entry.rarity;
  return "other";
}

export function sts1ResourceFromHref(href: string): Sts1ResourceType | null {
  const path = href.replace(/^\/(?:en)(?=\/)/, "");
  return sts1NavItems.find((item) => item.href === path)?.type ?? null;
}

export function Sts1CompendiumPickerModal({
  initialResource,
  onClose,
  onInsert,
}: {
  initialResource: Sts1ResourceType | null;
  onClose: () => void;
  onInsert: (entry: Sts1MentionEntry) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const { index, loading } = useSts1MentionIndex();
  const [resource, setResource] = useState<Sts1ResourceType>(initialResource ?? "cards");
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<Set<ColorFilter>>(new Set());
  const [cardTypes, setCardTypes] = useState<Set<string>>(new Set());
  const [rarities, setRarities] = useState<Set<string>>(new Set());
  const [costs, setCosts] = useState<Set<string>>(new Set());
  const [pools, setPools] = useState<Set<string>>(new Set());
  const [tiers, setTiers] = useState<Set<string>>(new Set());
  const labels = index?.labels[serviceLocale === "en" ? "eng" : "kor"];

  const results = useMemo(() => {
    if (!index) return [];
    const needle = query.trim();
    return index.entries.filter((entry) => {
      if (entry.resource !== resource) return false;
      if (resource === "cards") {
        if (colors.size && ![...colors].some((filter) => matchesColor(entry, filter))) return false;
        if (cardTypes.size && !cardTypes.has(entry.cardType ?? "")) return false;
        if (rarities.size && !rarities.has(rarityKey(entry))) return false;
        if (!sts1MatchesCostFilter(entry.cost ?? 0, costs)) return false;
      }
      if (resource === "relics" || resource === "potions") {
        if (pools.size && !pools.has(entry.pool ?? "")) return false;
        if (tiers.size && !tiers.has(entry.tier ?? entry.rarity ?? "")) return false;
      }
      if (resource === "powers" && tiers.size && !tiers.has(entry.powerType ?? "")) return false;
      if (needle && !fuzzyMatchCodexText(`${entry.nameKo} ${entry.nameEn} ${entry.slug} ${entry.description}`, needle)) {
        return false;
      }
      return true;
    });
  }, [cardTypes, colors, costs, index, pools, query, rarities, resource, tiers]);

  function selectResource(next: Sts1ResourceType) {
    setResource(next);
    setColors(new Set());
    setCardTypes(new Set());
    setRarities(new Set());
    setCosts(new Set());
    setPools(new Set());
    setTiers(new Set());
  }

  const colorFilters: Array<{ key: ColorFilter; label: string; icon: string }> = labels ? [
    { key: "ironclad", label: labels.characters.ironclad, icon: STS1_FILTER_ICONS.ironclad },
    { key: "silent", label: labels.characters.silent, icon: STS1_FILTER_ICONS.silent },
    { key: "defect", label: labels.characters.defect, icon: STS1_FILTER_ICONS.defect },
    { key: "watcher", label: labels.characters.watcher, icon: STS1_FILTER_ICONS.watcher },
    { key: "colorless", label: labels.extras.colorless, icon: STS1_FILTER_ICONS.colorless },
    { key: "status", label: labels.extras.status, icon: STS1_FILTER_ICONS.status },
    { key: "curse", label: labels.extras.curse, icon: STS1_FILTER_ICONS.curse },
    { key: "special", label: labels.extras.special, icon: STS1_FILTER_ICONS.special },
  ] : [];
  const poolFilters: Array<{ key: Sts1RelicPool; label: string; icon: string }> = labels ? [
    { key: "shared", label: labels.shared, icon: sts1CardUiUrl("card_colorless_orb") },
    { key: "ironclad", label: labels.characters.ironclad, icon: STS1_FILTER_ICONS.ironclad },
    { key: "silent", label: labels.characters.silent, icon: STS1_FILTER_ICONS.silent },
    { key: "defect", label: labels.characters.defect, icon: STS1_FILTER_ICONS.defect },
    { key: "watcher", label: labels.characters.watcher, icon: STS1_FILTER_ICONS.watcher },
  ] : [];

  return (
    <ServiceModalFrame
      title={copy.imageInsert.replace("{name}", copy.sts1Compendium)}
      titleId="pagestorm-sts1-picker"
      closeLabel={copy.close}
      onClose={onClose}
      panelClassName="max-h-[min(92dvh,52rem)] w-full max-w-3xl"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          {sts1NavItems.map((item) => (
            <button
              key={item.type}
              type="button"
              aria-pressed={resource === item.type}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                resource === item.type ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
              onClick={() => selectResource(item.type)}
            >
              <Image src={item.icon} alt="" width={18} height={18} className="h-4 w-4 object-contain" />
              {labels ? resourceLabel(labels, item.type) : item.type}
            </button>
          ))}
        </div>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={serviceLocale === "ko" ? "검색" : "Search"}
        />
        {labels && resource === "cards" ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 gap-1">
              {colorFilters.map((filter) => (
                <IconFilterButton
                  key={filter.key}
                  icon={filter.icon}
                  label={filter.label}
                  active={colors.has(filter.key)}
                  onClick={() => setColors((current) => toggleMember(current, filter.key))}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {CARD_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={labels.types[type]}
                  active={cardTypes.has(type)}
                  onClick={() => setCardTypes((current) => toggleMember(current, type))}
                />
              ))}
              {RARITIES.map((rarity) => (
                <FilterChip
                  key={rarity}
                  label={rarity === "other"
                    ? (serviceLocale === "ko" ? "기타" : "Other")
                    : labels.potionRarities[rarity]}
                  active={rarities.has(rarity)}
                  onClick={() => setRarities((current) => toggleMember(current, rarity))}
                />
              ))}
              {COST_OPTIONS.map((cost) => (
                <FilterChip
                  key={cost}
                  label={cost}
                  active={costs.has(cost)}
                  onClick={() => setCosts((current) => toggleMember(current, cost))}
                />
              ))}
            </div>
          </div>
        ) : null}
        {labels && (resource === "relics" || resource === "potions") ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-1">
              {poolFilters.map((filter) => (
                <IconFilterButton
                  key={filter.key}
                  icon={filter.icon}
                  label={filter.label}
                  active={pools.has(filter.key)}
                  onClick={() => setPools((current) => toggleMember(current, filter.key))}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(resource === "relics" ? RELIC_TIERS : POTION_RARITIES).map((tier) => (
                <FilterChip
                  key={tier}
                  label={resource === "relics" ? labels.relicTiers[tier as Exclude<Sts1RelicTier, "deprecated">] : labels.potionRarities[tier as Sts1PotionRarity]}
                  active={tiers.has(tier)}
                  onClick={() => setTiers((current) => toggleMember(current, tier))}
                />
              ))}
            </div>
          </div>
        ) : null}
        {labels && resource === "powers" ? (
          <div className="flex flex-wrap gap-1">
            {POWER_TYPES.map((type) => (
              <FilterChip
                key={type}
                label={labels.powerTypes[type]}
                active={tiers.has(type)}
                onClick={() => setTiers((current) => toggleMember(current, type))}
              />
            ))}
          </div>
        ) : null}
        {loading ? <ContentLoadingNotice /> : null}
        <GameScrollArea className="min-h-48 flex-1">
          {results.length === 0 && !loading ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{copy.pickerEmpty}</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {results.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-primary/10"
                  onClick={() => onInsert(entry)}
                >
                  <Image src={entry.imageUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
                  <span className="min-w-0">
                    <span className="block truncate font-game-title text-sm text-foreground">{entry.nameKo}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{entry.nameEn}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </GameScrollArea>
      </div>
    </ServiceModalFrame>
  );
}

function resourceLabel(labels: { cardLibraryTitle: string; relicCollectionTitle: string; potionLabTitle: string; powersTitle: string; charactersTitle: string }, resource: Sts1ResourceType): string {
  switch (resource) {
    case "cards":
      return labels.cardLibraryTitle;
    case "relics":
      return labels.relicCollectionTitle;
    case "potions":
      return labels.potionLabTitle;
    case "powers":
      return labels.powersTitle;
    case "characters":
      return labels.charactersTitle;
  }
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-md border px-2 py-0.5 text-[11px] ${
        active ? "border-primary text-primary" : "border-border text-muted-foreground"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
