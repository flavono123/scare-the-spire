"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexAncient,
  CodexCard,
  CodexCharacter,
  CodexEnchantment,
  CodexAffliction,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CardFilterCategory,
  CardTypeKo,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import { versionCodexEntities } from "@/lib/codex-versioning";
import {
  annotateCard,
  isEtcRarity,
  RarityDetail,
  RARITY_DETAIL_ORDER,
  RARITY_DETAIL_COLORS,
} from "@/lib/card-annotations";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import {
  getMadScienceCardTypeFromId,
  getMadScienceVariantId,
} from "@/lib/tinker-time";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafePathname,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";

// Sort key definitions
export type SortKey = "color" | "type" | "rarity" | "cost" | "name";
export type SortDir = "asc" | "desc";
type EngagementSortKey = "comments" | "likes";
interface EngagementSortState {
  key: EngagementSortKey;
  dir: SortDir;
}

const COLOR_SORT_ORDER: Record<string, number> = {
  ironclad: 0, silent: 1, defect: 2, necrobinder: 3, regent: 4,
  colorless: 5, ancient: 6, status: 7, curse: 8, event: 9, quest: 10, token: 11,
};

const TYPE_SORT_ORDER: Record<string, number> = {
  "공격": 0, "스킬": 1, "파워": 2, "저주": 3, "상태이상": 4, "퀘스트": 5,
};

const RARITY_SORT_ORDER: Record<string, number> = {
  "기본": 0, "일반": 1, "고급": 2, "희귀": 3,
  "고대의 존재": 4, "이벤트": 4, "토큰": 4, "저주": 4, "상태이상": 4, "퀘스트": 4,
};

const DEFAULT_SORT_KEYS: SortKey[] = ["color", "type", "rarity", "cost", "name"];

function isBetaArtParamEnabled(value: string | null): boolean {
  const normalized = value?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function getCardSortCategory(card: CodexCard): string {
  if (card.rarity === "고대의 존재") return "ancient";
  if (card.color === "status" || card.rarity === "상태이상" || card.type === "상태이상") return "status";
  if (card.color === "curse" || card.rarity === "저주" || card.type === "저주") return "curse";
  if (card.rarity === "이벤트") return "event";
  if (card.color === "quest" || card.rarity === "퀘스트" || card.type === "퀘스트") return "quest";
  if (card.color === "token" || card.rarity === "토큰") return "token";
  return card.color;
}

function compareCards(a: CodexCard, b: CodexCard, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "color":
      cmp = (COLOR_SORT_ORDER[getCardSortCategory(a)] ?? 99) - (COLOR_SORT_ORDER[getCardSortCategory(b)] ?? 99);
      break;
    case "type":
      cmp = (TYPE_SORT_ORDER[a.type] ?? 99) - (TYPE_SORT_ORDER[b.type] ?? 99);
      break;
    case "rarity":
      cmp = (RARITY_SORT_ORDER[a.rarity] ?? 99) - (RARITY_SORT_ORDER[b.rarity] ?? 99);
      break;
    case "cost":
      cmp = a.cost - b.cost;
      break;
    case "name":
      cmp = a.name.localeCompare(b.name, "ko");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

function cardMatchesFilterCategory(card: CodexCard, category: CardFilterCategory): boolean {
  switch (category) {
    case "ancient":
      return card.rarity === "고대의 존재";
    case "colorless":
      return card.color === "colorless";
    case "token":
      return card.rarity === "토큰";
    case "event":
      return card.rarity === "이벤트";
    case "quest":
      return card.rarity === "퀘스트" || card.type === "퀘스트" || card.color === "quest";
    case "curse":
      return card.color === "curse" || card.rarity === "저주" || card.type === "저주";
    case "status":
      return card.color === "status" || card.rarity === "상태이상" || card.type === "상태이상";
    default:
      return card.color === category;
  }
}

function resolveCardListId(id: string): string {
  const madScienceType = getMadScienceCardTypeFromId(id);
  return madScienceType ? getMadScienceVariantId(madScienceType) : id;
}

function findCardByListId(cards: CodexCard[], id: string): CodexCard | null {
  const resolvedId = resolveCardListId(id);
  return cards.find((c) => c.id.toLowerCase() === resolvedId.toLowerCase()) ?? null;
}

function getCardLibraryBasePath(pathname: string): string {
  const match = pathname.match(/^(.*\/compendium\/cards)(?:\/[^/]+)?\/?$/);
  return match?.[1] ?? "/compendium/cards";
}

function getModalCardIdFromPath(pathname: string, modalParam: string | null): string | null {
  if (modalParam !== "true") return null;
  const match = pathname.match(/\/compendium\/cards\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

import { CardTile } from "./card-tile";
import { CardDetail } from "./card-detail";
import { SearchBar } from "./search-bar";
import { FilterSection, IconFilterButton, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import {
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
  QUEST_FILTER_ICON,
  TOKEN_FILTER_ICON,
  getCharacterTokenIcon,
} from "./codex-filter-assets";

// Filter icon paths for non-character categories
const CATEGORY_ICONS: Record<string, string> = {
  colorless: COLORLESS_FILTER_ICON,
  token: TOKEN_FILTER_ICON,
  event: EVENT_FILTER_ICON,
  quest: QUEST_FILTER_ICON,
  curse: "/images/game-assets/card-library/filter_curse.webp",
  status: "/images/game-assets/card-library/filter_status.webp",
  ancient: "/images/sts2/ancients/neow.webp",
};

const RARITY_COLORS: Record<string, string> = {
  기본: "#8b8b8b",
  일반: "#b0b0b0",
  고급: "#4fc3f7",
  희귀: "#ffd740",
  기타: "#81c784",
};

const COST_OPTIONS = [0, 1, 2, 3, "3+", "X"] as const;

interface CardLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  cards: CodexCard[];
  characters: CodexCharacter[];
  versions: string[];
  currentVersion: string;
  patches: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs: EntityVersionDiff[];
  enchantments: CodexEnchantment[];
  afflictions: CodexAffliction[];
  relatedAncients?: CodexAncient[];
  relatedEvents?: CodexEvent[];
  relatedMonsters?: CodexMonster[];
  relatedPotions?: CodexPotion[];
  relatedPowers?: CodexPower[];
  initialCardId?: string | null;
  initialShowBeta?: boolean;
}

export function CardLibrary({ serviceLocale, gameUi, cards, characters, versions, currentVersion, patches, changes, versionDiffs, enchantments, afflictions, relatedAncients = [], relatedEvents = [], relatedMonsters = [], relatedPotions = [], relatedPowers = [], initialCardId = null, initialShowBeta = false }: CardLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [selectedColors, setSelectedColors] = useState<Set<CardFilterCategory>>(
    new Set()
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<CardTypeKo>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [selectedRarityDetails, setSelectedRarityDetails] = useState<Set<RarityDetail>>(
    new Set()
  );
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce text search (150ms)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showEngagementStats, setShowEngagementStats] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(true);
  const [engagementSort, setEngagementSort] = useState<EngagementSortState | null>(null);
  const engagementCounts = useEngagementCounts({
    enabled: showEngagementStats || engagementSort !== null,
  });

  // Sort state: ordered priority list of sort keys with directions
  const [sortKeys, setSortKeys] = useState<SortKey[]>(DEFAULT_SORT_KEYS);
  const [sortDirs, setSortDirs] = useState<Record<SortKey, SortDir>>({
    color: "asc", type: "asc", rarity: "asc", cost: "asc", name: "asc",
  });

  const searchText = useMemo(() => debouncedQuery.trim().toLowerCase(), [debouncedQuery]);

  const matchCost = useCallback(
    (card: CodexCard, costFilter: string): boolean => {
      if (costFilter.endsWith("+")) {
        const min = parseInt(costFilter);
        return !isNaN(min) && card.cost >= min;
      }
      if (costFilter.endsWith("-")) {
        const max = parseInt(costFilter);
        return !isNaN(max) && card.cost >= 0 && card.cost <= max;
      }
      if (costFilter === "X" || costFilter === "x") return card.isXCost;
      const num = parseInt(costFilter);
      if (!isNaN(num)) return card.cost === num;
      return true;
    },
    []
  );

  const versionedCards = useMemo(() => {
    return versionCodexEntities(cards, "card", {
      selectedVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [cards, selectedVersion, currentVersion, versionDiffs, patches, changes]);

  // Filtered & sorted cards (always sorted by name)
  const filteredCards = useMemo(() => {
    let result = versionedCards;

    // Color/category filter
    if (selectedColors.size > 0) {
      result = result.filter((c) => {
        for (const category of selectedColors) {
          if (cardMatchesFilterCategory(c, category)) return true;
        }
        return false;
      });
    }

    // Type filter
    if (selectedTypes.size > 0) {
      result = result.filter((c) => selectedTypes.has(c.type));
    }

    // Rarity filter (with detail sub-filters)
    if (selectedRarities.size > 0 || selectedRarityDetails.size > 0) {
      result = result.filter((c) => {
        // Standard rarities (일반/고급/희귀) — direct match
        if (selectedRarities.has(c.rarity)) return true;
        // "기타" bucket — check detail sub-filters if any are active
        if (selectedRarities.has("기타") || selectedRarityDetails.size > 0) {
          if (!isEtcRarity(c)) return false;
          // If detail sub-filters active, only show matching details
          if (selectedRarityDetails.size > 0) {
            const detail = annotateCard(c).rarityDetail;
            return detail !== null && selectedRarityDetails.has(detail);
          }
          // "기타" selected with no detail filters → show all etc cards
          return selectedRarities.has("기타");
        }
        return false;
      });
    }

    // Cost filter
    if (selectedCosts.size > 0) {
      result = result.filter((c) => {
        for (const cost of selectedCosts) {
          if (matchCost(c, cost)) return true;
        }
        return false;
      });
    }

    // Text search (name + description + keywords)
    if (searchText) {
      result = result.filter(
        (c) =>
          fuzzyMatchCodexText(c.name, searchText) ||
          fuzzyMatchCodexText(c.nameEn, searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(c.description), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(c.descriptionEn), searchText) ||
          c.keywords.some((kw) => fuzzyMatchCodexText(kw, searchText)) ||
          Object.values(c.keywordLabels).some((kw) => fuzzyMatchCodexText(kw, searchText))
      );
    }

    // Multi-level sort by sortKeys priority
    const sorted = [...result].sort((a, b) => {
      for (const key of sortKeys) {
        const cmp = compareCards(a, b, key, sortDirs[key]);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    if (!engagementSort) return sorted;

    const counts = engagementSort.key === "comments"
      ? engagementCounts.comments
      : engagementCounts.likes;
    return sorted
      .map((card, index) => ({ card, index }))
      .sort((a, b) => {
        const aCount = counts[buildCodexCommentThreadKey("card", a.card.id)] ?? 0;
        const bCount = counts[buildCodexCommentThreadKey("card", b.card.id)] ?? 0;
        const countDiff = engagementSort.dir === "desc"
          ? bCount - aCount
          : aCount - bCount;
        return countDiff || a.index - b.index;
      })
      .map(({ card }) => card);
  }, [
    versionedCards,
    selectedColors,
    selectedTypes,
    selectedRarities,
    selectedRarityDetails,
    selectedCosts,
    searchText,
    matchCost,
    sortKeys,
    sortDirs,
    engagementSort,
    engagementCounts.comments,
    engagementCounts.likes,
  ]);

  // Progressive rendering — render cards in batches to avoid initial jank
  const BATCH_SIZE = 42; // ~6 rows of 7
  // Build a stable key from filter inputs to reset visibleCount on change
  const filterKey = useMemo(
    () =>
      `${[...selectedColors].sort()}-${[...selectedTypes].sort()}-${[...selectedRarities].sort()}-${[...selectedRarityDetails].sort()}-${[...selectedCosts].sort()}-${searchText}`,
    [selectedColors, selectedTypes, selectedRarities, selectedRarityDetails, selectedCosts, searchText],
  );
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      setVisibleCount(BATCH_SIZE); // eslint-disable-line react-hooks/set-state-in-effect -- reset batch on filter change
    }
  }, [filterKey]);

  // IntersectionObserver to load more cards on scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredCards.length));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredCards.length]);

  const visibleCards = filteredCards.slice(0, visibleCount);

  // Toggle helpers
  const toggleColor = useCallback((color: CardFilterCategory) => {
    setSelectedColors((prev) => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: CardTypeKo) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleRarity = useCallback((rarity: string) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      // When "기타" is deselected, also clear detail sub-filters
      if (rarity === "기타" && !next.has("기타")) {
        setSelectedRarityDetails(new Set());
      }
      return next;
    });
  }, []);

  const toggleRarityDetail = useCallback((detail: RarityDetail) => {
    setSelectedRarityDetails((prev) => {
      const next = new Set(prev);
      if (next.has(detail)) next.delete(detail);
      else next.add(detail);
      return next;
    });
    // Auto-activate "기타" when a detail is selected
    setSelectedRarities((prev) => {
      if (prev.has("기타")) return prev;
      return new Set([...prev, "기타"]);
    });
  }, []);

  // Sort toggle: clicking a sort key promotes it to primary and toggles direction
  const toggleSort = useCallback((key: SortKey) => {
    setSortKeys((prev) => {
      const without = prev.filter((k) => k !== key);
      return [key, ...without];
    });
    setSortDirs((prev) => {
      // If already primary, toggle direction; otherwise set to asc
      const isPrimary = sortKeys[0] === key;
      return { ...prev, [key]: isPrimary ? (prev[key] === "asc" ? "desc" : "asc") : "asc" };
    });
  }, [sortKeys]);

  const toggleCost = useCallback((cost: string) => {
    setSelectedCosts((prev) => {
      const next = new Set(prev);
      if (next.has(cost)) next.delete(cost);
      else next.add(cost);
      return next;
    });
  }, []);

  const toggleEngagementSort = useCallback((key: EngagementSortKey) => {
    setShowEngagementStats(true);
    setEngagementSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  }, []);

  const getEngagementSortDir = useCallback(
    (key: EngagementSortKey): SortDir => (
      engagementSort?.key === key ? engagementSort.dir : "desc"
    ),
    [engagementSort],
  );

  // Character filters
  const characterFilters = characters.map((c) => ({
    key: c.id.toLowerCase() as CardFilterCategory,
    label: c.name,
    icon: getCharacterTokenIcon(c.id, c.imageUrl),
  }));

  const extraFilters = [
    { key: "colorless" as const, label: serviceText.labels.pools.colorless, icon: CATEGORY_ICONS.colorless },
    { key: "ancient" as const, label: gameUi.cardLibrary.rarities["고대의 존재"], icon: CATEGORY_ICONS.ancient },
    { key: "status" as const, label: gameUi.cardLibrary.rarities.상태이상, icon: CATEGORY_ICONS.status },
    { key: "curse" as const, label: gameUi.cardLibrary.rarities.저주, icon: CATEGORY_ICONS.curse },
    { key: "event" as const, label: gameUi.cardLibrary.rarities.이벤트, icon: CATEGORY_ICONS.event },
    { key: "quest" as const, label: gameUi.cardLibrary.rarities.퀘스트, icon: CATEGORY_ICONS.quest },
    { key: "token" as const, label: gameUi.cardLibrary.rarities.토큰, icon: CATEGORY_ICONS.token },
  ];

  const availableTypes: CardTypeKo[] = ["공격", "스킬", "파워"];

  const rarityFilters = [
    { key: "일반", label: gameUi.cardLibrary.rarities.일반, color: RARITY_COLORS["일반"] },
    { key: "고급", label: gameUi.cardLibrary.rarities.고급, color: RARITY_COLORS["고급"] },
    { key: "희귀", label: gameUi.cardLibrary.rarities.희귀, color: RARITY_COLORS["희귀"] },
    { key: "기타", label: gameUi.cardLibrary.rarities.기타, color: RARITY_COLORS["기타"] },
  ];

  const rarityDetailLabels: Record<RarityDetail, string> = {
    unique: serviceText.labels.rarityDetails.unique,
    starter: gameUi.cardLibrary.rarities.기본,
    ancient: gameUi.cardLibrary.rarities["고대의 존재"],
    event: gameUi.cardLibrary.rarities.이벤트,
    token: gameUi.cardLibrary.rarities.토큰,
    curse: gameUi.cardLibrary.rarities.저주,
    status: gameUi.cardLibrary.rarities.상태이상,
    quest: gameUi.cardLibrary.rarities.퀘스트,
  };

  // Card detail modal
  const urlPathname = useHydrationSafePathname();
  const urlModal = useHydrationSafeSearchParam("modal");
  const legacyUrlCardId = useHydrationSafeSearchParam("card", initialCardId);
  const urlBetaArt = useHydrationSafeSearchParam("beta", initialShowBeta ? "true" : null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const urlPathCardId = useMemo(() => getModalCardIdFromPath(urlPathname, urlModal), [urlPathname, urlModal]);
  const urlCardId = urlPathCardId ?? legacyUrlCardId;
  const urlBetaArtEnabled = isBetaArtParamEnabled(urlBetaArt);
  const activeShowBeta = useUrlSelection && urlBetaArt !== null ? urlBetaArtEnabled : showBeta;
  const selectedCard = useMemo(() => {
    const activeCardId = useUrlSelection ? urlCardId : selectedCardId;
    return activeCardId ? findCardByListId(cards, activeCardId) : null;
  }, [cards, selectedCardId, useUrlSelection, urlCardId]);

  const openSelectedCard = useCallback((card: CodexCard) => {
    setUseUrlSelection(false);
    setSelectedCardId(card.id);
  }, [setSelectedCardId, setUseUrlSelection]);

  const closeSelectedCard = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedCardId(null);
  }, [setSelectedCardId, setUseUrlSelection]);

  // Update URL query param when modal opens/closes
  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedCardId) {
      url.pathname = getCardLibraryBasePath(url.pathname);
      url.searchParams.set("card", selectedCardId.toLowerCase());
      url.searchParams.delete("modal");
      if (showBeta) {
        url.searchParams.set("beta", "true");
      } else {
        url.searchParams.delete("beta");
      }
    } else {
      url.pathname = getCardLibraryBasePath(url.pathname);
      url.searchParams.delete("modal");
      url.searchParams.delete("card");
      url.searchParams.delete("beta");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedCardId, showBeta, useUrlSelection]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedCardId(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedCard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedCard();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedCard, selectedCard]);

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

        {/* Character + Extra Filters (5 per row, 2 rows) */}
        <FilterSection trigger="@" label={serviceText.labels.affiliation} sortDir={sortDirs.color} onSortToggle={() => toggleSort("color")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="grid grid-cols-5 gap-1.5">
            {characterFilters.map((cf) => (
              <IconFilterButton
                key={cf.key}
                icon={cf.icon}
                label={cf.label}
                active={selectedColors.has(cf.key)}
                onClick={() => toggleColor(cf.key)}
              />
            ))}
            {extraFilters.map((ef) => (
              <IconFilterButton
                key={ef.key}
                icon={ef.icon}
                label={ef.label}
                active={selectedColors.has(ef.key)}
                onClick={() => toggleColor(ef.key)}
              />
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Card Type (icon buttons) */}
        <FilterSection trigger="#" label={gameUi.cardLibrary.sort.type} sortDir={sortDirs.type} onSortToggle={() => toggleSort("type")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex gap-1.5">
            {availableTypes.map((type) => (
              <IconFilterButton
                key={type}
                icon={TYPE_SORT_ICONS[type] ?? TYPE_SORT_ICONS["공격"]}
                label={gameUi.cardLibrary.types[type]}
                active={selectedTypes.has(type)}
                onClick={() => toggleType(type)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Rarity */}
        <FilterSection trigger="$" label={gameUi.cardLibrary.sort.rarity} sortDir={sortDirs.rarity} onSortToggle={() => toggleSort("rarity")} sortTitle={serviceText.common.sortButtonTitle}>
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
            {/* Rarity detail sub-filters (visible when 기타 is active) */}
            {selectedRarities.has("기타") && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                {RARITY_DETAIL_ORDER.map((detail) => (
                  <button
                    key={detail}
                    onClick={() => toggleRarityDetail(detail)}
                    className={`flex items-center gap-2 text-left text-xs px-2 py-0.5 rounded transition-all ${
                      selectedRarityDetails.has(detail)
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: RARITY_DETAIL_COLORS[detail] }}
                    />
                    {rarityDetailLabels[detail]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FilterSection>

        {/* Cost */}
        <FilterSection trigger="!" label={gameUi.cardLibrary.sort.cost} sortDir={sortDirs.cost} onSortToggle={() => toggleSort("cost")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-wrap gap-1">
            {COST_OPTIONS.map((cost) => {
              const key = String(cost);
              return (
                <button
                  key={key}
                  onClick={() => toggleCost(key)}
                  className={`w-8 h-7 rounded text-xs font-bold transition-all ${
                    selectedCosts.has(key)
                      ? "bg-yellow-500/30 text-yellow-400 border border-yellow-500"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/30"
                  }`}
                >
                  {cost}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Name sort (no filter, just sort toggle) */}
        <FilterSection label={gameUi.cardLibrary.sort.name} sortDir={sortDirs.name} onSortToggle={() => toggleSort("name")} sortTitle={serviceText.common.sortButtonTitle}>
          <span />
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Toggles */}
        <div className="flex flex-col gap-1">
          <ToggleButton
            label={gameUi.cardLibrary.viewMultiplayerCards}
            active={showMultiplayer}
            onClick={() => setShowMultiplayer((v) => !v)}
          />
          <ToggleButton
            label={gameUi.cardLibrary.viewUpgrades}
            active={showUpgrades}
            onClick={() => setShowUpgrades((v) => !v)}
          />
          <ToggleButton
            label={serviceText.cardsView.toggles.betaArt}
            active={activeShowBeta}
            onClick={() => {
              setUseUrlSelection(false);
              setShowBeta(!activeShowBeta);
            }}
          />
        </div>

        <div className="border-t border-white/10" />

        <FilterSection
          label={serviceLocale === "ko" ? "댓글 순" : "Comments"}
          sortDir={getEngagementSortDir("comments")}
          onSortToggle={() => toggleEngagementSort("comments")}
          sortTitle={serviceLocale === "ko" ? "댓글 순 정렬" : "Sort by comments"}
        >
          <span />
        </FilterSection>

        <FilterSection
          label={serviceLocale === "ko" ? "좋아요 순" : "Likes"}
          sortDir={getEngagementSortDir("likes")}
          onSortToggle={() => toggleEngagementSort("likes")}
          sortTitle={serviceLocale === "ko" ? "좋아요 순 정렬" : "Sort by likes"}
        >
          <span />
        </FilterSection>

        <div className="flex flex-col gap-1">
          <ToggleButton
            label={serviceLocale === "ko" ? "댓글/좋아요 보기" : "Show Comments/Likes"}
            active={showEngagementStats}
            onClick={() => setShowEngagementStats((v) => !v)}
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
          title={gameUi.cardLibraryTitle}
          count={formatCodexCount(filteredCards.length, serviceText.labels.cards, serviceLocale)}
          trailing={(
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          )}
        />

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div
            className="grid gap-2 sm:gap-3 justify-center"
            style={{ gridTemplateColumns: "repeat(auto-fill, 200px)" }}
          >
            {visibleCards.map((card, i) => {
              const threadKey = buildCodexCommentThreadKey("card", card.id);
              return (
                <div
                  key={card.id}
                  className="animate-card-enter"
                  style={{ animationDelay: `${Math.min(i * 12, 250)}ms` }}
                >
                  <CardTile
                    card={card}
                    serviceLocale={serviceLocale}
                    showUpgrade={showUpgrades}
                    showBeta={activeShowBeta}
                    size="grid"
                    engagementStats={showEngagementStats
                      ? {
                          commentCount: engagementCounts.comments[threadKey] ?? 0,
                          likeCount: engagementCounts.likes[threadKey] ?? 0,
                          loading: engagementCounts.loading,
                          unavailable: engagementCounts.unavailable,
                        }
                      : null}
                    onClick={() => openSelectedCard(card)}
                  />
                </div>
              );
            })}
          </div>
          {/* Sentinel for infinite scroll */}
          {visibleCount < filteredCards.length && (
            <div ref={loadMoreRef} className="h-8" />
          )}
          {filteredCards.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {gameUi.cardLibrary.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectedCard();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <CardDetail key={`${selectedCard.id}:${activeShowBeta ? "beta" : "normal"}`} serviceLocale={serviceLocale} gameUi={gameUi} card={selectedCard} enchantments={enchantments} afflictions={afflictions} relatedAncients={relatedAncients} relatedEvents={relatedEvents} relatedMonsters={relatedMonsters} relatedPotions={relatedPotions} relatedPowers={relatedPowers} patches={patches} changes={changes} versionDiffs={versionDiffs} initialShowBeta={activeShowBeta} onShowBetaChange={(next) => {
              setUseUrlSelection(false);
              setSelectedCardId(selectedCard.id);
              setShowBeta(next);
            }} onClose={closeSelectedCard} />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}


// Game-extracted card type filter icons
const TYPE_SORT_ICONS: Record<string, string> = {
  "공격": "/images/game-assets/card-library/type_sort_attack.webp",
  "스킬": "/images/game-assets/card-library/type_sort_skill.webp",
  "파워": "/images/game-assets/card-library/type_sort_power.webp",
};
