import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";

export const globalSearchTypeOrder = [
  "patch",
  "story",
  "character",
  "card",
  "keyword",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
  "modifier",
  "ascension",
  "blitzEntry",
  "dominion",
  "pet",
  "monsterMove",
  "compendium",
  "zzapper",
  "toybox",
] as const;

export type GlobalSearchType = (typeof globalSearchTypeOrder)[number];

export type GlobalSearchIndexItem = {
  id: string;
  type: GlobalSearchType;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  href: string;
  /** Absent means STS2; STS1 items lose ties to STS2 items. */
  game?: "sts1";
};

export const globalSearchTypeStyles: Record<GlobalSearchType, {
  icon: string;
  color: string;
  bg: string;
  border: string;
}> = {
  patch: { icon: "/images/sts2/nav/patch_notes_icon.png", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  story: { icon: "/images/bone_tea.png", color: "sts-text-aqua", bg: "bg-[#2aebbe]/10", border: "border-[#2aebbe]/30" },
  character: { icon: "/images/sts2/characters/character_icon_ironclad.webp", color: "text-red-200", bg: "bg-red-500/10", border: "border-red-400/30" },
  card: { icon: "/images/sts2/nav/stats_cards.png", color: "text-rose-200", bg: "bg-rose-500/10", border: "border-rose-400/30" },
  keyword: { icon: "/images/sts2/ui/topbar/submenu_history_icon.png", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  relic: { icon: "/images/sts2/relics/bing_bong.webp", color: "text-yellow-200", bg: "bg-yellow-500/10", border: "border-yellow-400/30" },
  potion: { icon: "/images/sts2/potions/potion_shaped_rock.webp", color: "text-emerald-200", bg: "bg-emerald-500/10", border: "border-emerald-400/30" },
  power: { icon: "/images/sts2/nav/unmovable_power_beta.webp", color: "text-sky-200", bg: "bg-sky-500/10", border: "border-sky-400/30" },
  enchantment: { icon: "/images/sts2/enchantments/souls_power.webp", color: "text-fuchsia-200", bg: "bg-fuchsia-500/10", border: "border-fuchsia-400/30" },
  affliction: { icon: "/images/sts2/enchantments/souls_power.webp", color: "text-purple-200", bg: "bg-purple-500/10", border: "border-purple-400/30" },
  event: { icon: "/images/sts2/nav/question_mark.png", color: "text-lime-200", bg: "bg-lime-500/10", border: "border-lime-400/30" },
  monster: { icon: "/images/sts2/nav/happy_cultist.png", color: "text-red-200", bg: "bg-red-500/10", border: "border-red-400/30" },
  monsterMove: { icon: "/images/sts2/nav/happy_cultist.png", color: "text-orange-200", bg: "bg-orange-500/10", border: "border-orange-400/30" },
  encounter: { icon: "/images/sts2/nav/happy_cultist.png", color: "text-stone-200", bg: "bg-stone-500/10", border: "border-stone-400/30" },
  ancient: { icon: "/images/sts2/nav/stats_ancients.png", color: "text-blue-200", bg: "bg-blue-500/10", border: "border-blue-400/30" },
  epoch: { icon: "/images/sts2/relics/planisphere.webp", color: "text-teal-200", bg: "bg-teal-500/10", border: "border-teal-400/30" },
  modifier: { icon: "/images/sts2/modifiers/character_cards.webp", color: "text-lime-200", bg: "bg-lime-500/10", border: "border-lime-400/30" },
  ascension: { icon: "/images/sts2/ui/topbar/top_bar_ascension.png", color: "text-orange-200", bg: "bg-orange-500/10", border: "border-orange-400/30" },
  blitzEntry: { icon: "/images/sts2/blitz-merchant/entries/entry_card_rewards.webp", color: "text-green-200", bg: "bg-green-500/10", border: "border-green-400/30" },
  dominion: { icon: "/images/sts2/bosses/queen_boss.webp", color: "text-cyan-200", bg: "bg-cyan-500/10", border: "border-cyan-400/30" },
  pet: { icon: "/images/sts2/monsters-render/osty.webp", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  compendium: { icon: "/images/sts2/nav/stats_cards.png", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  zzapper: { icon: "/images/sts2/relics/vexing_puzzlebox.webp", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  toybox: { icon: "/images/sts2/powers/focus_power.webp", color: "text-sky-200", bg: "bg-sky-500/10", border: "border-sky-400/30" },
};

// Match tiers keep an exact name above any prefix match, a prefix above a
// substring, and so on; field weights only order items within one tier.
const SEARCH_TIER_EXACT = 4000;
const SEARCH_TIER_PREFIX = 3000;
const SEARCH_TIER_SUBSTRING = 2000;
const SEARCH_TIER_ALL_WORDS = 1000;
const SEARCH_TIER_FUZZY = 0;

function globalSearchNameScore(value: string, query: string, weight: number): number | null {
  const text = value.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!text || !normalizedQuery) return null;

  if (text === normalizedQuery) return SEARCH_TIER_EXACT + weight;
  if (text.startsWith(normalizedQuery)) return SEARCH_TIER_PREFIX + weight;
  const index = text.indexOf(normalizedQuery);
  if (index >= 0) return SEARCH_TIER_SUBSTRING + weight - Math.min(index, 100);

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => text.includes(word))) {
    return SEARCH_TIER_ALL_WORDS + weight;
  }

  return fuzzyMatchCodexText(value, query) ? SEARCH_TIER_FUZZY + weight : null;
}

// Long text never reaches the name tiers, so a description hit stays below
// any name that contains the query.
function globalSearchTextScore(value: string, query: string, weight: number): number | null {
  const text = value.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!text || !normalizedQuery) return null;

  if (text.includes(normalizedQuery)) return SEARCH_TIER_ALL_WORDS + weight;
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => text.includes(word))) {
    return SEARCH_TIER_FUZZY + weight;
  }
  return null;
}

export function globalSearchItemScore(
  item: GlobalSearchIndexItem,
  query: string,
  labels: Record<GlobalSearchType, string>,
): number | null {
  const scores = [
    globalSearchNameScore(item.title, query, 300),
    globalSearchNameScore(item.titleEn, query, 250),
    globalSearchNameScore(labels[item.type], query, 100),
    globalSearchNameScore(item.id, query, 50),
    globalSearchTextScore(item.description, query, 20),
    globalSearchTextScore(item.descriptionEn, query, 20),
  ].filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return Math.max(...scores);
}

export const GLOBAL_SEARCH_RESULT_LIMIT = 40;

/**
 * Score order, then STS2 before STS1, then the type order. Main and the patch
 * Worker share this so both searches return the same list.
 */
export function rankGlobalSearchResults(
  items: readonly GlobalSearchIndexItem[],
  query: string,
  labels: Record<GlobalSearchType, string>,
  bonus?: (item: GlobalSearchIndexItem) => number,
): GlobalSearchIndexItem[] {
  const text = query.trim();
  if (!text) return [];
  const ranked: { item: GlobalSearchIndexItem; score: number }[] = [];
  for (const item of items) {
    const score = globalSearchItemScore(item, text, labels);
    if (score === null) continue;
    ranked.push({ item, score: score + (bonus?.(item) ?? 0) });
  }
  return ranked
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const gameOrder = (a.item.game === "sts1" ? 1 : 0) - (b.item.game === "sts1" ? 1 : 0);
      if (gameOrder !== 0) return gameOrder;
      return globalSearchTypeOrder.indexOf(a.item.type) - globalSearchTypeOrder.indexOf(b.item.type);
    })
    .slice(0, GLOBAL_SEARCH_RESULT_LIMIT)
    .map((entry) => entry.item);
}

export function globalSearchResultKey(item: GlobalSearchIndexItem): string {
  return `${item.type}:${item.id}`;
}

/** Game element names of a game-only language, by `globalSearchResultKey`. */
export type GlobalSearchNames = Record<string, string>;

export const GLOBAL_SEARCH_NAMES_ROOT = "generated/search-names";

/** The main index already holds Korean and English names. */
export function globalSearchNamesPath(gameLocale: GameLocale): string | null {
  if (gameLocale === "kor" || gameLocale === "eng") return null;
  return `/${GLOBAL_SEARCH_NAMES_ROOT}/${gameLocale}.json`;
}

/** Sets `title` to what this language shows, which is also the name it searches. */
export function localizeGlobalSearchItems(
  items: readonly GlobalSearchIndexItem[],
  serviceLocale: ServiceLocale,
  names: GlobalSearchNames,
): GlobalSearchIndexItem[] {
  return items.map((item) => ({
    ...item,
    title: names[globalSearchResultKey(item)] ?? (serviceLocale === "ko" ? item.title : item.titleEn),
  }));
}

async function loadGlobalSearchNames(gameLocale: GameLocale): Promise<GlobalSearchNames> {
  const path = globalSearchNamesPath(gameLocale);
  if (!path) return {};
  try {
    const response = await fetch(path);
    return response.ok ? await response.json() as GlobalSearchNames : {};
  } catch {
    return {};
  }
}

/** Without the language's names, results fall back to English instead of failing. */
export async function loadGlobalSearchItems(
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): Promise<GlobalSearchIndexItem[]> {
  const [response, names] = await Promise.all([
    fetch("/generated/search-index.json"),
    loadGlobalSearchNames(gameLocale),
  ]);
  if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
  const payload = await response.json() as { items?: GlobalSearchIndexItem[] };
  return localizeGlobalSearchItems(payload.items ?? [], serviceLocale, names);
}
