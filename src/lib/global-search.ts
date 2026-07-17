import { fuzzyMatchCodexText } from "@/lib/codex-search";

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
  "monsterMove",
  "historyCourse",
  "thisOrThat",
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
};

export const globalSearchTypeStyles: Record<GlobalSearchType, {
  icon: string;
  color: string;
  bg: string;
  border: string;
}> = {
  patch: { icon: "/images/sts2/nav/patch_notes_icon.png", color: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  story: { icon: "/images/bone_tea.png", color: "text-cyan-200", bg: "bg-cyan-500/10", border: "border-cyan-400/30" },
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
  historyCourse: { icon: "/images/sts2/relics/history_course.webp", color: "text-violet-200", bg: "bg-violet-500/10", border: "border-violet-400/30" },
  thisOrThat: { icon: "/images/sts2/relics/choices_paradox.webp", color: "text-blue-200", bg: "bg-blue-500/10", border: "border-blue-400/30" },
};

function globalSearchFieldScore(value: string, query: string, weight: number): number | null {
  const text = value.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (!text || !normalizedQuery) return null;

  const exactIndex = text.indexOf(normalizedQuery);
  if (exactIndex >= 0) return weight + 1000 - Math.min(exactIndex, 100);

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.every((word) => text.includes(word)) ? weight + 600 : null;
  }

  return fuzzyMatchCodexText(value, query) ? weight : null;
}

export function globalSearchItemScore(
  item: GlobalSearchIndexItem,
  query: string,
  labels: Record<GlobalSearchType, string>,
): number | null {
  const scores = [
    globalSearchFieldScore(item.title, query, 700),
    globalSearchFieldScore(item.titleEn, query, 650),
    globalSearchFieldScore(labels[item.type], query, 600),
    globalSearchFieldScore(item.description, query, 300),
    globalSearchFieldScore(item.descriptionEn, query, 300),
    globalSearchFieldScore(item.id, query, 200),
  ].filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return Math.max(...scores);
}

export function globalSearchResultKey(item: GlobalSearchIndexItem): string {
  return `${item.type}:${item.id}`;
}
