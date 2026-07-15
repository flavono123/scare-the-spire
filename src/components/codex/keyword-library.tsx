"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexCard, CodexKeyword } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { DescriptionText } from "./codex-description";
import {
  FilterSection,
  ToggleButton,
} from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { KeywordDetail } from "./keyword-detail";
import { SearchBar } from "./search-bar";

interface KeywordLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  keywords: CodexKeyword[];
  cards?: CodexCard[];
  entities?: EntityInfo[];
}

const KEYWORD_SOURCE_ORDER: CodexKeyword["source"][] = ["cardKeyword", "staticHoverTip"];

const KEYWORD_SOURCE_CONFIG: Record<CodexKeyword["source"], { color: string; label: Record<ServiceLocale, string> }> = {
  cardKeyword: {
    color: "#efc851",
    label: { ko: "카드 키워드", en: "Card keyword" },
  },
  staticHoverTip: {
    color: "#7dd3fc",
    label: { ko: "툴팁 키워드", en: "Hover tip" },
  },
};

function KeywordTile({
  serviceLocale,
  keyword,
  onClick,
}: {
  serviceLocale: ServiceLocale;
  keyword: CodexKeyword;
  onClick: () => void;
}) {
  return (
    <Link
      href={localizeHref(buildCompendiumResourceDetailHref("keyword", keyword.id), serviceLocale)}
      className="group block h-full min-h-36 w-full text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onClick();
      }}
    >
      <GameHoverTip
        title={keyword.name}
        className="h-full w-full transition-[filter] group-hover:brightness-110 group-focus-visible:brightness-110"
        style={{ minWidth: 0, width: "100%", minHeight: 144 }}
      >
        <DescriptionText description={keyword.description} className="block text-left line-clamp-3" />
      </GameHoverTip>
    </Link>
  );
}

export function KeywordLibrary({
  serviceLocale,
  gameUi,
  title,
  keywords,
  cards = [],
  entities,
}: KeywordLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlKeywordId = useHydrationSafeSearchParam("keyword");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<CodexKeyword["source"]>>(new Set());
  const [selectedKeywordIdOverride, setSelectedKeywordIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedKeywordId = useUrlSelection ? urlKeywordId : selectedKeywordIdOverride;

  const selectKeyword = useCallback((keywordId: string) => {
    setUseUrlSelection(false);
    setSelectedKeywordIdOverride(keywordId);
  }, [setSelectedKeywordIdOverride, setUseUrlSelection]);

  const closeSelectedKeyword = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedKeywordIdOverride(null);
  }, [setSelectedKeywordIdOverride, setUseUrlSelection]);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedKeywordIdOverride) {
      url.searchParams.set("keyword", selectedKeywordIdOverride.toLowerCase());
    } else {
      url.searchParams.delete("keyword");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedKeywordIdOverride, useUrlSelection]);

  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedKeywordIdOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  useEffect(() => {
    if (!selectedKeywordId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedKeyword();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedKeyword, selectedKeywordId]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredKeywords = useMemo(() => {
    let result = keywords;
    if (selectedSources.size > 0) {
      result = result.filter((keyword) => selectedSources.has(keyword.source));
    }
    if (searchText) {
      result = result.filter((keyword) =>
        fuzzyMatchCodexText(keyword.name, searchText) ||
        fuzzyMatchCodexText(keyword.nameEn, searchText) ||
        fuzzyMatchCodexText(keyword.id, searchText) ||
        fuzzyMatchCodexText(keyword.sourceId, searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(keyword.description), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(keyword.descriptionEn), searchText),
      );
    }
    return result;
  }, [keywords, searchText, selectedSources]);

  const groupedKeywords = useMemo(() => {
    return KEYWORD_SOURCE_ORDER.map((source) => ({
      source,
      keywords: filteredKeywords
        .filter((keyword) => keyword.source === source)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko")),
    })).filter((group) => group.keywords.length > 0);
  }, [filteredKeywords]);

  const selectedKeyword = useMemo(() => {
    if (!selectedKeywordId) return null;
    return keywords.find((keyword) => keyword.id.toLowerCase() === selectedKeywordId.toLowerCase()) ?? null;
  }, [keywords, selectedKeywordId]);

  const toggleSource = useCallback((source: CodexKeyword["source"]) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
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

          <FilterSection trigger="#" label={serviceLocale === "ko" ? "출처" : "Source"}>
            <div className="flex flex-col gap-1">
              {KEYWORD_SOURCE_ORDER.map((source) => {
                const config = KEYWORD_SOURCE_CONFIG[source];
                return (
                  <ToggleButton
                    key={source}
                    label={config.label[serviceLocale]}
                    active={selectedSources.has(source)}
                    onClick={() => toggleSource(source)}
                  />
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
          title={title}
          count={formatCodexCount(filteredKeywords.length, serviceText.labels.keywords, serviceLocale)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedKeywords.map(({ source, keywords: groupKeywords }) => {
            const config = KEYWORD_SOURCE_CONFIG[source];
            return (
              <section key={source} className="mb-8 last:mb-0">
                <div className="mb-3">
                  <h2
                    className="font-game-title text-lg font-bold"
                    style={{ color: config.color }}
                  >
                    {config.label[serviceLocale]}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {groupKeywords.map((keyword) => (
                    <KeywordTile
                      key={keyword.id}
                      serviceLocale={serviceLocale}
                      keyword={keyword}
                      onClick={() => selectKeyword(keyword.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filteredKeywords.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {selectedKeyword && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSelectedKeyword();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <KeywordDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              keyword={selectedKeyword}
              relatedCards={cards}
              entities={entities}
              onClose={closeSelectedKeyword}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}
