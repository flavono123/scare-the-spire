import korTables from "./sts2-game-i18n/kor.json";

type I18nTable = "encounters" | "events" | "ancients" | "relics" | "cards" | "potions" | "acts" | "enchantments";

// Same tables History Course loads for kor; client bundles already carry this JSON.
const tables: Record<I18nTable, Record<string, string>> = {
  encounters: korTables.encounters,
  events: korTables.events,
  ancients: korTables.ancients,
  relics: korTables.relics,
  cards: korTables.cards,
  potions: korTables.potions,
  acts: korTables.acts,
  enchantments: korTables.enchantments,
};

// Ids the game no longer ships but older run files still name.
const RETIRED_TITLES: Partial<Record<I18nTable, Record<string, string>>> = {
  encounters: { DOORMAKER_BOSS: "문을 만드는 자" },
  cards: { FOLLOW_THROUGH: "완수", SCARE: "위협" },
};

function lookup(table: I18nTable, key: string): string | undefined {
  return tables[table]?.[key] ?? RETIRED_TITLES[table]?.[key];
}

function strip(id: string): string {
  // "RELIC.GOLDEN_COMPASS" → "GOLDEN_COMPASS"
  // "EVENT.ROOM_FULL_OF_CHEESE" → "ROOM_FULL_OF_CHEESE"
  return id.includes(".") ? id.split(".").pop() ?? id : id;
}

export function localize(table: I18nTable, id: string | null | undefined): string | null {
  if (!id) return null;
  return lookup(table, strip(id)) ?? null;
}

// Try multiple tables, return first hit or fall back to title-cased English.
export function localizeAny(id: string | null | undefined, tables_: I18nTable[]): string {
  if (!id) return "";
  const key = strip(id);
  for (const t of tables_) {
    const hit = lookup(t, key);
    if (hit) return hit;
  }
  return prettifyId(key);
}

export function prettifyId(id: string): string {
  return id
    .split("_")
    .map((part) => (part.length > 0 ? part[0] + part.slice(1).toLowerCase() : part))
    .join(" ");
}
