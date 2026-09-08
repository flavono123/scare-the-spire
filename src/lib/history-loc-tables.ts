import type { GameLocale } from "@/lib/i18n";
import type { GameLocalizationTable } from "@/lib/game-localization-text";

export const HISTORY_LOC_PUBLIC_DIR = "generated/history-loc";

export const HISTORY_LOC_TABLE_SOURCES = [
  ["cards", "cards"],
  ["relics", "relics"],
  ["potions", "potions"],
  ["powers", "powers"],
  ["monsters", "monsters"],
  ["enchantments", "enchantments"],
  ["events", "events"],
  ["ancients", "ancients"],
  ["cardKeywords", "card_keywords"],
  ["staticHoverTips", "static_hover_tips"],
  ["gameplayUi", "gameplay_ui"],
  ["relicCollection", "relic_collection"],
  ["potionLab", "potion_lab"],
  ["orbs", "orbs"],
] as const;

export type HistoryLocTableKey = (typeof HISTORY_LOC_TABLE_SOURCES)[number][0];
export type HistoryLocTables = Record<HistoryLocTableKey, GameLocalizationTable>;

const cache: Partial<Record<GameLocale, HistoryLocTables>> = {};
const inflight = new Map<GameLocale, Promise<HistoryLocTables | null>>();

export function historyLocTablesPublicPath(locale: Exclude<GameLocale, "kor">): string {
  return `/${HISTORY_LOC_PUBLIC_DIR}/${locale}.json`;
}

export function getHistoryLocTablesSync(locale: GameLocale): HistoryLocTables | null {
  return cache[locale] ?? null;
}

export function loadHistoryLocTables(locale: GameLocale): Promise<HistoryLocTables | null> {
  if (locale === "kor") return Promise.resolve(null);
  const hit = cache[locale];
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(locale);
  if (pending) return pending;
  const next = fetchHistoryLocTables(locale)
    .then((tables) => {
      cache[locale] = tables;
      inflight.delete(locale);
      return tables;
    })
    .catch((error: unknown) => {
      inflight.delete(locale);
      console.warn("[history-course] failed to load game locale tables", locale, error);
      return cache.eng ?? null;
    });
  inflight.set(locale, next);
  return next;
}

async function fetchHistoryLocTables(locale: Exclude<GameLocale, "kor">): Promise<HistoryLocTables> {
  const response = await fetch(historyLocTablesPublicPath(locale));
  if (!response.ok) {
    throw new Error(`History locale tables ${locale} returned ${response.status}`);
  }
  return response.json() as Promise<HistoryLocTables>;
}
