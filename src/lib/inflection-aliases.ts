import aliases from "../../data/sts2/inflection-aliases.json";

type AliasTable = Record<string, string[]>;
const KOR = aliases.kor as AliasTable;
const ENG = aliases.eng as AliasTable;

/**
 * Inflected names the game shows this resource's tip for (Exhausted for Exhaust, 꿰뚫린 for 꿰뚫림),
 * from scripts/generate-inflection-aliases.py. Merged into a hover entity's aliases.
 */
export function inflectionAliases(
  type: "card" | "keyword" | "power",
  id: string,
  existing: { aliasesKo?: string[]; aliasesEn?: string[] } = {},
): { aliasesKo?: string[]; aliasesEn?: string[] } {
  const key = `${type}:${id}`;
  const ko = [...(existing.aliasesKo ?? []), ...(KOR[key] ?? [])];
  const en = [...(existing.aliasesEn ?? []), ...(ENG[key] ?? [])];
  return { aliasesKo: ko.length ? ko : undefined, aliasesEn: en.length ? en : undefined };
}

/** True when `text` is one of the game-paired inflections of this resource in that locale (keep it as written). */
export function isInflectionOf(type: string, id: string, text: string, gameLocale: string): boolean {
  const table = gameLocale === "kor" ? KOR : gameLocale === "eng" ? ENG : null;
  const lower = text.trim().toLowerCase();
  return Boolean(table?.[`${type}:${id}`]?.some((alias) => alias.toLowerCase() === lower));
}
