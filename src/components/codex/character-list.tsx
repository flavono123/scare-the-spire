"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addCodexUrlChangeListener, pushCodexHistoryState } from "./use-hydration-safe-search-param";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import {
  CHARACTER_COLORS,
  characterOutlineFilter,
  type CodexAncient,
  type CodexCard,
  type CodexCharacter,
  type CodexRelic,
} from "@/lib/codex-types";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { CharacterDetail } from "./character-detail";
import { SearchBar } from "./search-bar";

interface CharacterListProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  characters: CodexCharacter[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  ancients?: CodexAncient[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  entities?: EntityInfo[];
}

export function CharacterList({
  serviceLocale,
  gameUi,
  title,
  characters,
  cards = [],
  relics = [],
  ancients = [],
  patches,
  changes,
  versionDiffs,
  entities,
}: CharacterListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const initialCharacterId = searchParams.get("character");
  const [selectedCharacter, setSelectedCharacter] = useState<CodexCharacter | null>(() => {
    if (!initialCharacterId) return null;
    return characters.find((character) => character.id.toLowerCase() === initialCharacterId.toLowerCase()) ?? null;
  });
  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const filteredCharacters = useMemo(() => {
    if (!searchText) return characters;
    return characters.filter((character) => {
      const dialogueText = character.ancientInteractions
        .flatMap((interaction) => [
          interaction.ancientId,
          interaction.ancientName,
          ...interaction.lines.map((line) => line.text),
        ])
        .join(" ");
      const quoteText = Object.values(character.quotes).filter(Boolean).join(" ");
      return (
        fuzzyMatchCodexText(character.name, searchText) ||
        fuzzyMatchCodexText(character.nameEn, searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(character.description), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(character.descriptionEn), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(quoteText), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(dialogueText), searchText) ||
        fuzzyMatchCodexText(character.startingDeckIds.join(" "), searchText) ||
        fuzzyMatchCodexText(character.startingRelicIds.join(" "), searchText)
      );
    });
  }, [characters, searchText]);

  const selectCharacter = useCallback((character: CodexCharacter) => {
    setSelectedCharacter(character);
  }, [setSelectedCharacter]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedCharacter) {
      url.searchParams.set("character", selectedCharacter.id.toLowerCase());
    } else {
      url.searchParams.delete("character");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedCharacter]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const characterParam = url.searchParams.get("character");
      if (!characterParam) {
        setSelectedCharacter(null);
      } else {
        const character = characters.find((item) => item.id.toLowerCase() === characterParam.toLowerCase());
        setSelectedCharacter(character ?? null);
      }
    };
    return addCodexUrlChangeListener(handler);
  }, [characters]);

  useEffect(() => {
    if (!selectedCharacter) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCharacter(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedCharacter]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          inputId="codex-filter-search"
          placeholder={serviceLocale === "ko" ? "캐릭터 검색" : "Search characters"}
        />
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredCharacters.length, serviceText.labels.items, serviceLocale)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredCharacters.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {filteredCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  serviceLocale={serviceLocale}
                  onSelect={selectCharacter}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedCharacter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedCharacter.name}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedCharacter(null);
          }}
        >
          <div className="mx-4 my-8 w-full max-w-6xl">
            <CharacterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              character={selectedCharacter}
              characters={characters}
              cards={cards}
              relics={relics}
              ancients={ancients}
              onClose={() => setSelectedCharacter(null)}
              entities={entities}
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

function CharacterCard({
  character,
  serviceLocale,
  onSelect,
}: {
  character: CodexCharacter;
  serviceLocale: ServiceLocale;
  onSelect: (character: CodexCharacter) => void;
}) {
  const characterPool = character.id.toLowerCase();
  const color = CHARACTER_COLORS[characterPool] ?? "#eab308";

  return (
    <Link
      href={localizeHref(`/compendium/characters/${character.id.toLowerCase()}`, serviceLocale)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(character);
      }}
      className="group relative min-h-[19rem] overflow-hidden rounded-lg border border-white/10 bg-[#12121a] transition-all duration-200 hover:bg-[#16161f]"
      style={{ borderColor: `${color}33` }}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `radial-gradient(circle at 50% 22%, ${color}22, transparent 62%)` }} />
      <div className="relative flex h-56 items-end justify-center overflow-hidden px-4 pt-5">
        <Image
          src={character.selectImageUrl}
          alt={character.name}
          width={320}
          height={320}
          className="max-h-full w-full object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:scale-105"
          style={{ filter: characterOutlineFilter(characterPool) }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#12121a] via-[#12121a]/70 to-transparent" />
      </div>
      <div className="relative -mt-3 px-4 pb-4 text-center">
        <div className="mb-1 flex justify-center">
          <Image
            src={character.iconUrl}
            alt=""
            width={34}
            height={34}
            className="h-8 w-8 object-contain"
          />
        </div>
        <h2 className="font-game-title text-xl transition-colors" style={{ color }}>
          {character.name}
        </h2>
        {character.nameEn !== character.name && (
          <p className="mt-0.5 font-game-text text-[11px] text-zinc-500">{character.nameEn}</p>
        )}
        <p className="mt-2 line-clamp-2 font-game-text text-xs leading-relaxed text-zinc-400">
          {stripCodexMarkup(character.description)}
        </p>
      </div>
    </Link>
  );
}
