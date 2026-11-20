"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexIntent } from "@/lib/codex-data";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { DescriptionText } from "./codex-description";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
  CompendiumIndexScroller,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { SearchBar } from "./search-bar";

export function IntentLibrary({
  serviceLocale,
  title,
  countLabel,
  intents,
  trailing,
}: {
  serviceLocale: ServiceLocale;
  title: string;
  countLabel: string;
  intents: CodexIntent[];
  trailing?: React.ReactNode;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [searchQuery, setSearchQuery] = useState("");
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const filtered = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return intents.filter((intent) => !searchText || fuzzyMatchCodexText(
      [intent.id, intent.name, intent.nameEn, stripCodexMarkup(intent.description), stripCodexMarkup(intent.descriptionEn)].join(" "),
      searchText,
    ));
  }, [intents, searchQuery]);

  return (
    <CompendiumIndexLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          inputId="codex-filter-search"
          placeholder={serviceLocale === "ko" ? "검색" : "Search"}
        />
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filtered.length, countLabel, serviceLocale)}
          trailing={trailing}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <div className="columns-1 gap-5 xl:columns-2">
            {filtered.map((intent) => (
              <article
                key={intent.id}
                className="mb-5 grid min-w-0 break-inside-avoid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2"
              >
                <div className="relative h-16 w-16 shrink-0 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]">
                  <Image src={intent.imageUrl} alt="" fill className="object-contain" aria-hidden />
                </div>
                <GameHoverTip title={intent.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
                  <DescriptionText description={intent.description} className="block text-left" />
                </GameHoverTip>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </CompendiumIndexScroller>
      </main>
    </CompendiumIndexLayout>
  );
}
