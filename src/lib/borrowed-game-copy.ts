import type { GameLocale } from "@/lib/i18n";
import { readGameLocalizationTable } from "@/lib/game-localization";

const ENGLISH_GAME_LOCALE: GameLocale = "eng";
const LANTERN_KEY_DIRECT_TERM_BY_LOCALE: Partial<Record<GameLocale, string>> = {
  deu: "Schlüssel",
  eng: "key",
  jpn: "鍵",
  kor: "열쇠",
  pol: "klucza",
  ptb: "chave",
  spa: "llave",
  tur: "anahtarı",
  zhs: "钥匙",
};

export interface HistoryCourseLandingGameCopy {
  title: string;
  runHistoryLabel: string;
  heroQuote: string;
}

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

function extractDialogueLine(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => stripGameMarkup(line))
    .filter(Boolean);

  return lines.find((line) => /^[“"«「„—]/.test(line)) ?? "";
}

function replaceLanternKeyTerm(
  quote: string,
  gameLocale: GameLocale,
  runHistoryLabel: string,
): string {
  if (gameLocale === "kor" && quote.includes("열쇠를")) {
    return quote.replace("열쇠를", `${runHistoryLabel}을`);
  }

  const keyTerm = LANTERN_KEY_DIRECT_TERM_BY_LOCALE[gameLocale];
  if (keyTerm && quote.includes(keyTerm)) {
    return quote.replace(keyTerm, runHistoryLabel);
  }

  return quote ? `${runHistoryLabel}: ${quote}` : runHistoryLabel;
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

export async function getHistoryCourseLandingGameCopy(
  gameLocale: GameLocale,
): Promise<HistoryCourseLandingGameCopy> {
  const [relicTitle, runHistoryLabel, lanternDescription] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "relics", "HISTORY_COURSE.title"),
    readGameTextWithEnglishFallback(gameLocale, "main_menu_ui", "RUN_HISTORY.title"),
    readGameTextWithEnglishFallback(
      gameLocale,
      "events",
      "THE_LANTERN_KEY.pages.INITIAL.description",
    ),
  ]);
  const quote = extractDialogueLine(lanternDescription);

  return {
    title: relicTitle,
    runHistoryLabel,
    heroQuote: replaceLanternKeyTerm(quote, gameLocale, runHistoryLabel),
  };
}
