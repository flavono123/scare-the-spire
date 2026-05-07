import type { GameLocale } from "@/lib/i18n";
import { readGameLocalizationTable } from "@/lib/game-localization";

const ENGLISH_GAME_LOCALE: GameLocale = "eng";

async function readGameTextWithEnglishFallback(
  gameLocale: GameLocale,
  tableName: string,
  key: string,
): Promise<string> {
  const table = await readGameLocalizationTable(gameLocale, tableName);
  const localized = table[key]?.trim();
  if (localized) return localized;

  if (gameLocale === ENGLISH_GAME_LOCALE) return "";
  const englishTable = await readGameLocalizationTable(ENGLISH_GAME_LOCALE, tableName);
  return englishTable[key]?.trim() ?? "";
}

function stripGameMarkup(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lastNonEmptyLine(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? "";
}

export async function getChemicalXPlaceholder(
  gameLocale: GameLocale,
): Promise<string> {
  const description = await readGameTextWithEnglishFallback(
    gameLocale,
    "events",
    "TEA_MASTER.pages.TEA_OF_DISCOURTESY.description",
  );

  return stripGameMarkup(lastNonEmptyLine(description));
}
