"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type {
  CodexAncient,
  CodexCard,
  CodexEpoch,
  CodexPotion,
  CodexRelic,
  EpochAffiliation,
  EpochUnlockCondition,
  EpochUnlockReward,
} from "@/lib/codex-types";
import {
  EPOCH_AFFILIATION_ORDER,
  EPOCH_UNLOCK_CONDITION_ORDER,
  EPOCH_UNLOCK_REWARD_ORDER,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import type { STS2Change } from "@/lib/types";
import { withEntityLifecycleForVersion } from "@/lib/entity-lifecycle";
import {
  FilterSection,
  IconFilterButton,
  ToggleButton,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { SearchBar } from "./search-bar";
import { EpochDetail } from "./epoch-detail";
import { VersionSelector } from "./version-selector";
import { EVENT_FILTER_ICON, getCharacterTokenIcon } from "./codex-filter-assets";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import {
  getEpochAffiliationColor,
  getEpochAffiliationLabel,
  getEpochUnlockConditionLabel,
  getEpochUnlockRewardColor,
  getEpochUnlockRewardLabel,
} from "./epoch-display";

const AFFILIATION_ICONS: Partial<Record<EpochAffiliation, string>> = {
  ironclad: getCharacterTokenIcon("ironclad", "/images/sts2/characters/character_icon_ironclad.webp"),
  silent: getCharacterTokenIcon("silent", "/images/sts2/characters/character_icon_silent.webp"),
  regent: getCharacterTokenIcon("regent", "/images/sts2/characters/character_icon_regent.webp"),
  necrobinder: getCharacterTokenIcon("necrobinder", "/images/sts2/characters/character_icon_necrobinder.webp"),
  defect: getCharacterTokenIcon("defect", "/images/sts2/characters/character_icon_defect.webp"),
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

interface EpochLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  epochs: CodexEpoch[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  potions?: CodexPotion[];
  ancients?: CodexAncient[];
  changes?: STS2Change[];
  versions?: string[];
  currentVersion?: string;
  entities?: EntityInfo[];
  initialShowBeta?: boolean;
}

function isBetaArtParamEnabled(value: string | null): boolean {
  const normalized = value?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function EpochLibrary({
  serviceLocale,
  gameUi,
  epochs,
  cards = [],
  relics = [],
  potions = [],
  ancients = [],
  changes,
  versions,
  currentVersion,
  entities,
  initialShowBeta = false,
}: EpochLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [selectedAffiliations, setSelectedAffiliations] = useState<Set<EpochAffiliation>>(new Set());
  const [selectedUnlockConditions, setSelectedUnlockConditions] = useState<Set<EpochUnlockCondition>>(new Set());
  const [selectedUnlockRewards, setSelectedUnlockRewards] = useState<Set<EpochUnlockReward>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [affiliationSortDir, setAffiliationSortDir] = useState<FilterSortDir>("asc");
  const [unlockConditionSortDir, setUnlockConditionSortDir] = useState<FilterSortDir>("asc");
  const [unlockRewardSortDir, setUnlockRewardSortDir] = useState<FilterSortDir>("asc");
  const [selectedEpoch, setSelectedEpoch] = useState<CodexEpoch | null>(null);
  const [showBeta, setShowBeta] = useState(initialShowBeta);
  const [urlReady, setUrlReady] = useState(false);
  const urlBetaArt = useHydrationSafeSearchParam("beta", initialShowBeta ? "true" : null);
  const activeShowBeta = urlBetaArt !== null ? isBetaArtParamEnabled(urlBetaArt) : showBeta;
  const versionedEpochs = useMemo(() => {
    if (!currentVersion || !selectedVersion) return epochs;
    return withEntityLifecycleForVersion(epochs, selectedVersion, { changes, entityType: "epoch" });
  }, [epochs, changes, currentVersion, selectedVersion]);
  const hasBetaArt = versionedEpochs.some((epoch) => epoch.betaImageUrl);

  const selectEpoch = useCallback((epoch: CodexEpoch) => {
    setSelectedEpoch(epoch);
  }, [setSelectedEpoch]);

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      const url = new URL(window.location.href);
      const epochParam = url.searchParams.get("epoch");
      setSelectedEpoch(epochParam
        ? versionedEpochs.find((epoch) => epoch.id.toLowerCase() === epochParam.toLowerCase()) ?? null
        : null);
      setUrlReady(true);
    }, 0);
    return () => {
      cancelled = true;
    };
  }, [versionedEpochs]);

  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    if (selectedEpoch) {
      url.searchParams.set("epoch", selectedEpoch.id.toLowerCase());
    } else {
      url.searchParams.delete("epoch");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedEpoch, urlReady]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const epochParam = url.searchParams.get("epoch");
      if (!epochParam) {
        setSelectedEpoch(null);
      } else {
        setSelectedEpoch(versionedEpochs.find((epoch) => epoch.id.toLowerCase() === epochParam.toLowerCase()) ?? null);
      }
    };
    return addCodexUrlChangeListener(handler);
  }, [versionedEpochs]);

  useEffect(() => {
    if (!selectedEpoch) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEpoch(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEpoch]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const activeAffiliations = useMemo(
    () => new Set<EpochAffiliation>(selectedAffiliations),
    [selectedAffiliations],
  );
  const activeUnlockConditions = useMemo(
    () => new Set<EpochUnlockCondition>(selectedUnlockConditions),
    [selectedUnlockConditions],
  );
  const activeUnlockRewards = useMemo(
    () => new Set<EpochUnlockReward>(selectedUnlockRewards),
    [selectedUnlockRewards],
  );

  const filteredEpochs = useMemo(() => {
    return versionedEpochs.filter((epoch) => {
      if (
        activeAffiliations.size > 0 &&
        !epoch.affiliations.some((affiliation) => activeAffiliations.has(affiliation))
      ) {
        return false;
      }
      if (
        activeUnlockConditions.size > 0 &&
        !epoch.unlockConditions.some((condition) => activeUnlockConditions.has(condition))
      ) {
        return false;
      }
      if (
        activeUnlockRewards.size > 0 &&
        !epoch.unlockRewards.some((reward) => activeUnlockRewards.has(reward))
      ) {
        return false;
      }

      if (!searchText) return true;
      return (
        fuzzyMatchCodexText(epoch.name, searchText) ||
        fuzzyMatchCodexText(epoch.nameEn, searchText) ||
        fuzzyMatchCodexText(epoch.eraName ?? "", searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.description), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.descriptionEn), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.unlockInfo), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.unlockInfoEn), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.unlockText ?? ""), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(epoch.unlockTextEn ?? ""), searchText)
      );
    });
  }, [versionedEpochs, activeAffiliations, activeUnlockConditions, activeUnlockRewards, searchText]);

  const groupedEpochs = useMemo(() => {
    const map = new Map<string, CodexEpoch[]>();
    for (const epoch of filteredEpochs) {
      const group = map.get(epoch.eraGroup);
      if (group) group.push(epoch);
      else map.set(epoch.eraGroup, [epoch]);
    }

    return Array.from(map.entries())
      .map(([eraGroup, items]) => {
        const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
        const first = sorted[0];
        return {
          eraGroup,
          label: first?.eraName ?? eraGroup,
          year: first?.eraYear ?? null,
          sortOrder: first?.sortOrder ?? 0,
          epochs: sorted,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filteredEpochs]);

  const affiliationCounts = useMemo(() => {
    const counts = new Map<EpochAffiliation, number>();
    for (const epoch of versionedEpochs) {
      for (const affiliation of epoch.affiliations) {
        counts.set(affiliation, (counts.get(affiliation) ?? 0) + 1);
      }
    }
    return counts;
  }, [versionedEpochs]);

  const unlockConditionCounts = useMemo(() => {
    const counts = new Map<EpochUnlockCondition, number>();
    for (const epoch of versionedEpochs) {
      for (const condition of epoch.unlockConditions) {
        counts.set(condition, (counts.get(condition) ?? 0) + 1);
      }
    }
    return counts;
  }, [versionedEpochs]);

  const unlockRewardCounts = useMemo(() => {
    const counts = new Map<EpochUnlockReward, number>();
    for (const epoch of versionedEpochs) {
      for (const reward of epoch.unlockRewards) {
        counts.set(reward, (counts.get(reward) ?? 0) + 1);
      }
    }
    return counts;
  }, [versionedEpochs]);

  const toggleAffiliation = useCallback((affiliation: EpochAffiliation) => {
    setSelectedAffiliations((prev) => {
      const next = new Set(prev);
      if (next.has(affiliation)) next.delete(affiliation);
      else next.add(affiliation);
      return next;
    });
  }, []);

  const toggleUnlockCondition = useCallback((condition: EpochUnlockCondition) => {
    setSelectedUnlockConditions((prev) => {
      const next = new Set(prev);
      if (next.has(condition)) next.delete(condition);
      else next.add(condition);
      return next;
    });
  }, []);

  const toggleUnlockReward = useCallback((reward: EpochUnlockReward) => {
    setSelectedUnlockRewards((prev) => {
      const next = new Set(prev);
      if (next.has(reward)) next.delete(reward);
      else next.add(reward);
      return next;
    });
  }, []);

  const setBetaArt = useCallback((next: boolean) => {
    setShowBeta(next);
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set("beta", "true");
    } else {
      url.searchParams.delete("beta");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
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

          <FilterSection trigger="@" label={serviceText.labels.affiliation} sortDir={affiliationSortDir} onSortToggle={() => setAffiliationSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
            <div className="grid grid-cols-5 gap-1.5">
              {orderByFilterSortDir(EPOCH_AFFILIATION_ORDER, affiliationSortDir).map((affiliation) => {
                const count = affiliationCounts.get(affiliation) ?? 0;
                if (count === 0) return null;
                return (
                  <IconFilterButton
                    key={affiliation}
                    icon={AFFILIATION_ICONS[affiliation] ?? EVENT_FILTER_ICON}
                    label={getEpochAffiliationLabel(affiliation, serviceText, serviceLocale)}
                    active={selectedAffiliations.has(affiliation)}
                    onClick={() => toggleAffiliation(affiliation)}
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection trigger="#" label={serviceLocale === "ko" ? "해금 조건" : "Unlock Condition"} sortDir={unlockConditionSortDir} onSortToggle={() => setUnlockConditionSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
            <div className="flex flex-col gap-0.5">
              {orderByFilterSortDir(EPOCH_UNLOCK_CONDITION_ORDER, unlockConditionSortDir).map((condition) => {
                const count = unlockConditionCounts.get(condition) ?? 0;
                if (count === 0) return null;
                return (
                  <ToggleButton
                    key={condition}
                    label={`${getEpochUnlockConditionLabel(condition, serviceLocale)} (${count})`}
                    active={selectedUnlockConditions.has(condition)}
                    onClick={() => toggleUnlockCondition(condition)}
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection trigger="$" label={serviceLocale === "ko" ? "해금 대상" : "Unlock Target"} sortDir={unlockRewardSortDir} onSortToggle={() => setUnlockRewardSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
            <div className="flex flex-col gap-0.5">
              {orderByFilterSortDir(EPOCH_UNLOCK_REWARD_ORDER, unlockRewardSortDir).map((reward) => {
                const count = unlockRewardCounts.get(reward) ?? 0;
                if (count === 0) return null;
                return (
                  <ToggleButton
                    key={reward}
                    label={`${getEpochUnlockRewardLabel(reward, serviceLocale)} (${count})`}
                    active={selectedUnlockRewards.has(reward)}
                    onClick={() => toggleUnlockReward(reward)}
                  />
                );
              })}
            </div>
          </FilterSection>

          {hasBetaArt && (
            <>
              <div className="border-t border-white/10" />
              <div className="flex flex-col gap-1">
                <ToggleButton
                  label={serviceText.cardsView.toggles.betaArt}
                  active={activeShowBeta}
                  onClick={() => setBetaArt(!activeShowBeta)}
                />
              </div>
            </>
          )}
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={gameUi.epochsTitle}
          count={formatCodexCount(filteredEpochs.length, serviceText.labels.items, serviceLocale)}
          trailing={versions && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedEpochs.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedEpochs.map((group) => (
                <section key={group.eraGroup}>
                  <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-blue-300">
                    {group.label}
                    {group.year && (
                      <span className="text-xs font-normal text-blue-300/55">
                        {formatEraYear(group.year, serviceLocale)}
                      </span>
                    )}
                    <span className="text-xs font-normal text-zinc-600">
                      {formatEpochCount(group.epochs.length, serviceLocale)}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {group.epochs.map((epoch, index) => (
                      <div
                        key={epoch.id}
                        className="animate-card-enter"
                        style={{ animationDelay: `${Math.min(index * 10, 160)}ms` }}
                      >
                        <EpochThumbnail
                          epoch={epoch}
                          serviceLocale={serviceLocale}
                          messages={serviceText}
                          showBeta={activeShowBeta}
                          onSelect={selectEpoch}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedEpoch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedEpoch.name}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedEpoch(null);
          }}
        >
          <div className="mx-4 my-4 w-full max-w-[92rem]">
            <EpochDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={gameUi.epochsTitle}
              epoch={selectedEpoch}
              cards={cards}
              relics={relics}
              potions={potions}
              ancients={ancients}
              epochs={versionedEpochs}
              entities={entities}
              initialShowBeta={activeShowBeta}
              onShowBetaChange={setBetaArt}
              onClose={() => setSelectedEpoch(null)}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function EpochThumbnail({
  epoch,
  serviceLocale,
  messages,
  showBeta,
  onSelect,
}: {
  epoch: CodexEpoch;
  serviceLocale: ServiceLocale;
  messages: CodexServiceMessages;
  showBeta: boolean;
  onSelect: (epoch: CodexEpoch) => void;
}) {
  const eraLabel = formatEraLabel(epoch.eraName ?? epoch.eraGroup, epoch.eraYear, serviceLocale);
  const affiliationBadges = epoch.affiliations.slice(0, 2);
  const rewardBadges = epoch.unlockRewards.filter((reward) => reward !== "none").slice(0, 1);
  const extraBadgeCount = Math.max(0, epoch.affiliations.length - affiliationBadges.length)
    + Math.max(0, epoch.unlockRewards.filter((reward) => reward !== "none").length - rewardBadges.length);
  const imageUrl = showBeta && epoch.betaImageUrl ? epoch.betaImageUrl : epoch.imageUrl ?? epoch.betaImageUrl;

  return (
    <Link
      href={localizeHref(`/compendium/epochs/${epoch.id.toLowerCase()}`, serviceLocale)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(epoch);
      }}
      className={`group relative block h-[132px] overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 text-left shadow-sm shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-500/40 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/30 ${
        epoch.deprecated ? "opacity-50 grayscale saturate-0" : ""
      }`}
    >
      {imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 50vw"
            loading="lazy"
            className="object-cover opacity-45 transition-all duration-300 group-hover:scale-[1.03] group-hover:opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/65 to-black/90 transition-opacity duration-200 group-hover:opacity-90" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 to-zinc-900/80" />
      )}
      <div className="relative flex h-full min-w-0 flex-col justify-between gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-game-title text-lg font-semibold text-zinc-100 transition-colors group-hover:text-yellow-200">
            {epoch.name}
          </h3>
          <span className="font-game-text text-[11px] text-zinc-500 group-hover:text-zinc-400">
            {epoch.nameEn}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge value={eraLabel} color="#60a5fa" />
          {affiliationBadges.map((affiliation) => (
            <Badge
              key={affiliation}
              value={getEpochAffiliationLabel(affiliation, messages, serviceLocale)}
              color={getEpochAffiliationColor(affiliation)}
            />
          ))}
          {rewardBadges.map((reward) => (
            <Badge
              key={reward}
              value={getEpochUnlockRewardLabel(reward, serviceLocale)}
              color={getEpochUnlockRewardColor(reward)}
            />
          ))}
          {extraBadgeCount > 0 && (
            <span className="text-[10px] text-zinc-500">+{extraBadgeCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Badge({ value, color }: { value: string; color: string }) {
  return (
    <span
      className="rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-bold"
      style={{ color }}
    >
      {value}
    </span>
  );
}

function formatEraYear(year: string, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? `${year}년` : `Year ${year}`;
}

function formatEraLabel(label: string, year: string | null, serviceLocale: ServiceLocale): string {
  return year ? `${label} · ${formatEraYear(year, serviceLocale)}` : label;
}

function formatEpochCount(count: number, serviceLocale: ServiceLocale): string {
  return serviceLocale === "ko" ? `${count}개` : `${count} items`;
}
