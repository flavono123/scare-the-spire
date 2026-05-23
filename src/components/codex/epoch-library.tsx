"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  EpochUnlockKind,
  EventAct,
} from "@/lib/codex-types";
import {
  EPOCH_AFFILIATION_ORDER,
  EPOCH_UNLOCK_KIND_ORDER,
  EVENT_ACT_ALIASES,
  EVENT_ACT_ORDER,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { FilterSection, ToggleButton } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { SearchBar } from "./search-bar";
import { EpochDetail } from "./epoch-detail";
import { getCharacterTokenIcon } from "./codex-filter-assets";
import {
  EPOCH_AFFILIATION_ALIASES,
  EPOCH_UNLOCK_KIND_ALIASES,
  getEpochAffiliationColor,
  getEpochAffiliationLabel,
  getEpochUnlockKindColor,
  getEpochUnlockKindLabel,
} from "./epoch-display";

type EpochSearchTokenType = "affiliation" | "unlock" | "act";

const COMPENDIUM_ACT_COLOR = "#60a5fa";
const COMPENDIUM_ACT_TEXT_CLASS = "text-blue-300";

const AFFILIATION_ICONS: Partial<Record<EpochAffiliation, string>> = {
  ironclad: getCharacterTokenIcon("ironclad", "/images/sts2/characters/character_icon_ironclad.webp"),
  silent: getCharacterTokenIcon("silent", "/images/sts2/characters/character_icon_silent.webp"),
  regent: getCharacterTokenIcon("regent", "/images/sts2/characters/character_icon_regent.webp"),
  necrobinder: getCharacterTokenIcon("necrobinder", "/images/sts2/characters/character_icon_necrobinder.webp"),
  defect: getCharacterTokenIcon("defect", "/images/sts2/characters/character_icon_defect.webp"),
  ancient: "/images/sts2/nav/stats_ancients.png",
  world: "/images/sts2/icons/app_icon.png",
  spire: "/images/sts2/relics/history_course.webp",
  reopening: "/images/sts2/nav/patch_notes_icon.png",
};

function epochActKey(act: EventAct | null): string {
  return act ?? "none";
}

function epochMatchesActKeys(epoch: CodexEpoch, actKeys: Set<string>): boolean {
  if (actKeys.size === 0) return true;
  if (epoch.acts.length === 0) return actKeys.has("none");
  return epoch.acts.some((act) => actKeys.has(epochActKey(act)));
}

interface EpochLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  epochs: CodexEpoch[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  potions?: CodexPotion[];
  ancients?: CodexAncient[];
  entities?: EntityInfo[];
}

export function EpochLibrary({
  serviceLocale,
  gameUi,
  epochs,
  cards = [],
  relics = [],
  potions = [],
  ancients = [],
  entities,
}: EpochLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedAffiliations, setSelectedAffiliations] = useState<Set<EpochAffiliation>>(new Set());
  const [selectedUnlockKinds, setSelectedUnlockKinds] = useState<Set<EpochUnlockKind>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const initialEpochId = searchParams.get("epoch");
  const [selectedEpoch, setSelectedEpoch] = useState<CodexEpoch | null>(() => {
    if (!initialEpochId) return null;
    return epochs.find((epoch) => epoch.id.toLowerCase() === initialEpochId.toLowerCase()) ?? null;
  });

  const selectEpoch = useCallback((epoch: CodexEpoch) => {
    setSelectedEpoch(epoch);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedEpoch) {
      url.searchParams.set("epoch", selectedEpoch.id.toLowerCase());
    } else {
      url.searchParams.delete("epoch");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedEpoch]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const epochParam = url.searchParams.get("epoch");
      if (!epochParam) {
        setSelectedEpoch(null);
      } else {
        setSelectedEpoch(epochs.find((epoch) => epoch.id.toLowerCase() === epochParam.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [epochs]);

  useEffect(() => {
    if (!selectedEpoch) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEpoch(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEpoch]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        document.getElementById("codex-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const epochTriggers = useMemo(
    () => getEpochTriggers(serviceText, gameUi, serviceLocale),
    [serviceText, gameUi, serviceLocale],
  );
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, epochTriggers),
    [searchQuery, epochTriggers],
  );

  const activeAffiliations = useMemo(
    () => new Set<EpochAffiliation>([
      ...selectedAffiliations,
      ...parsedSearch.tokens
        .filter((token) => token.type === "affiliation")
        .map((token) => token.value as EpochAffiliation),
    ]),
    [selectedAffiliations, parsedSearch.tokens],
  );
  const activeUnlockKinds = useMemo(
    () => new Set<EpochUnlockKind>([
      ...selectedUnlockKinds,
      ...parsedSearch.tokens
        .filter((token) => token.type === "unlock")
        .map((token) => token.value as EpochUnlockKind),
    ]),
    [selectedUnlockKinds, parsedSearch.tokens],
  );
  const activeActKeys = useMemo(
    () => new Set([
      ...selectedActs,
      ...parsedSearch.tokens
        .filter((token) => token.type === "act")
        .map((token) => token.value),
    ]),
    [selectedActs, parsedSearch.tokens],
  );

  const filteredEpochs = useMemo(() => {
    return epochs.filter((epoch) => {
      if (activeAffiliations.size > 0 && !activeAffiliations.has(epoch.affiliation)) return false;
      if (activeUnlockKinds.size > 0 && !epoch.unlockKinds.some((kind) => activeUnlockKinds.has(kind))) return false;
      if (!epochMatchesActKeys(epoch, activeActKeys)) return false;

      if (!parsedSearch.text) return true;
      return (
        fuzzyMatchCodexText(epoch.name, parsedSearch.text) ||
        fuzzyMatchCodexText(epoch.nameEn, parsedSearch.text) ||
        fuzzyMatchCodexText(epoch.eraName ?? "", parsedSearch.text) ||
        stripCodexMarkup(epoch.description).toLowerCase().includes(parsedSearch.text) ||
        stripCodexMarkup(epoch.unlockInfo).toLowerCase().includes(parsedSearch.text) ||
        stripCodexMarkup(epoch.unlockText ?? "").toLowerCase().includes(parsedSearch.text)
      );
    });
  }, [epochs, activeAffiliations, activeUnlockKinds, activeActKeys, parsedSearch]);

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
    for (const epoch of epochs) {
      counts.set(epoch.affiliation, (counts.get(epoch.affiliation) ?? 0) + 1);
    }
    return counts;
  }, [epochs]);

  const unlockKindCounts = useMemo(() => {
    const counts = new Map<EpochUnlockKind, number>();
    for (const epoch of epochs) {
      for (const kind of epoch.unlockKinds) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return counts;
  }, [epochs]);

  const actCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const epoch of epochs) {
      if (epoch.acts.length === 0) {
        counts.set("none", (counts.get("none") ?? 0) + 1);
        continue;
      }
      for (const act of epoch.acts) {
        const key = epochActKey(act);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [epochs]);

  const toggleAffiliation = useCallback((affiliation: EpochAffiliation) => {
    setSelectedAffiliations((prev) => {
      const next = new Set(prev);
      if (next.has(affiliation)) next.delete(affiliation);
      else next.add(affiliation);
      return next;
    });
  }, []);

  const toggleUnlockKind = useCallback((kind: EpochUnlockKind) => {
    setSelectedUnlockKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const toggleAct = useCallback((act: string) => {
    setSelectedActs((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }, []);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();
  const searchPlaceholder = serviceLocale === "ko"
    ? `${gameUi.epochsTitle} 검색... (⌘K)`
    : `Search ${gameUi.epochsTitle.toLowerCase()}... (⌘K)`;

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
          <FilterSection trigger="@" label={serviceText.labels.affiliation}>
            <div className="grid grid-cols-2 gap-1.5">
              {EPOCH_AFFILIATION_ORDER.map((affiliation) => {
                const count = affiliationCounts.get(affiliation) ?? 0;
                if (count === 0) return null;
                return (
                  <EpochFilterButton
                    key={affiliation}
                    icon={AFFILIATION_ICONS[affiliation]}
                    label={getEpochAffiliationLabel(affiliation, serviceText, serviceLocale)}
                    count={count}
                    active={selectedAffiliations.has(affiliation)}
                    color={getEpochAffiliationColor(affiliation)}
                    onClick={() => toggleAffiliation(affiliation)}
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection trigger="#" label={serviceLocale === "ko" ? "해금" : "Unlock"}>
            <div className="flex flex-col gap-0.5">
              {EPOCH_UNLOCK_KIND_ORDER.map((kind) => {
                const count = unlockKindCounts.get(kind) ?? 0;
                if (count === 0) return null;
                return (
                  <ToggleButton
                    key={kind}
                    label={`${getEpochUnlockKindLabel(kind, serviceLocale)} (${count})`}
                    active={selectedUnlockKinds.has(kind)}
                    onClick={() => toggleUnlockKind(kind)}
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection trigger="%" label={serviceText.eventsView.actFilter}>
            <div className="flex flex-col gap-0.5">
              {EVENT_ACT_ORDER.map((act) => {
                const key = epochActKey(act);
                const count = actCounts.get(key) ?? 0;
                if (count === 0) return null;
                const label = getActLabel(act, serviceText, gameUi);
                return (
                  <button
                    key={key}
                    onClick={() => toggleAct(key)}
                    className={`flex items-center gap-2 rounded px-2.5 py-1 text-left text-sm transition-all ${
                      selectedActs.has(key)
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: act ? COMPENDIUM_ACT_COLOR : "#666" }}
                    />
                    <span className={act ? COMPENDIUM_ACT_TEXT_CLASS : "text-zinc-400"}>{label}</span>
                    <span className="text-xs text-zinc-600">({count})</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>
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
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={epochTriggers}
              placeholder={searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredEpochs.length, serviceText.labels.items, serviceLocale)}
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
                    {group.year && <span className="text-xs font-normal text-blue-300/55">{group.year}</span>}
                    <span className="text-xs font-normal text-zinc-600">{group.epochs.length}</span>
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
              epochs={epochs}
              entities={entities}
              onClose={() => setSelectedEpoch(null)}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function EpochFilterButton({
  icon,
  label,
  count,
  active,
  color,
  onClick,
}: {
  icon?: string;
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded border px-2 py-1.5 text-left transition-all ${
        active
          ? "border-yellow-500/60 bg-yellow-500/15"
          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
      }`}
      title={label}
    >
      {icon && (
        <span className="relative h-6 w-6 shrink-0">
          <Image src={icon} alt="" fill sizes="24px" className="object-contain" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold" style={{ color }}>{label}</span>
        <span className="block text-[10px] text-zinc-600">{count}</span>
      </span>
    </button>
  );
}

function EpochThumbnail({
  epoch,
  serviceLocale,
  messages,
  onSelect,
}: {
  epoch: CodexEpoch;
  serviceLocale: ServiceLocale;
  messages: CodexServiceMessages;
  onSelect: (epoch: CodexEpoch) => void;
}) {
  const affiliationLabel = getEpochAffiliationLabel(epoch.affiliation, messages, serviceLocale);
  const eraLabel = epoch.eraName
    ? epoch.eraYear ? `${epoch.eraName} ${epoch.eraYear}` : epoch.eraName
    : epoch.eraGroup;

  return (
    <Link
      href={localizeHref(`/compendium/epochs/${epoch.id.toLowerCase()}`, serviceLocale)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(epoch);
      }}
      className="group relative block h-[132px] overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 text-left shadow-sm shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-500/40 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/30"
    >
      {epoch.imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={epoch.imageUrl}
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 50vw"
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
          <Badge value={affiliationLabel} color={getEpochAffiliationColor(epoch.affiliation)} />
          {epoch.unlockKinds.slice(0, 2).map((kind) => (
            <Badge
              key={kind}
              value={getEpochUnlockKindLabel(kind, serviceLocale)}
              color={getEpochUnlockKindColor(kind)}
            />
          ))}
          {epoch.unlockKinds.length > 2 && (
            <span className="text-[10px] text-zinc-500">+{epoch.unlockKinds.length - 2}</span>
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

function getActLabel(
  act: EventAct | null,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : serviceText.labels.acts.none;
}

function getEpochTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
  serviceLocale: ServiceLocale,
): CodexSearchTriggerGroup<EpochSearchTokenType>[] {
  return [
    {
      trigger: "@",
      type: "affiliation",
      label: serviceText.labels.affiliation,
      items: EPOCH_AFFILIATION_ORDER.map((affiliation) => ({
        value: affiliation,
        label: getEpochAffiliationLabel(affiliation, serviceText, serviceLocale),
        desc: affiliation,
      })),
      validate: (value) => EPOCH_AFFILIATION_ALIASES[value] ?? null,
      chipColor: "bg-yellow-500/20 text-yellow-400",
    },
    {
      trigger: "#",
      type: "unlock",
      label: serviceLocale === "ko" ? "해금" : "Unlock",
      items: EPOCH_UNLOCK_KIND_ORDER.map((kind) => ({
        value: kind,
        label: getEpochUnlockKindLabel(kind, serviceLocale),
        desc: kind,
      })),
      validate: (value) => EPOCH_UNLOCK_KIND_ALIASES[value] ?? null,
      chipColor: "bg-purple-500/20 text-purple-300",
    },
    {
      trigger: "%",
      type: "act",
      label: serviceText.eventsView.actFilter,
      items: [
        { value: "act1", label: gameUi.acts["Act 1 - Overgrowth"], desc: "Act 1 Overgrowth" },
        { value: "underdocks", label: gameUi.acts.Underdocks, desc: "Underdocks" },
        { value: "act2", label: gameUi.acts["Act 2 - Hive"], desc: "Act 2 Hive" },
        { value: "act3", label: gameUi.acts["Act 3 - Glory"], desc: "Act 3 Glory" },
        { value: "none", label: serviceText.labels.acts.none, desc: "Any act" },
      ],
      validate: (value) => EVENT_ACT_ALIASES[value] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}
