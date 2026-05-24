"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import { DescriptionText } from "./codex-description";
import { PotionDetail } from "./potion-detail";
import { GameHoverTip } from "./hover-tip";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexCard,
  CodexEnchantment,
  CodexPotion,
  CodexCharacter,
  CodexEvent,
  CodexPower,
  PotionRarityKo,
  PotionPool,
  POOL_ALIASES,
  POTION_RARITY_ALIASES,
  characterOutlineFilter,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import { reconstructPotionAtVersion } from "@/lib/entity-versioning";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { VersionSelector } from "./version-selector";
import { SearchBar } from "./search-bar";
import { FilterSection, IconFilterButton } from "./codex-filters";
import { GameCheckboxToggle } from "./game-checkbox";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import {
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
  getCharacterTokenIcon,
} from "./codex-filter-assets";
import {
  FUTURE_OF_POTIONS_EVENT_NAME_KO,
  FUTURE_OF_POTIONS_OUTCOMES,
  formatFuturePotionOutcome,
  getFuturePotionOutcomeIdsForPotion,
  type FuturePotionOutcomeId,
} from "@/lib/codex-references";

type PotionSectionKey = keyof CodexGameUiLabels["potionLab"]["sections"];

// Rarity sections to display (merge 이벤트 + 토큰 into 특별)
const DISPLAY_SECTIONS: {
  key: PotionSectionKey;
  color: string;
  rarities: PotionRarityKo[];
}[] = [
  {
    key: "common",
    color: "#b0b0b0",
    rarities: ["일반"],
  },
  {
    key: "uncommon",
    color: "#4fc3f7",
    rarities: ["고급"],
  },
  {
    key: "rare",
    color: "#ffd740",
    rarities: ["희귀"],
  },
  {
    key: "special",
    color: "#81c784",
    rarities: ["이벤트", "토큰"],
  },
];

// Character pools (excluding shared/event)
const CHARACTER_POOLS: PotionPool[] = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
];

type PotionSearchTokenType = "pool" | "rarity";

interface PotionLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  potions: CodexPotion[];
  characters: CodexCharacter[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  relatedCards?: CodexCard[];
  relatedEnchantments?: CodexEnchantment[];
  relatedEvents?: CodexEvent[];
  relatedPowers?: CodexPower[];
  entities?: EntityInfo[];
}

export function PotionLibrary({ serviceLocale, gameUi, title, potions, characters, versions, currentVersion, patches, changes, versionDiffs, relatedCards = [], relatedEnchantments = [], relatedEvents = [], relatedPowers = [], entities }: PotionLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedPools, setSelectedPools] = useState<Set<PotionPool>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [selectedFutureOutcomes, setSelectedFutureOutcomes] = useState<Set<FuturePotionOutcomeId>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Potion detail modal — initialize from ?potion= query param
  const initialPotionId = searchParams.get("potion");
  const [selectedPotion, setSelectedPotion] = useState<CodexPotion | null>(() => {
    if (!initialPotionId) return null;
    return potions.find((p) => p.id.toLowerCase() === initialPotionId.toLowerCase()) ?? null;
  });

  // Update URL query param when modal opens/closes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPotion) {
      url.searchParams.set("potion", selectedPotion.id.toLowerCase());
    } else {
      url.searchParams.delete("potion");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedPotion]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const potionParam = url.searchParams.get("potion");
      if (!potionParam) {
        setSelectedPotion(null);
      } else {
        const potion = potions.find((p) => p.id.toLowerCase() === potionParam.toLowerCase());
        setSelectedPotion(potion ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [potions]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedPotion) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPotion(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPotion]);

  const versionedPotions = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return potions;
    return potions.map((potion) =>
      reconstructPotionAtVersion(potion, selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [potions, selectedVersion, currentVersion, versionDiffs, patches]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("potion-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const potionTriggers = useMemo(
    () => getPotionTriggers(serviceText, gameUi),
    [serviceText, gameUi],
  );

  // Parse search query for @ (pool) and $ (rarity) tokens
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, potionTriggers),
    [searchQuery, potionTriggers],
  );

  // Filter potions
  const filteredPotions = useMemo(() => {
    let result = versionedPotions;

    // Pool filter (sidebar)
    if (selectedPools.size > 0) {
      result = result.filter(
        (p) => selectedPools.has(p.pool) || (selectedPools.has("shared" as PotionPool) && p.pool === "shared")
      );
    }

    // Rarity filter (sidebar)
    if (selectedRarities.size > 0) {
      result = result.filter((p) => {
        return selectedRarities.has(getPotionSectionKey(p.rarity));
      });
    }

    if (selectedFutureOutcomes.size > 0) {
      result = result.filter((potion) =>
        getFuturePotionOutcomeIdsForPotion(potion).some((id) => selectedFutureOutcomes.has(id))
      );
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "pool") {
        result = result.filter((p) => p.pool === token.value);
      } else if (token.type === "rarity") {
        result = result.filter((p) => p.rarity === token.value);
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (p) =>
          fuzzyMatchCodexText(p.name, parsedSearch.text) ||
          fuzzyMatchCodexText(p.nameEn, parsedSearch.text) ||
          stripCodexMarkup(p.description).toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedPotions, selectedPools, selectedRarities, selectedFutureOutcomes, parsedSearch]);

  // Group by rarity sections
  const sections = useMemo(() => {
    return DISPLAY_SECTIONS.map((section) => ({
      ...section,
      label: gameUi.potionLab.sections[section.key].label,
      description: gameUi.potionLab.sections[section.key].description,
      potions: filteredPotions
        .filter((p) => section.rarities.includes(p.rarity))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    })).filter((s) => s.potions.length > 0);
  }, [filteredPotions, gameUi]);

  // Toggle helpers
  const togglePool = useCallback((pool: PotionPool) => {
    setSelectedPools((prev) => {
      const next = new Set(prev);
      if (next.has(pool)) next.delete(pool);
      else next.add(pool);
      return next;
    });
  }, []);

  const toggleRarity = useCallback((rarity: string) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  }, []);

  const toggleFutureOutcome = useCallback((outcomeId: FuturePotionOutcomeId) => {
    setSelectedFutureOutcomes((prev) => {
      const next = new Set(prev);
      if (next.has(outcomeId)) next.delete(outcomeId);
      else next.add(outcomeId);
      return next;
    });
  }, []);

  // Character filters from props
  const poolLabels = useMemo(() => {
    const labels: Record<PotionPool, string> = {
      shared: serviceText.labels.pools.shared,
      event: gameUi.eventsTitle,
      ironclad: serviceText.labels.pools.ironclad,
      silent: serviceText.labels.pools.silent,
      defect: serviceText.labels.pools.defect,
      necrobinder: serviceText.labels.pools.necrobinder,
      regent: serviceText.labels.pools.regent,
    };
    for (const character of characters) {
      labels[character.id.toLowerCase() as PotionPool] = character.name;
    }
    return labels;
  }, [characters, gameUi.eventsTitle, serviceText]);

  const characterFilters = characters
    .filter((c) =>
      CHARACTER_POOLS.includes(c.id.toLowerCase() as PotionPool)
    )
    .map((c) => ({
      key: c.id.toLowerCase() as PotionPool,
      label: c.name,
      icon: getCharacterTokenIcon(c.id, c.imageUrl),
    }));

  const extraPoolFilters = [
    { key: "shared" as const, label: poolLabels.shared, icon: COLORLESS_FILTER_ICON },
    { key: "event" as const, label: poolLabels.event, icon: EVENT_FILTER_ICON },
  ];

  const rarityFilters = DISPLAY_SECTIONS.map((s) => ({
    key: s.key,
    label: gameUi.potionLab.sections[s.key].label,
    color: s.color,
  }));

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        {/* Character/Pool Filters */}
        <FilterSection trigger="@" label={serviceText.labels.affiliation}>
          <div className="grid grid-cols-5 gap-1.5">
            {characterFilters.map((cf) => (
              <IconFilterButton
                key={cf.key}
                icon={cf.icon}
                label={cf.label}
                active={selectedPools.has(cf.key)}
                onClick={() => togglePool(cf.key)}
              />
            ))}
            {extraPoolFilters.map((filter) => (
              <IconFilterButton
                key={filter.key}
                icon={filter.icon}
                label={filter.label}
                active={selectedPools.has(filter.key)}
                onClick={() => togglePool(filter.key)}
              />
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Rarity */}
        <FilterSection trigger="$" label={gameUi.common.rarity}>
          <div className="flex flex-col gap-0.5">
            {rarityFilters.map((r) => (
              <button
                key={r.key}
                onClick={() => toggleRarity(r.key)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedRarities.has(r.key)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                {r.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        <FilterSection trigger="?" label={FUTURE_OF_POTIONS_EVENT_NAME_KO}>
          <div className="flex flex-col gap-1">
            {FUTURE_OF_POTIONS_OUTCOMES.map((outcome) => {
              const active = selectedFutureOutcomes.has(outcome.id);
              return (
                <GameCheckboxToggle
                  key={outcome.id}
                  checked={active}
                  onCheckedChange={() => toggleFutureOutcome(outcome.id)}
                  label={formatFuturePotionOutcome(outcome)}
                  size="sm"
                  align="start"
                  className="w-full py-1.5"
                  labelClassName="font-game-text text-xs leading-relaxed text-[#e5d68a]"
                />
              );
            })}
          </div>
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
          title={title}
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="potion-search"
              triggerGroups={potionTriggers}
              placeholder={serviceText.potionsView.searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredPotions.length, serviceText.labels.potions, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Potion Grid by Rarity */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.key} className="mb-8 last:mb-0">
              {/* Section header */}
              <div className="mb-3">
                <span
                  className="font-game-title text-lg font-bold"
                  style={{ color: section.color }}
                >
                  {section.label}:
                </span>
                <span className="ml-2 text-sm text-gray-400">
                  {section.description}
                </span>
              </div>

              {/* Potion icon grid */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {section.potions.map((potion) => (
                  <PotionTile
                    key={potion.id}
                    potion={potion}
                    onClick={() => setSelectedPotion(potion)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Potion Detail Modal */}
      {selectedPotion && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPotion(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <PotionDetail serviceLocale={serviceLocale} gameUi={gameUi} backToListTitle={title} potion={selectedPotion} poolLabels={poolLabels} relatedCards={relatedCards} relatedEnchantments={relatedEnchantments} relatedEvents={relatedEvents} relatedPowers={relatedPowers} patches={patches} changes={changes} versionDiffs={versionDiffs} entities={entities} onClose={() => setSelectedPotion(null)} />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 380;
const TOOLTIP_HEIGHT = 220;

// Individual potion icon tile
function PotionTile({
  potion,
  onClick,
}: {
  potion: CodexPotion;
  onClick?: () => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "right",
    vertical: "top",
  });

  const updatePlacement = useCallback(() => {
    const rect = tileRef.current?.getBoundingClientRect();
    if (!rect) return;
    const horizontal = rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH > window.innerWidth
      ? "left"
      : "right";
    const vertical = rect.top + TOOLTIP_HEIGHT > window.innerHeight
      ? "bottom"
      : "top";
    setPlacement({ horizontal, vertical });
  }, []);

  return (
    <div
      ref={tileRef}
      className="group relative"
      onMouseEnter={() => {
        updatePlacement();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        data-potion-tile={potion.id}
        className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 p-1 transition-all sm:h-16 sm:w-16 ${
          hovered
            ? "z-10 scale-110 border-yellow-500/60 bg-yellow-500/10"
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
        onClick={onClick}
      >
        <Image
          src={potion.imageUrl}
          alt={potion.name}
          width={48}
          height={48}
          loading="lazy"
          className="h-10 w-10 object-contain sm:h-12 sm:w-12"
          style={{
            filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        />
      </button>

      {hovered && (
        <div
          className={`pointer-events-none absolute z-50 hidden w-max max-w-[24rem] md:block ${
            placement.horizontal === "right" ? "left-full ml-3" : "right-full mr-3"
          } ${placement.vertical === "top" ? "top-0" : "bottom-0"}`}
        >
          <span className="flex w-max max-w-[24rem] items-start gap-2.5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/20">
              <Image
                src={potion.imageUrl}
                alt={potion.name}
                width={64}
                height={64}
                loading="lazy"
                className="h-14 w-14 object-contain"
                style={{
                  filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              />
            </span>
            <GameHoverTip title={potion.name} style={{ minWidth: 240, maxWidth: 320 }}>
              <DescriptionText description={potion.description} className="block text-left" />
            </GameHoverTip>
          </span>
        </div>
      )}
    </div>
  );
}

function getPotionTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<PotionSearchTokenType>[] {
  return [
    {
      trigger: "@",
      type: "pool",
      label: serviceText.labels.affiliation,
      items: [
        { value: "ironclad", label: serviceText.labels.pools.ironclad, desc: "Ironclad" },
        { value: "silent", label: serviceText.labels.pools.silent, desc: "Silent" },
        { value: "defect", label: serviceText.labels.pools.defect, desc: "Defect" },
        { value: "necrobinder", label: serviceText.labels.pools.necrobinder, desc: "Necrobinder" },
        { value: "regent", label: serviceText.labels.pools.regent, desc: "Regent" },
        { value: "shared", label: serviceText.labels.pools.shared, desc: "Shared" },
        { value: "event", label: gameUi.eventsTitle, desc: "Event" },
      ],
      validate: (val) => POOL_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
      maxPreviewItems: 4,
    },
    {
      trigger: "$",
      type: "rarity",
      label: gameUi.common.rarity,
      items: [
        { value: "common", label: gameUi.potionLab.rarities.일반.label, desc: "Common" },
        { value: "uncommon", label: gameUi.potionLab.rarities.고급.label, desc: "Uncommon" },
        { value: "rare", label: gameUi.potionLab.rarities.희귀.label, desc: "Rare" },
        { value: "event", label: gameUi.potionLab.rarities.이벤트.label, desc: "Event" },
        { value: "token", label: gameUi.potionLab.rarities.토큰.label, desc: "Token" },
      ],
      validate: (val) => POTION_RARITY_ALIASES[val] ?? null,
      chipColor: "bg-green-500/20 text-green-400",
    },
  ];
}

function getPotionSectionKey(rarity: PotionRarityKo): string {
  if (rarity === "일반") return "common";
  if (rarity === "고급") return "uncommon";
  if (rarity === "희귀") return "rare";
  return "special";
}
