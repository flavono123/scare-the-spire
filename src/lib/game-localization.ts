import fs from "fs/promises";
import path from "path";
import type { GameLocale } from "./i18n";
import type { GameLocalizationTable } from "./game-localization-text";

export type { GameLocalizationTable } from "./game-localization-text";
export { gameText, gameNullableText } from "./game-localization-text";

const LOCALIZATION_DIR = path.join(process.cwd(), "data/sts2/localization");

const tableCache = new Map<string, Promise<GameLocalizationTable>>();

export async function readGameLocalizationTable(
  locale: GameLocale,
  tableName: string,
): Promise<GameLocalizationTable> {
  const cacheKey = `${locale}/${tableName}`;
  const cached = tableCache.get(cacheKey);
  if (cached) return cached;

  const tablePromise = fs
    .readFile(path.join(LOCALIZATION_DIR, locale, `${tableName}.json`), "utf-8")
    .then((raw) => JSON.parse(raw) as GameLocalizationTable);

  tableCache.set(cacheKey, tablePromise);
  return tablePromise;
}
