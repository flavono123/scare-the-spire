"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexAffliction,
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
  EnchantmentCardTypeFilter,
  ENCHANTMENT_CARD_TYPE_CONFIG,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { versionCodexEntities } from "@/lib/codex-versioning";
import { getAfflictionCardTypeRestriction } from "@/lib/sts2-affliction-rules";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { EnchantmentTile } from "./enchantment-tile";
import { EnchantmentDetail } from "./enchantment-detail";
import { SearchBar } from "./search-bar";
import { FilterSection, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";

const CARD_TYPE_ORDER: EnchantmentCardTypeFilter[] = ["Any", "Attack", "Skill"];
type SelectedEnchantmentResource =
  | { kind: "enchantment"; item: CodexEnchantment }
  | { kind: "affliction"; item: CodexAffliction };

function getCardTypeFilter(cardType: "Attack" | "Skill" | null): EnchantmentCardTypeFilter {
  return cardType ?? "Any";
}

function getAfflictionTypeFilter(affliction: CodexAffliction): EnchantmentCardTypeFilter | null {
  const cardType = getAfflictionCardTypeRestriction(affliction);
  if (cardType === "공격") return "Attack";
  if (cardType === "스킬") return "Skill";
  if (!cardType) return "Any";
  return null;
}

interface EnchantmentLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi?: CodexGameUiLabels;
  enchantments: CodexEnchantment[];
  afflictions?: CodexAffliction[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  /** All codex entities — enables rich cross-references in the detail modal. */
  entities?: EntityInfo[];
  /** Cards — used to surface ones that create or reference the selected enchantment. */
  cards?: CodexCard[];
  /** Events — used to surface ones that grant or reference the selected enchantment. */
  events?: CodexEvent[];
  /** Potions — used to surface ones that share the selected enchantment's game mechanic. */
  potions?: CodexPotion[];
  /** Powers — used to surface ones referenced by the selected enchantment. */
  powers?: CodexPower[];
  /** Relics — used to surface ones that grant the selected enchantment. */
  relics?: CodexRelic[];
  /** Monsters — used to surface ones that apply the selected affliction. */
  monsters?: CodexMonster[];
}

export function EnchantmentLibrary({ serviceLocale, gameUi, enchantments, afflictions = [], versions, currentVersion, patches, changes, versionDiffs, entities, cards, events, potions, powers, relics, monsters }: EnchantmentLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedCardTypes, setSelectedCardTypes] = useState<Set<EnchantmentCardTypeFilter>>(new Set());
  const [stackableOnly, setStackableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Enchantment or affliction detail modal
  const initialEnchId = searchParams.get("enchantment");
  const initialAfflictionId = searchParams.get("affliction");
  const [selectedResource, setSelectedResource] = useState<SelectedEnchantmentResource | null>(() => {
    if (initialEnchId) {
      const enchantment = enchantments.find((e) => e.id.toLowerCase() === initialEnchId.toLowerCase());
      if (enchantment) return { kind: "enchantment", item: enchantment };
    }
    if (initialAfflictionId) {
      const affliction = afflictions.find((a) => a.id.toLowerCase() === initialAfflictionId.toLowerCase());
      if (affliction) return { kind: "affliction", item: affliction };
    }
    return null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedResource?.kind === "enchantment") {
      url.searchParams.set("enchantment", selectedResource.item.id.toLowerCase());
      url.searchParams.delete("affliction");
    } else if (selectedResource?.kind === "affliction") {
      url.searchParams.set("affliction", selectedResource.item.id.toLowerCase());
      url.searchParams.delete("enchantment");
    } else {
      url.searchParams.delete("enchantment");
      url.searchParams.delete("affliction");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedResource]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const enchantmentParam = url.searchParams.get("enchantment");
      const afflictionParam = url.searchParams.get("affliction");
      if (enchantmentParam) {
        const enchantment = enchantments.find((e) => e.id.toLowerCase() === enchantmentParam.toLowerCase());
        setSelectedResource(enchantment ? { kind: "enchantment", item: enchantment } : null);
        return;
      }
      if (afflictionParam) {
        const affliction = afflictions.find((a) => a.id.toLowerCase() === afflictionParam.toLowerCase());
        setSelectedResource(affliction ? { kind: "affliction", item: affliction } : null);
        return;
      }
      setSelectedResource(null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [afflictions, enchantments]);

  useEffect(() => {
    if (!selectedResource) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedResource(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedResource]);

  const versionedEnchantments = useMemo(() => {
    return versionCodexEntities(enchantments, "enchantment", {
      selectedVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [enchantments, selectedVersion, currentVersion, versionDiffs, patches, changes]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Filtered enchantments
  const filteredEnchantments = useMemo(() => {
    let result = versionedEnchantments;

    // Card type filter (sidebar)
    if (selectedCardTypes.size > 0) {
      result = result.filter((e) => selectedCardTypes.has(getCardTypeFilter(e.cardType)));
    }

    // Stackable filter
    if (stackableOnly) {
      result = result.filter((e) => e.isStackable);
    }

    // Text search
    if (searchText) {
      result = result.filter(
        (e) =>
          fuzzyMatchCodexText(e.name, searchText) ||
          fuzzyMatchCodexText(e.nameEn, searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(e.description), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(e.descriptionEn), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(e.extraCardTextEn ?? ""), searchText)
      );
    }

    return result;
  }, [versionedEnchantments, selectedCardTypes, stackableOnly, searchText]);

  const filteredAfflictions = useMemo(() => {
    let result = afflictions;

    if (selectedCardTypes.size > 0) {
      result = result.filter((a) => {
        const filter = getAfflictionTypeFilter(a);
        return filter ? selectedCardTypes.has(filter) : false;
      });
    }

    if (stackableOnly) {
      result = result.filter((a) => a.isStackable);
    }

    if (searchText) {
      result = result.filter(
        (a) =>
          fuzzyMatchCodexText(a.name, searchText) ||
          fuzzyMatchCodexText(a.nameEn, searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(a.description), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(a.descriptionEn), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(a.extraCardTextEn ?? ""), searchText),
      );
    }

    return [...result].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [afflictions, selectedCardTypes, stackableOnly, searchText]);

  const filteredResourceCount = filteredEnchantments.length + filteredAfflictions.length;

  // Group by card type restriction
  const groupedEnchantments = useMemo(() => {
    const groups: { cardType: EnchantmentCardTypeFilter; enchantments: CodexEnchantment[] }[] = [];
    for (const ct of CARD_TYPE_ORDER) {
      const group = filteredEnchantments
        .filter((e) => getCardTypeFilter(e.cardType) === ct)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ cardType: ct, enchantments: group });
      }
    }
    return groups;
  }, [filteredEnchantments]);

  const toggleCardType = useCallback((ct: EnchantmentCardTypeFilter) => {
    setSelectedCardTypes((prev) => {
      const next = new Set(prev);
      if (next.has(ct)) next.delete(ct);
      else next.add(ct);
      return next;
    });
  }, []);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          inputId="codex-filter-search"
          placeholder={serviceLocale === "ko" ? "검색" : "Search"}
        />

        {/* Card type filter */}
        <FilterSection trigger="#" label={serviceText.enchantmentsView.cardTypeFilter}>
          <div className="flex flex-col gap-0.5">
            {CARD_TYPE_ORDER.map((ct) => (
              <button
                key={ct}
                onClick={() => toggleCardType(ct)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedCardTypes.has(ct)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ENCHANTMENT_CARD_TYPE_CONFIG[ct].color }}
                />
                {serviceText.labels.enchantmentCardTypes[ct].label}
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Stackable filter */}
        <FilterSection label={serviceText.enchantmentsView.attributeFilter}>
          <ToggleButton
            label={serviceText.enchantmentsView.stackableOnly}
            active={stackableOnly}
            onClick={() => setStackableOnly((v) => !v)}
          />
        </FilterSection>
        </>
      )}
    >

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={serviceText.enchantmentsView.title}
          count={formatCodexCount(filteredResourceCount, serviceText.labels.entries, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Enchantment Grid (grouped by card type) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedEnchantments.map(({ cardType, enchantments: groupEnchantments }) => (
            <section key={cardType} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="font-game-title text-lg font-bold mb-0.5"
                  style={{ color: ENCHANTMENT_CARD_TYPE_CONFIG[cardType].color }}
                >
                  {serviceText.labels.enchantmentCardTypes[cardType].label}
                  <span className="font-game-text text-sm font-normal text-gray-400 ml-2">
                    {serviceText.labels.enchantmentCardTypes[cardType].description}
                  </span>
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {groupEnchantments.map((ench) => (
                  <EnchantmentTile
                    key={ench.id}
                    serviceLocale={serviceLocale}
                    resource={ench}
                    onClick={() => setSelectedResource({ kind: "enchantment", item: ench })}
                  />
                ))}
              </div>
            </section>
          ))}

          {filteredAfflictions.length > 0 && (
            <section className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2 className="font-game-title text-lg font-bold mb-0.5 text-amber-400">
                  {serviceText.afflictions}
                  <span className="font-game-text text-sm font-normal text-gray-400 ml-2">
                    {formatCodexCount(filteredAfflictions.length, serviceText.labels.afflictions, serviceLocale)}
                  </span>
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredAfflictions.map((affliction) => (
                  <EnchantmentTile
                    key={affliction.id}
                    serviceLocale={serviceLocale}
                    resource={affliction}
                    onClick={() => setSelectedResource({ kind: "affliction", item: affliction })}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredResourceCount === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Enchantment or affliction detail modal */}
      {selectedResource && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedResource(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            {selectedResource.kind === "enchantment" ? (
              <EnchantmentDetail
                serviceLocale={serviceLocale}
                gameUi={gameUi}
                backToListTitle={serviceText.enchantmentsView.title}
                enchantment={selectedResource.item}
                onClose={() => setSelectedResource(null)}
                entities={entities}
                cards={cards}
                events={events}
                potions={potions}
                powers={powers}
                relics={relics}
                patches={patches}
                changes={changes}
                versionDiffs={versionDiffs}
              />
            ) : (
              <EnchantmentDetail
                serviceLocale={serviceLocale}
                gameUi={gameUi}
                backToListTitle={serviceText.enchantmentsView.title}
                affliction={selectedResource.item}
                onClose={() => setSelectedResource(null)}
                entities={entities}
                monsters={monsters}
                patches={patches}
                changes={changes}
              />
            )}
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}
