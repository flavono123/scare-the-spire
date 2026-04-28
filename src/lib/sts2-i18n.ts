import koData from "./sts2-i18n-ko.json";

type I18nTable = "encounters" | "events" | "ancients" | "relics" | "cards" | "potions" | "acts" | "enchantments";

const tables: Record<I18nTable, Record<string, string>> = koData as Record<
  I18nTable,
  Record<string, string>
>;

function strip(id: string): string {
  // "RELIC.GOLDEN_COMPASS" → "GOLDEN_COMPASS"
  // "EVENT.ROOM_FULL_OF_CHEESE" → "ROOM_FULL_OF_CHEESE"
  return id.includes(".") ? id.split(".").pop() ?? id : id;
}

export function localize(table: I18nTable, id: string | null | undefined): string | null {
  if (!id) return null;
  const key = strip(id);
  const dict = tables[table];
  return dict?.[key] ?? null;
}

// Try multiple tables, return first hit or fall back to title-cased English.
export function localizeAny(id: string | null | undefined, tables_: I18nTable[]): string {
  if (!id) return "";
  const key = strip(id);
  for (const t of tables_) {
    const hit = tables[t]?.[key];
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
