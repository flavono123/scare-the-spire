import engBadges from "../../data/sts2/eng/badges.json";
import korBadges from "../../data/sts2/kor/badges.json";
import type { ServiceLocale } from "@/lib/i18n";
import type { ReplayBadge, ReplayBadgeRarity } from "@/lib/sts2-run-replay";

export interface RunBadgeCatalogEntry {
  id: string;
  slug: string;
  active: boolean;
  requiresWin: boolean | null;
  multiplayerOnly: boolean | null;
  sourceClass: string | null;
  imageUrl: string | null;
  title: string | null;
  description: string | null;
  rarities: Partial<
    Record<
      Exclude<ReplayBadgeRarity, "none">,
      {
        title: string;
        description: string;
      }
    >
  >;
}

export interface RunBadgeDisplay {
  id: string;
  rarity: Exclude<ReplayBadgeRarity, "none">;
  title: string;
  description: string;
  imageUrl: string | null;
  baseImageUrl: string;
}

const BADGES_BY_LOCALE = {
  ko: korBadges as RunBadgeCatalogEntry[],
  en: engBadges as RunBadgeCatalogEntry[],
} satisfies Record<ServiceLocale, RunBadgeCatalogEntry[]>;

const INDEX_BY_LOCALE = Object.fromEntries(
  Object.entries(BADGES_BY_LOCALE).map(([locale, badges]) => [
    locale,
    new Map(badges.map((badge) => [badge.id, badge])),
  ]),
) as Record<ServiceLocale, Map<string, RunBadgeCatalogEntry>>;

export function badgeBaseImageUrl(rarity: Exclude<ReplayBadgeRarity, "none">): string {
  return `/images/sts2/badges/${rarity}.webp`;
}

export function plainBadgeText(text: string): string {
  return text.replace(/\[[^\]]+\]/g, "");
}

export function getRunBadgeDisplay(
  badge: ReplayBadge,
  serviceLocale: ServiceLocale,
): RunBadgeDisplay | null {
  if (badge.rarity === "none") return null;
  const catalog = INDEX_BY_LOCALE[serviceLocale].get(badge.id);
  const rarityCopy = catalog?.rarities[badge.rarity];
  return {
    id: badge.id,
    rarity: badge.rarity,
    title: rarityCopy?.title ?? catalog?.title ?? badge.id,
    description: rarityCopy?.description ?? catalog?.description ?? "",
    imageUrl: catalog?.imageUrl ?? null,
    baseImageUrl: badgeBaseImageUrl(badge.rarity),
  };
}
