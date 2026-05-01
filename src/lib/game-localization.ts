import fs from "fs/promises";
import path from "path";
import type { GameLocale } from "./i18n";

const LOCALIZATION_DIR = path.join(process.cwd(), "data/sts2/localization");

export type GameLocalizationTable = Record<string, string>;

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

export function gameText(
  table: GameLocalizationTable | null,
  key: string,
  fallback: string,
): string {
  return table?.[key] ?? fallback;
}

export function gameNullableText(
  table: GameLocalizationTable | null,
  key: string,
  fallback: string | null,
): string | null {
  return table?.[key] ?? fallback;
}
