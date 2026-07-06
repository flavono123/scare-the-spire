"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import {
  CHARACTER_COLORS,
  type CodexAncient,
  type CodexCard,
  type CodexCharacter,
  type CodexPotion,
  type CodexRelic,
} from "@/lib/codex-types";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { CharacterDetail } from "./character-detail";
import { MonsterSpineStage } from "./monster-spine-stage";
import { SearchBar } from "./search-bar";

interface CharacterListProps {
  serviceLocale: ServiceLocale;
  title: string;
  characters: CodexCharacter[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  potions?: CodexPotion[];
  ancients?: CodexAncient[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  entities?: EntityInfo[];
}

const CHARACTER_FACE_FOCUS: Record<string, string> = {
  defect: "48% 34%",
  ironclad: "52% 34%",
  necrobinder: "68% 35%",
  regent: "54% 36%",
  silent: "69% 34%",
};

const CHARACTER_ACTIVE_FOCUS: Record<string, string> = {
  defect: "55% center",
  ironclad: "53% center",
  necrobinder: "58% center",
  regent: "52% center",
  silent: "57% center",
};

const DEFAULT_CHARACTER_SELECT_FRAME = {
  scale: 1.2,
  translateX: "0%",
  translateY: "-1%",
  transformOrigin: "center center",
  fallbackFocus: "56% center",
};

const DEFAULT_CHARACTER_INACTIVE_FRAME = {
  scale: 1,
  translateX: "0%",
  translateY: "0%",
  transformOrigin: "center center",
};

const CHARACTER_SELECT_FRAME: Record<string, typeof DEFAULT_CHARACTER_SELECT_FRAME> = {
  defect: {
    scale: 6.6,
    translateX: "-2%",
    translateY: "4%",
    transformOrigin: "54% 37%",
    fallbackFocus: "55% center",
  },
  ironclad: {
    scale: 1.18,
    translateX: "-1%",
    translateY: "-2%",
    transformOrigin: "52% 48%",
    fallbackFocus: "53% center",
  },
  necrobinder: {
    scale: 2.78,
    translateX: "24%",
    translateY: "-4%",
    transformOrigin: "61% 48%",
    fallbackFocus: "62% center",
  },
  regent: {
    scale: 2,
    translateX: "8%",
    translateY: "-4%",
    transformOrigin: "54% 48%",
    fallbackFocus: "52% center",
  },
  silent: {
    scale: 1.28,
    translateX: "-1%",
    translateY: "-2%",
    transformOrigin: "58% 48%",
    fallbackFocus: "57% center",
  },
};

const CHARACTER_INACTIVE_FRAME: Record<string, typeof DEFAULT_CHARACTER_INACTIVE_FRAME> = {
  defect: {
    scale: 1.85,
    translateX: "-3%",
    translateY: "0%",
    transformOrigin: "52% 35%",
  },
  regent: {
    scale: 1.48,
    translateX: "2%",
    translateY: "0%",
    transformOrigin: "54% 36%",
  },
};

const CHARACTER_SELECT_VIEWPORT_PADDING = {
  padLeft: "0%",
  padRight: "0%",
  padTop: "0%",
  padBottom: "0%",
} as const;

const HEART_ICON = "/images/sts2/ui/topbar/top_bar_heart.png";
const GOLD_ICON = "/images/sts2/ui/topbar/top_bar_gold.png";

export function CharacterList({
  serviceLocale,
  title,
  characters,
  cards = [],
  relics = [],
  potions = [],
  ancients = [],
  patches,
  changes,
  versionDiffs,
  entities,
}: CharacterListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlCharacterId = useHydrationSafeSearchParam("character");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCharacterOverride, setSelectedCharacterOverride] = useState<CodexCharacter | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const urlSelectedCharacter = useMemo(() => (
    urlCharacterId
      ? characters.find((character) => character.id.toLowerCase() === urlCharacterId.toLowerCase()) ?? null
      : null
  ), [characters, urlCharacterId]);
  const selectedCharacter = useUrlSelection ? urlSelectedCharacter : selectedCharacterOverride;
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [activeCharacterOverrideId, setActiveCharacterOverrideId] = useState<string | null>(null);
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
  const activeCharacterId = useMemo(() => {
    if (activeCharacterOverrideId && filteredCharacters.some((character) => character.id === activeCharacterOverrideId)) {
      return activeCharacterOverrideId;
    }
    if (urlSelectedCharacter && filteredCharacters.some((character) => character.id === urlSelectedCharacter.id)) {
      return urlSelectedCharacter.id;
    }
    return filteredCharacters[0]?.id ?? null;
  }, [activeCharacterOverrideId, filteredCharacters, urlSelectedCharacter]);
  const relicById = useMemo(
    () => new Map(relics.map((relic) => [relic.id, relic])),
    [relics],
  );

  const selectCharacter = useCallback((character: CodexCharacter) => {
    setUseUrlSelection(false);
    setSelectedCharacterOverride(character);
  }, [setSelectedCharacterOverride, setUseUrlSelection]);

  const closeSelectedCharacter = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedCharacterOverride(null);
  }, [setSelectedCharacterOverride, setUseUrlSelection]);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedCharacterOverride) {
      url.searchParams.set("character", selectedCharacterOverride.id.toLowerCase());
    } else {
      url.searchParams.delete("character");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedCharacterOverride, useUrlSelection]);

  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedCharacterOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  useEffect(() => {
    if (!selectedCharacter) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedCharacter();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedCharacter, selectedCharacter]);

  const moveActiveCharacter = useCallback((delta: number) => {
    if (filteredCharacters.length === 0) return;
    const currentIndex = Math.max(
      0,
      filteredCharacters.findIndex((character) => character.id === activeCharacterId),
    );
    const nextIndex = (currentIndex + delta + filteredCharacters.length) % filteredCharacters.length;
    const nextCharacter = filteredCharacters[nextIndex];
    setActiveCharacterOverrideId(nextCharacter.id);
    window.requestAnimationFrame(() => {
      const row = rowRefs.current.get(nextCharacter.id);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [activeCharacterId, filteredCharacters, setActiveCharacterOverrideId]);

  useEffect(() => {
    if (selectedCharacter) return;
    const handler = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        moveActiveCharacter(1);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveActiveCharacter(-1);
      } else if (event.key === "Home" && filteredCharacters.length > 0) {
        event.preventDefault();
        setActiveCharacterOverrideId(filteredCharacters[0].id);
      } else if (event.key === "End" && filteredCharacters.length > 0) {
        event.preventDefault();
        setActiveCharacterOverrideId(filteredCharacters[filteredCharacters.length - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredCharacters, moveActiveCharacter, selectedCharacter]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer(false);

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

        <div className="flex-1 overflow-y-auto bg-[#050508]">
          {filteredCharacters.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="flex flex-col" role="list">
              {filteredCharacters.map((character, index) => (
                <CharacterRow
                  key={character.id}
                  character={character}
                  startingRelic={relicById.get(character.startingRelicIds[0]) ?? null}
                  serviceLocale={serviceLocale}
                  active={character.id === activeCharacterId}
                  index={index}
                  setActiveCharacterId={setActiveCharacterOverrideId}
                  setRowRef={(node) => {
                    if (node) rowRefs.current.set(character.id, node);
                    else rowRefs.current.delete(character.id);
                  }}
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
            if (event.target === event.currentTarget) closeSelectedCharacter();
          }}
        >
          <div className="mx-4 my-8 w-full max-w-6xl">
            <CharacterDetail
              serviceLocale={serviceLocale}
              backToListTitle={title}
              character={selectedCharacter}
              characters={characters}
              cards={cards}
              relics={relics}
              potions={potions}
              ancients={ancients}
              onClose={closeSelectedCharacter}
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

function CharacterRow({
  character,
  startingRelic,
  serviceLocale,
  active,
  index,
  setActiveCharacterId,
  setRowRef,
  onSelect,
}: {
  character: CodexCharacter;
  startingRelic: CodexRelic | null;
  serviceLocale: ServiceLocale;
  active: boolean;
  index: number;
  setActiveCharacterId: (characterId: string) => void;
  setRowRef: (node: HTMLAnchorElement | null) => void;
  onSelect: (character: CodexCharacter) => void;
}) {
  const characterPool = character.id.toLowerCase();
  const color = CHARACTER_COLORS[characterPool] ?? "#eab308";
  const faceFocus = CHARACTER_FACE_FOCUS[characterPool] ?? "60% 35%";
  const activeFocus = CHARACTER_ACTIVE_FOCUS[characterPool] ?? "56% center";
  const selectFrame = CHARACTER_SELECT_FRAME[characterPool] ?? DEFAULT_CHARACTER_SELECT_FRAME;
  const inactiveFrame = CHARACTER_INACTIVE_FRAME[characterPool] ?? DEFAULT_CHARACTER_INACTIVE_FRAME;
  const activeStageStyle: CSSProperties = {
    transform: `translate3d(${selectFrame.translateX}, ${selectFrame.translateY}, 0) scale(${selectFrame.scale})`,
    transformOrigin: selectFrame.transformOrigin,
  };
  const inactiveImageStyle: CSSProperties = {
    objectPosition: faceFocus,
    transform: `translate3d(${inactiveFrame.translateX}, ${inactiveFrame.translateY}, 0) scale(${inactiveFrame.scale})`,
    transformOrigin: inactiveFrame.transformOrigin,
  };
  const rowStyle: CSSProperties = {
    background: `linear-gradient(90deg, rgba(5,5,8,0.98) 0%, ${color}1f 48%, rgba(5,5,8,0.94) 100%)`,
  };

  return (
    <Link
      ref={setRowRef}
      href={localizeHref(buildCompendiumResourceHref("character", character.id), serviceLocale)}
      role="listitem"
      aria-current={active ? "true" : undefined}
      onMouseEnter={() => setActiveCharacterId(character.id)}
      onFocus={() => setActiveCharacterId(character.id)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(character);
      }}
      className={`group relative isolate block w-full overflow-hidden text-left outline-none transition-[min-height,opacity,filter] duration-500 ease-out focus-visible:outline-none ${
        active
          ? "min-h-[26rem] opacity-100 saturate-100 sm:min-h-[31rem] lg:min-h-[34rem]"
          : "min-h-[8.75rem] opacity-70 saturate-[0.72] hover:opacity-100 hover:saturate-100 sm:min-h-[10rem] lg:min-h-[11.25rem]"
      }`}
      style={rowStyle}
    >
      <div
        className="absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 72% 34%, ${color}33, transparent 46%), linear-gradient(90deg, rgba(0,0,0,0.86), rgba(0,0,0,0.26) 48%, rgba(0,0,0,0.12))`,
        }}
      />

      {character.selectBackgroundImageUrl && (
        <Image
          src={character.selectBackgroundImageUrl}
          alt=""
          fill
          loading={index < 2 ? "eager" : "lazy"}
          className={`absolute inset-0 z-0 object-cover object-center transition-all duration-700 ${
            active ? "scale-110 opacity-90" : "scale-105 opacity-35"
          }`}
        />
      )}

      <div className={`absolute inset-0 z-10 transition-all duration-500 ${active ? "scale-105 opacity-0" : "scale-100 opacity-95"}`}>
        <Image
          src={character.selectImageUrl}
          alt=""
          fill
          loading={index < 3 ? "eager" : "lazy"}
          className="h-full w-full object-cover drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]"
          style={inactiveImageStyle}
        />
      </div>

      {active && (
        <div className="absolute inset-0 z-10 overflow-hidden">
          {character.characterSelectSpineAsset ? (
            <div
              className="pointer-events-none absolute inset-0 transition-transform duration-500 ease-out"
              style={activeStageStyle}
            >
              <MonsterSpineStage
                asset={character.characterSelectSpineAsset}
                fallbackImageUrl={character.selectImageUrl}
                fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-cover opacity-80 blur-[1px] drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]"
                fallbackImageStyle={{ objectPosition: selectFrame.fallbackFocus }}
                imagePriority={index === 0}
                showLoadingLabel={false}
                viewportPadding={CHARACTER_SELECT_VIEWPORT_PADDING}
                monsterName={character.name}
                selectedMoveId="IDLE"
                className="relative h-full w-full"
                loopSelectedMove
              />
            </div>
          ) : (
            <Image
              src={character.selectImageUrl}
              alt=""
              fill
              className="object-cover opacity-95 drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]"
              style={{ objectPosition: activeFocus }}
            />
          )}
        </div>
      )}

      {active && character.selectVfxImageUrls.length > 0 && (
        <CharacterSelectVfx imageUrls={character.selectVfxImageUrls} />
      )}

      <div className={`absolute inset-0 z-20 bg-gradient-to-r from-black/85 via-black/35 to-transparent transition-opacity duration-500 ${active ? "opacity-100" : "opacity-80"}`} />
      <div className={`absolute inset-0 z-20 bg-gradient-to-t from-black/55 via-transparent to-black/25 transition-opacity duration-500 ${active ? "opacity-100" : "opacity-60"}`} />

      <div className="absolute inset-y-0 left-0 z-30 flex w-full max-w-2xl flex-col justify-center px-4 py-4 sm:px-8 lg:px-10">
        <div className={`flex items-center gap-3 transition-all duration-500 ${active ? "translate-x-0" : "-translate-x-1"}`}>
          <Image
            src={character.iconUrl}
            alt=""
            width={52}
            height={52}
            className={`${active ? "h-12 w-12" : "h-9 w-9"} shrink-0 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.65)] transition-all duration-500`}
          />
          <div className="min-w-0">
            <h2
              className={`${active ? "text-4xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl"} truncate font-game-title leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.75)] transition-all duration-500`}
              style={{ color }}
            >
              {character.name}
            </h2>
            {character.nameEn !== character.name && (
              <p className={`${active ? "mt-1 text-sm" : "mt-0.5 text-[11px]"} truncate font-game-text text-zinc-300/80 transition-all duration-500`}>
                {character.nameEn}
              </p>
            )}
          </div>
        </div>

        <div className={`${active ? "mt-4" : "mt-2"} flex flex-wrap items-center gap-3 font-game-text text-sm text-zinc-100 transition-all duration-500 sm:gap-5`}>
          <CharacterStat iconUrl={HEART_ICON} label={`${character.startingHp}/${character.startingHp}`} tone="text-red-200" />
          <CharacterStat iconUrl={GOLD_ICON} label={`${character.startingGold}`} tone="text-yellow-200" />
          <span className="text-zinc-300/80">
            {character.startingDeckIds.length}
            {serviceLocale === "ko" ? "장" : " cards"}
          </span>
        </div>

        <p className={`${active ? "mt-5 max-w-xl text-base leading-relaxed sm:text-lg" : "mt-2 max-w-lg text-xs leading-snug sm:text-sm"} line-clamp-3 font-game-text text-zinc-100/90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] transition-all duration-500`}>
          {stripCodexMarkup(character.description)}
        </p>

        {active && startingRelic && (
          <div className="mt-5 flex max-w-xl items-center gap-3 font-game-text text-sm text-zinc-100/90">
            {startingRelic.imageUrl && (
              <Image
                src={startingRelic.imageUrl}
                alt=""
                width={54}
                height={54}
                className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]"
              />
            )}
            <div className="min-w-0">
              <div className="truncate font-game-title text-xl leading-tight" style={{ color }}>
                {startingRelic.name}
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-zinc-200/85 sm:text-sm">
                {stripCodexMarkup(startingRelic.description)}
              </p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function CharacterStat({
  iconUrl,
  label,
  tone,
}: {
  iconUrl: string;
  label: string;
  tone: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${tone}`}>
      <Image src={iconUrl} alt="" width={24} height={24} className="h-5 w-5 object-contain" />
      {label}
    </span>
  );
}

function CharacterSelectVfx({ imageUrls }: { imageUrls: string[] }) {
  const positions = [
    "right-[18%] top-[18%] h-44 w-44 sm:h-56 sm:w-56",
    "right-[34%] top-[36%] h-40 w-44 sm:h-52 sm:w-56",
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 mix-blend-screen">
      {imageUrls.map((imageUrl, index) => (
        <Image
          key={imageUrl}
          src={imageUrl}
          alt=""
          width={500}
          height={500}
          className={`absolute ${positions[index] ?? positions[0]} animate-pulse object-contain opacity-40 blur-[0.5px]`}
          style={{ animationDuration: `${index === 0 ? 1.7 : 2.3}s` }}
        />
      ))}
    </div>
  );
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}
