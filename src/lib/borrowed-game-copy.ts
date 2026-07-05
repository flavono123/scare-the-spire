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

export interface PatchStageGameCopy {
  prepTime: {
    title: string;
    description: string;
  };
  delay: {
    title: string;
    description: string;
  };
  workToolsTitle: string;
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

function patchPrepTimeDescription(
  gameLocale: GameLocale,
  timelineReminder: string,
): string {
  if (gameLocale === "kor") {
    return timelineReminder.replace(
      "{RevealableEpochCount}개의 역사가 드러나기를 기다리고 있습니다...",
      "오늘의 패치가 드러나기를 기다리고 있습니다 ...",
    );
  }

  if (gameLocale === "eng") {
    return timelineReminder.replace(
      "{RevealableEpochCount} {RevealableEpochCount:plural:Epoch is|Epochs are} waiting to be revealed...",
      "Today's patch is waiting to be revealed ...",
    );
  }

  return "Today's patch is waiting to be revealed ...";
}

function patchDelayDescription(
  gameLocale: GameLocale,
  bestiaryPlaceholder: string,
): string {
  if (gameLocale === "kor") {
    return bestiaryPlaceholder.replace(
      "이 몬스터에 관한 정보는 아직 드러나지 않았습니다...",
      "이 패치에 관한 정보는 아직 드러나지 않았습니다 ...",
    );
  }

  if (gameLocale === "eng") {
    return bestiaryPlaceholder.replace(
      "Information on this monster is yet to be revealed...",
      "Information on this patch is yet to be revealed ...",
    );
  }

  return "Information on this patch is yet to be revealed ...";
}

export async function getPatchStageGameCopy(
  gameLocale: GameLocale,
): Promise<PatchStageGameCopy> {
  const [
    cards,
    powers,
    timeline,
    bestiary,
  ] = await Promise.all([
    readGameLocalizationTable(gameLocale, "cards"),
    readGameLocalizationTable(gameLocale, "powers"),
    readGameLocalizationTable(gameLocale, "timeline"),
    readGameLocalizationTable(gameLocale, "bestiary"),
  ]);

  const [
    englishCards,
    englishPowers,
    englishTimeline,
    englishBestiary,
  ] = gameLocale === ENGLISH_GAME_LOCALE
    ? [cards, powers, timeline, bestiary]
    : await Promise.all([
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "cards"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "powers"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "timeline"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "bestiary"),
      ]);

  const timelineReminder = timeline.REMINDER_TEXT ?? englishTimeline.REMINDER_TEXT ?? "";
  const bestiaryPlaceholder = bestiary["DESCRIPTION.placeholder"]
    ?? englishBestiary["DESCRIPTION.placeholder"]
    ?? "";

  return {
    prepTime: {
      title: cards["PREP_TIME.title"] ?? englishCards["PREP_TIME.title"] ?? "Prep Time",
      description: patchPrepTimeDescription(gameLocale, timelineReminder),
    },
    delay: {
      title: cards["DELAY.title"] ?? englishCards["DELAY.title"] ?? "Delay",
      description: patchDelayDescription(gameLocale, bestiaryPlaceholder),
    },
    workToolsTitle: powers["TOOLS_OF_THE_TRADE_POWER.title"]
      ?? englishPowers["TOOLS_OF_THE_TRADE_POWER.title"]
      ?? "Tools of the Trade",
  };
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
