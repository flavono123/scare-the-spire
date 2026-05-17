"use client";

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  formatTemplateCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAncient, EventAct } from "@/lib/codex-types";
import {
  EVENT_ACT_ALIASES,
  EVENT_ACT_ORDER,
  EVENT_ACT_UNKNOWN,
} from "@/lib/codex-types";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { FilterSection } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { SearchBar } from "./search-bar";

type AncientSearchTokenType = "act";
const COMPENDIUM_ACT_COLOR = "#60a5fa";
const COMPENDIUM_ACT_TEXT_CLASS = "text-blue-300";

function ActBadge({
  act,
  messages,
  gameUi,
}: {
  act: EventAct | null;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  const label = act ? gameUi.acts[act] : messages.labels.acts.none;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        act
          ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
          : `${EVENT_ACT_UNKNOWN.border} ${EVENT_ACT_UNKNOWN.bg} ${EVENT_ACT_UNKNOWN.color}`
      }`}
    >
      {label}
    </span>
  );
}

interface AncientListProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  ancients: CodexAncient[];
}

export function AncientList({ serviceLocale, gameUi, ancients }: AncientListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

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

  const ancientTriggers = useMemo(
    () => getAncientTriggers(serviceText, gameUi),
    [serviceText, gameUi],
  );

  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, ancientTriggers),
    [searchQuery, ancientTriggers],
  );

  const filteredAncients = useMemo(() => {
    return ancients.filter((ancient) => {
      const actKey = ancient.act ?? "none";
      if (selectedActs.size > 0 && !selectedActs.has(actKey)) return false;

      const actTokens = parsedSearch.tokens.filter((token) => token.type === "act");
      if (actTokens.length > 0 && !actTokens.some((token) => token.value === actKey)) {
        return false;
      }

      if (!parsedSearch.text) return true;

      return (
        fuzzyMatchCodexText(ancient.name, parsedSearch.text) ||
        fuzzyMatchCodexText(ancient.nameEn, parsedSearch.text) ||
        fuzzyMatchCodexText(ancient.epithet, parsedSearch.text) ||
        fuzzyMatchCodexText(ancient.epithetEn, parsedSearch.text) ||
        stripCodexMarkup(ancient.description).toLowerCase().includes(parsedSearch.text)
      );
    });
  }, [ancients, selectedActs, parsedSearch]);

  const groupedAncients = useMemo(() => {
    const groups: { act: EventAct | null; label: string; color: string; ancients: CodexAncient[] }[] = [];
    for (const act of EVENT_ACT_ORDER) {
      const items = filteredAncients
        .filter((ancient) => ancient.act === act)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (items.length === 0) continue;

      groups.push({
        act,
        label: getActLabel(act, serviceText, gameUi),
        color: act ? COMPENDIUM_ACT_COLOR : "#a1a1aa",
        ancients: items,
      });
    }
    return groups;
  }, [filteredAncients, gameUi, serviceText]);

  const actCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ancient of ancients) {
      const key = ancient.act ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [ancients]);

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
    ? `${gameUi.ancientsTitle} 검색...`
    : `Search ${gameUi.ancientsTitle.toLowerCase()}...`;

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <FilterSection trigger="%" label={serviceText.eventsView.actFilter}>
          <div className="flex flex-col gap-0.5">
            {EVENT_ACT_ORDER.map((act) => {
              const key = act ?? "none";
              const count = actCounts.get(key) ?? 0;
              const label = getActLabel(act, serviceText, gameUi);
              return (
                <button
                  key={key}
                  onClick={() => toggleAct(key)}
                  className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                    selectedActs.has(key)
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: act ? COMPENDIUM_ACT_COLOR : "#666" }}
                  />
                  <span className={act ? COMPENDIUM_ACT_TEXT_CLASS : "text-zinc-400"}>{label}</span>
                  <span className="text-xs text-zinc-600">({count})</span>
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}
    >
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={gameUi.ancientsTitle}
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={ancientTriggers}
              placeholder={searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredAncients.length, serviceText.labels.items, serviceLocale)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedAncients.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedAncients.map((group) => (
                <section key={group.act ?? "none"}>
                  <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: group.color }}>
                    {group.label}
                    <span className="text-xs font-normal text-zinc-600">
                      {group.ancients.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.ancients.map((ancient) => (
                      <AncientCard
                        key={ancient.id}
                        ancient={ancient}
                        relicCount={ancient.relicIds.length}
                        serviceLocale={serviceLocale}
                        messages={serviceText}
                        gameUi={gameUi}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </CodexLibraryShell>
  );
}

function AncientCard({
  ancient,
  relicCount,
  serviceLocale,
  messages,
  gameUi,
}: {
  ancient: CodexAncient;
  relicCount: number;
  serviceLocale: ServiceLocale;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  return (
    <Link
      href={localizeHref(`/compendium/ancients/${ancient.id.toLowerCase()}`, serviceLocale)}
      className="group relative overflow-hidden rounded-xl border border-blue-900/30 bg-[#12121a] hover:border-blue-600/50 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden">
        {ancient.imageUrl && (
          <Image
            src={ancient.imageUrl}
            alt={ancient.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
      </div>

      {/* Text */}
      <div className="relative px-4 pb-4 -mt-8">
        <h2 className="font-game-title text-lg text-blue-300 group-hover:text-blue-200 transition-colors">
          {ancient.name}
        </h2>
        <p className="font-game-text text-[11px] text-blue-400/50 mt-0.5">{ancient.nameEn}</p>
        <p className="text-xs text-zinc-400 mt-1 italic">{ancient.epithet}</p>
        <div className="flex items-center gap-2 mt-2">
          <ActBadge act={ancient.act} messages={messages} gameUi={gameUi} />
          <span className="text-[10px] text-zinc-500">
            {formatTemplateCount(messages.ancientsView.relicCount, relicCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getActLabel(
  act: EventAct | null,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : serviceText.labels.acts.none;
}

function getAncientTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<AncientSearchTokenType>[] {
  return [
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
      validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}
