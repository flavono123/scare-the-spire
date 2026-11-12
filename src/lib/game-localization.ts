import fs from "fs/promises";
import path from "path";
import type { GameLocale } from "./i18n";
import type { GameLocalizationTable } from "./game-localization-text";
import { stripNameCounterPlaceholder } from "./game-name-placeholders";

export type { GameLocalizationTable } from "./game-localization-text";
export { gameText, gameNullableText } from "./game-localization-text";

const LOCALIZATION_DIR = path.join(process.cwd(), "data/sts2/localization");

const tableCache = new Map<string, Promise<GameLocalizationTable>>();

/**
 * Cards whose CardModel.Title switches by upgrade level ship only `<ID>.title.<stage>`.
 * Alias the base stage to `<ID>.title` so every name lookup resolves.
 */
export const STAGED_CARD_TITLE_BASE: Record<string, string> = {
  DINGY_DAGGER: "dingy",
};

function withStagedCardTitles(table: GameLocalizationTable): GameLocalizationTable {
  for (const [id, stage] of Object.entries(STAGED_CARD_TITLE_BASE)) {
    const staged = table[`${id}.title.${stage}`];
    if (staged && !table[`${id}.title`]) table[`${id}.title`] = staged;
  }
  return table;
}

export async function readGameLocalizationTable(
  locale: GameLocale,
  tableName: string,
): Promise<GameLocalizationTable> {
  const cacheKey = `${locale}/${tableName}`;
  const cached = tableCache.get(cacheKey);
  if (cached) return cached;

  const tablePromise = fs
    .readFile(path.join(LOCALIZATION_DIR, locale, `${tableName}.json`), "utf-8")
    .then((raw) => JSON.parse(tableName === "monsters" ? stripNameCounterPlaceholder(raw) : raw) as GameLocalizationTable)
    .then((table) => (tableName === "cards" ? withStagedCardTitles(table) : table));

  tableCache.set(cacheKey, tablePromise);
  return tablePromise;
}
