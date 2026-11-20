"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import type { CodexMonster } from "@/lib/codex-types";
import type { CodexIntent } from "@/lib/codex-data";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { DescriptionText } from "./codex-description";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
  CompendiumIndexScroller,
  CompendiumDetailFallback,
  CompendiumDetailOverlay,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { SearchBar } from "./search-bar";
import { addCodexUrlChangeListener, pushCodexHistoryState, useHydrationSafeSearchParam } from "./use-hydration-safe-search-param";
import type { CompendiumDataStatus } from "./use-compendium-data";

// Intent classes a monster move carries, by the intent glossary entry that explains them.
// The strong debuff entry has no class of its own, so it lists no monsters.
const INTENT_CLASS_BY_ID: Record<string, string[]> = {
  ATTACK: ["SingleAttackIntent", "MultiAttackIntent"],
  DEFEND: ["DefendIntent"],
  BUFF: ["BuffIntent"],
  DEBUFF: ["DebuffIntent"],
  CARD_DEBUFF: ["CardDebuffIntent"],
  STATUS: ["StatusIntent"],
  SUMMON: ["SummonIntent"],
  HEAL: ["HealIntent"],
  STUN: ["StunIntent"],
  SLEEP: ["SleepIntent"],
  ESCAPE: ["EscapeIntent"],
  DEATH_BLOW: ["DeathBlowIntent"],
  UNKNOWN: ["HiddenIntent"],
};

function IntentDetail({
  intent,
  monsters,
  detailsStatus,
  serviceLocale,
  backToListTitle,
  onClose,
}: {
  intent: CodexIntent;
  monsters: CodexMonster[];
  detailsStatus: CompendiumDataStatus;
  serviceLocale: ServiceLocale;
  backToListTitle: string;
  onClose: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const users = useMemo(() => {
    const classes = INTENT_CLASS_BY_ID[intent.id] ?? [];
    return monsters
      .filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id))
      .map((monster) => ({
        monster,
        moves: monster.moves.filter((move) => move.intentDetails.some((detail) => classes.includes(detail.type))),
      }))
      .filter((entry) => entry.moves.length > 0)
      .sort((a, b) => a.monster.name.localeCompare(b.monster.name, "ko"));
  }, [intent.id, monsters]);

  if (detailsStatus !== "loaded") {
    return (
      <CompendiumDetailFallback
        serviceLocale={serviceLocale}
        status={detailsStatus}
        title={intent.name}
        backToListTitle={backToListTitle}
        onClose={onClose}
        className="max-w-5xl"
      />
    );
  }
  const ko = serviceLocale === "ko";
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <button type="button" onClick={onClose} className="mb-4 text-sm text-gray-400 transition-colors hover:text-gray-200">
        ← {backToListTitle}
      </button>
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3">
        <Image src={intent.imageUrl} alt="" width={80} height={80} className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]" aria-hidden />
        <GameHoverTip title={intent.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
          <DescriptionText description={intent.description} className="block text-left" />
        </GameHoverTip>
      </div>
      <p className="mt-2 text-xs text-gray-500">{intent.nameEn}</p>
      {users.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
            {ko ? `이 의도를 쓰는 몬스터 ${users.length}` : `Monsters with this intent (${users.length})`}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {users.map(({ monster, moves }) => (
              <li key={monster.id}>
                <Link
                  prefetch={false}
                  href={localizeLink(`/compendium/monsters/${monster.id.toLowerCase()}`)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-black/20 p-2 transition-colors hover:bg-white/10"
                >
                  {monster.imageUrl && (
                    <Image src={monster.imageUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{monster.name}</span>
                    <span className="block truncate text-xs text-gray-400">
                      {moves.map((move) => (ko ? move.name : move.nameEn)).join(", ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function IntentLibrary({
  serviceLocale,
  title,
  countLabel,
  intents,
  monsters,
  detailsStatus,
  trailing,
}: {
  serviceLocale: ServiceLocale;
  title: string;
  countLabel: string;
  intents: CodexIntent[];
  monsters: CodexMonster[];
  detailsStatus: CompendiumDataStatus;
  trailing?: React.ReactNode;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [searchQuery, setSearchQuery] = useState("");
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();
  const urlIntentId = useHydrationSafeSearchParam("intent");
  const [override, setOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedId = useUrlSelection ? urlIntentId : override;
  const selectedIntent = intents.find((intent) => intent.id.toLowerCase() === selectedId?.toLowerCase()) ?? null;

  const select = useCallback((id: string | null) => {
    setUseUrlSelection(false);
    setOverride(id);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (override) url.searchParams.set("intent", override.toLowerCase());
    else url.searchParams.delete("intent");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [override, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedIntent) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [select, selectedIntent]);

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
                role="button"
                tabIndex={0}
                onClick={() => select(intent.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(intent.id); }}
                className="mb-5 grid min-w-0 cursor-pointer break-inside-avoid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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

      {selectedIntent && (
        <CompendiumDetailOverlay onClose={() => select(null)}>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <IntentDetail
              intent={selectedIntent}
              monsters={monsters}
              detailsStatus={detailsStatus}
              serviceLocale={serviceLocale}
              backToListTitle={title}
              onClose={() => select(null)}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
