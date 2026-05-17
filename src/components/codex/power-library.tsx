"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexPower,
  PowerType,
  POWER_TYPE_ORDER,
  POWER_TYPE_CONFIG,
  POWER_TYPE_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import { reconstructEntityAtVersion } from "@/lib/entity-versioning";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { PowerTile } from "./power-tile";
import { PowerDetail } from "./power-detail";
import { SearchBar } from "./search-bar";
import { FilterSection, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";

type PowerSearchTokenType = "powerType";

interface PowerLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  powers: CodexPower[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
}

export function PowerLibrary({ serviceLocale, gameUi, title, powers, versions, currentVersion, patches, versionDiffs }: PowerLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedTypes, setSelectedTypes] = useState<Set<PowerType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [showBeta, setShowBeta] = useState(false);

  // Power detail modal
  const initialPowerId = searchParams.get("power");
  const [selectedPower, setSelectedPower] = useState<CodexPower | null>(() => {
    if (!initialPowerId) return null;
    return powers.find((p) => p.id.toLowerCase() === initialPowerId.toLowerCase()) ?? null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPower) {
      url.searchParams.set("power", selectedPower.id.toLowerCase());
    } else {
      url.searchParams.delete("power");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedPower]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("power");
      if (!param) {
        setSelectedPower(null);
      } else {
        setSelectedPower(powers.find((p) => p.id.toLowerCase() === param.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [powers]);

  useEffect(() => {
    if (!selectedPower) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPower(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPower]);

  const versionedPowers = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return powers;
    return powers.map((power) =>
      reconstructEntityAtVersion(power, "power", selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [powers, selectedVersion, currentVersion, versionDiffs, patches]);

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

  const powerTriggers = useMemo(
    () => getPowerTriggers(serviceText, gameUi),
    [serviceText, gameUi],
  );

  // Parse search query
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, powerTriggers),
    [searchQuery, powerTriggers],
  );

  // Filtered powers
  const filteredPowers = useMemo(() => {
    let result = versionedPowers;

    // Type filter (sidebar)
    if (selectedTypes.size > 0) {
      result = result.filter((p) => selectedTypes.has(p.type));
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "powerType") {
        result = result.filter((p) => p.type === token.value);
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
  }, [versionedPowers, selectedTypes, parsedSearch]);

  // Group by type
  const groupedPowers = useMemo(() => {
    const groups: { type: PowerType; powers: CodexPower[] }[] = [];
    for (const type of POWER_TYPE_ORDER) {
      const group = filteredPowers
        .filter((p) => p.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ type, powers: group });
      }
    }
    return groups;
  }, [filteredPowers]);

  const toggleType = useCallback((type: PowerType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const typeFilters = POWER_TYPE_ORDER.filter((t) => t !== "None").map((t) => ({
    key: t,
    label: getPowerTypeLabel(t, serviceText, gameUi),
    color: POWER_TYPE_CONFIG[t].color,
  }));

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        {/* Type filter */}
        <FilterSection trigger="#" label={serviceText.powersView.typeFilter}>
          <div className="flex flex-col gap-0.5">
            {typeFilters.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedTypes.has(t.key)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        <div className="flex flex-col gap-1">
          <ToggleButton
            label={serviceText.cardsView.toggles.betaArt}
            active={showBeta}
            onClick={() => setShowBeta((v) => !v)}
          />
        </div>
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
              inputId="codex-search"
              triggerGroups={powerTriggers}
              placeholder={serviceText.powersView.searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredPowers.length, serviceText.labels.powers, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Power Grid (grouped by type) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedPowers.map(({ type, powers: groupPowers }) => (
            <section key={type} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="font-game-title text-lg font-bold mb-0.5"
                  style={{ color: POWER_TYPE_CONFIG[type].color }}
                >
                  {getPowerTypeLabel(type, serviceText, gameUi)}
                  {getPowerTypeDescription(type, serviceText, gameUi) && (
                    <span className="font-game-text text-sm font-normal text-gray-400 ml-2">
                      {getPowerTypeDescription(type, serviceText, gameUi)}
                    </span>
                  )}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {groupPowers.map((power) => (
                  <PowerTile key={power.id} serviceLocale={serviceLocale} gameUi={gameUi} power={power} showBeta={showBeta} onClick={() => setSelectedPower(power)} />
                ))}
              </div>
            </section>
          ))}

          {filteredPowers.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Power Detail Modal */}
      {selectedPower && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPower(null);
          }}
        >
          <div className="w-full max-w-lg my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <PowerDetail serviceLocale={serviceLocale} gameUi={gameUi} power={selectedPower} initialShowBeta={showBeta} onClose={() => setSelectedPower(null)} />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function getPowerTypeLabel(
  type: PowerType,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return gameUi.powers.types[type].label || serviceText.labels.powerTypes[type].label;
}

function getPowerTypeDescription(
  type: PowerType,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return gameUi.powers.types[type].description || (type === "None" ? serviceText.labels.powerTypes[type].description : "");
}

function getPowerTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<PowerSearchTokenType>[] {
  return [
    {
      trigger: "#",
      type: "powerType",
      label: serviceText.powersView.typeFilter,
      items: [
        { value: "buff", label: getPowerTypeLabel("Buff", serviceText, gameUi), desc: "Buff" },
        { value: "debuff", label: getPowerTypeLabel("Debuff", serviceText, gameUi), desc: "Debuff" },
        { value: "other", label: getPowerTypeLabel("None", serviceText, gameUi), desc: "Other" },
      ],
      validate: (val) => POWER_TYPE_ALIASES[val] ?? null,
      chipColor: "bg-green-500/20 text-green-400",
    },
  ];
}
