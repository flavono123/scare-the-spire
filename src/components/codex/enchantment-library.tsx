"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexEnchantment,
  CodexRelic,
  EnchantmentCardTypeFilter,
  ENCHANTMENT_CARD_TYPE_CONFIG,
  ENCHANTMENT_CARD_TYPE_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { reconstructEntityAtVersion } from "@/lib/entity-versioning";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
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
type EnchantmentSearchTokenType = "cardType";

function getCardTypeFilter(cardType: "Attack" | "Skill" | null): EnchantmentCardTypeFilter {
  return cardType ?? "Any";
}

interface EnchantmentLibraryProps {
  serviceLocale: ServiceLocale;
  enchantments: CodexEnchantment[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  /** All codex entities — enables rich cross-references in the detail modal. */
  entities?: EntityInfo[];
  /** Relics — used to surface ones that grant the selected enchantment. */
  relics?: CodexRelic[];
}

export function EnchantmentLibrary({ serviceLocale, enchantments, versions, currentVersion, patches, changes, versionDiffs, entities, relics }: EnchantmentLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedCardTypes, setSelectedCardTypes] = useState<Set<EnchantmentCardTypeFilter>>(new Set());
  const [stackableOnly, setStackableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Enchantment detail modal
  const initialEnchId = searchParams.get("enchantment");
  const [selectedEnchantment, setSelectedEnchantment] = useState<CodexEnchantment | null>(() => {
    if (!initialEnchId) return null;
    return enchantments.find((e) => e.id.toLowerCase() === initialEnchId.toLowerCase()) ?? null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedEnchantment) {
      url.searchParams.set("enchantment", selectedEnchantment.id.toLowerCase());
    } else {
      url.searchParams.delete("enchantment");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedEnchantment]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("enchantment");
      if (!param) {
        setSelectedEnchantment(null);
      } else {
        setSelectedEnchantment(enchantments.find((e) => e.id.toLowerCase() === param.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [enchantments]);

  useEffect(() => {
    if (!selectedEnchantment) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEnchantment(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEnchantment]);

  const versionedEnchantments = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return enchantments;
    return enchantments.map((ench) =>
      reconstructEntityAtVersion(ench, "enchantment", selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [enchantments, selectedVersion, currentVersion, versionDiffs, patches]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("codex-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const enchantmentTriggers = useMemo(
    () => getEnchantmentTriggers(serviceText),
    [serviceText],
  );

  // Parse search query
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, enchantmentTriggers),
    [searchQuery, enchantmentTriggers],
  );

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

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "cardType") {
        result = result.filter((e) => getCardTypeFilter(e.cardType) === token.value);
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (e) =>
          fuzzyMatchCodexText(e.name, parsedSearch.text) ||
          fuzzyMatchCodexText(e.nameEn, parsedSearch.text) ||
          stripCodexMarkup(e.description).toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedEnchantments, selectedCardTypes, stackableOnly, parsedSearch]);

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
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={enchantmentTriggers}
              placeholder={serviceText.enchantmentsView.searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredEnchantments.length, serviceText.labels.enchantments, serviceLocale)}
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
                  <EnchantmentTile key={ench.id} serviceLocale={serviceLocale} enchantment={ench} onClick={() => setSelectedEnchantment(ench)} />
                ))}
              </div>
            </section>
          ))}

          {filteredEnchantments.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Enchantment Detail Modal */}
      {selectedEnchantment && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEnchantment(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <EnchantmentDetail
              serviceLocale={serviceLocale}
              backToListTitle={serviceText.enchantmentsView.title}
              enchantment={selectedEnchantment}
              onClose={() => setSelectedEnchantment(null)}
              entities={entities}
              relics={relics}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function getEnchantmentTriggers(
  serviceText: CodexServiceMessages,
): CodexSearchTriggerGroup<EnchantmentSearchTokenType>[] {
  return [
    {
      trigger: "#",
      type: "cardType",
      label: serviceText.enchantmentsView.cardTypeFilter,
      items: [
        { value: "attack", label: serviceText.labels.enchantmentCardTypes.Attack.label, desc: "Attack" },
        { value: "skill", label: serviceText.labels.enchantmentCardTypes.Skill.label, desc: "Skill" },
        { value: "any", label: serviceText.labels.enchantmentCardTypes.Any.label, desc: "Any card type" },
      ],
      validate: (val) => ENCHANTMENT_CARD_TYPE_ALIASES[val] ?? null,
      chipColor: "bg-purple-500/20 text-purple-400",
    },
  ];
}
