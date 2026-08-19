import korTables from "@/lib/sts2-game-i18n/kor.json";
import engTables from "@/lib/sts2-game-i18n/eng.json";
import type { GameLocale } from "@/lib/i18n";
import { prettifyId } from "@/lib/sts2-i18n";

export type GameI18nTableName =
  | "encounters"
  | "events"
  | "ancients"
  | "relics"
  | "cards"
  | "potions"
  | "acts"
  | "enchantments"
  | "characters";

export type GameI18nTables = Record<GameI18nTableName, Record<string, string>> & {
  ui: Record<string, string>;
};

const STATIC_TABLES: Partial<Record<GameLocale, GameI18nTables>> = {
  kor: korTables as GameI18nTables,
  eng: engTables as GameI18nTables,
};

const LOADERS: Record<GameLocale, () => Promise<GameI18nTables>> = {
  kor: async () => STATIC_TABLES.kor!,
  eng: async () => STATIC_TABLES.eng!,
  zhs: () => import("@/lib/sts2-game-i18n/zhs.json").then((m) => m.default as GameI18nTables),
  jpn: () => import("@/lib/sts2-game-i18n/jpn.json").then((m) => m.default as GameI18nTables),
  deu: () => import("@/lib/sts2-game-i18n/deu.json").then((m) => m.default as GameI18nTables),
  fra: () => import("@/lib/sts2-game-i18n/fra.json").then((m) => m.default as GameI18nTables),
  ita: () => import("@/lib/sts2-game-i18n/ita.json").then((m) => m.default as GameI18nTables),
  spa: () => import("@/lib/sts2-game-i18n/spa.json").then((m) => m.default as GameI18nTables),
  esp: () => import("@/lib/sts2-game-i18n/esp.json").then((m) => m.default as GameI18nTables),
  ptb: () => import("@/lib/sts2-game-i18n/ptb.json").then((m) => m.default as GameI18nTables),
  rus: () => import("@/lib/sts2-game-i18n/rus.json").then((m) => m.default as GameI18nTables),
  pol: () => import("@/lib/sts2-game-i18n/pol.json").then((m) => m.default as GameI18nTables),
  tha: () => import("@/lib/sts2-game-i18n/tha.json").then((m) => m.default as GameI18nTables),
  tur: () => import("@/lib/sts2-game-i18n/tur.json").then((m) => m.default as GameI18nTables),
};

const cache: Partial<Record<GameLocale, GameI18nTables>> = {
  kor: STATIC_TABLES.kor,
  eng: STATIC_TABLES.eng,
};
const inflight = new Map<GameLocale, Promise<GameI18nTables>>();

export function getGameI18nTablesSync(locale: GameLocale): GameI18nTables {
  return cache[locale] ?? cache.eng ?? STATIC_TABLES.eng!;
}

export function loadGameI18nTables(locale: GameLocale): Promise<GameI18nTables> {
  const hit = cache[locale];
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(locale);
  if (pending) return pending;
  const next = LOADERS[locale]()
    .then((tables) => {
      cache[locale] = tables;
      inflight.delete(locale);
      return tables;
    })
    .catch(() => {
      inflight.delete(locale);
      return getGameI18nTablesSync("eng");
    });
  inflight.set(locale, next);
  return next;
}

function strip(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

export function localizeGame(
  tables: GameI18nTables,
  table: GameI18nTableName,
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  const key = strip(id);
  return tables[table]?.[key] ?? null;
}

export function localizeGameAny(
  tables: GameI18nTables,
  id: string | null | undefined,
  tableNames: GameI18nTableName[],
): string {
  if (!id) return "";
  const key = strip(id);
  for (const table of tableNames) {
    const hit = tables[table]?.[key];
    if (hit) return hit;
  }
  return prettifyId(key);
}

export function gameUi(
  tables: GameI18nTables,
  key: string,
  fallback: string,
): string {
  return tables.ui[key] ?? fallback;
}

export function formatGameTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}
