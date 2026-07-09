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

export interface ThisOrThatGameCopy {
  title: string;
  prompt: string;
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

interface LocalizedPhraseReplacement {
  from: string;
  to: string;
}

const PATCH_PREP_TIME_DESCRIPTION_REPLACEMENTS: Partial<Record<GameLocale, LocalizedPhraseReplacement>> = {
  deu: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Epoche wartet|Epochen warten}",
    to: "Der heutige Patch wartet",
  },
  eng: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Epoch is|Epochs are} waiting to be revealed...",
    to: "Today's patch is waiting to be revealed ...",
  },
  esp: {
    from: "Hay {RevealableEpochCount} {RevealableEpochCount:plural:era|eras} que aún debes revelar...",
    to: "El parche de hoy aún debe revelarse...",
  },
  fra: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Ère reste|Ères restent}",
    to: "Le patch du jour reste",
  },
  ita: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Epoca|Epoche} da rivelare...",
    to: "La patch di oggi deve ancora essere rivelata...",
  },
  jpn: {
    from: "{RevealableEpochCount}つの断章",
    to: "今日のパッチ",
  },
  kor: {
    from: "{RevealableEpochCount}개의 역사가 드러나기를 기다리고 있습니다...",
    to: "오늘의 패치가 드러나기를 기다리고 있습니다 ...",
  },
  pol: {
    from: "{RevealableEpochCount:plural:Została 1 Epoka|Zostały {RevealableEpochCount} Epoki|Zostało {RevealableEpochCount} Epok} do odkrycia...",
    to: "Dzisiejszy patch czeka na odkrycie...",
  },
  ptb: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Época ainda pode ser revelada...|Épocas ainda podem ser reveladas...}",
    to: "O patch de hoje ainda pode ser revelado...",
  },
  rus: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural(ru):эпоха ожидает|эпохи ожидают|эпох ожидают}",
    to: "Сегодняшний патч ожидает",
  },
  spa: {
    from: "Puedes revelar {RevealableEpochCount} {RevealableEpochCount:plural:Época|Épocas} más...",
    to: "El parche de hoy aún puede revelarse...",
  },
  tha: {
    from: "",
    to: "รอการเปิดเผยแพตช์ของวันนี้...",
  },
  tur: {
    from: "{RevealableEpochCount} {RevealableEpochCount:plural:Çağ|Çağ}",
    to: "Bugünün yaması",
  },
  zhs: {
    from: "{RevealableEpochCount}个历史节点",
    to: "今天的补丁",
  },
};

const PATCH_DELAY_DESCRIPTION_REPLACEMENTS: Partial<Record<GameLocale, LocalizedPhraseReplacement>> = {
  deu: {
    from: "diesem Monster",
    to: "diesem Patch",
  },
  eng: {
    from: "Information on this monster is yet to be revealed...",
    to: "Information on this patch is yet to be revealed ...",
  },
  esp: {
    from: "este monstruo",
    to: "este parche",
  },
  fra: {
    from: "ce monstre",
    to: "ce patch",
  },
  ita: {
    from: "questo mostro",
    to: "questa patch",
  },
  jpn: {
    from: "このモンスター",
    to: "このパッチ",
  },
  kor: {
    from: "이 몬스터에 관한 정보는 아직 드러나지 않았습니다...",
    to: "이 패치에 관한 정보는 아직 드러나지 않았습니다 ...",
  },
  pol: {
    from: "tym potworze",
    to: "tym patchu",
  },
  ptb: {
    from: "esta criatura",
    to: "este patch",
  },
  rus: {
    from: "этом существе",
    to: "этом патче",
  },
  spa: {
    from: "este monstruo",
    to: "este parche",
  },
  tha: {
    from: "มอนสเตอร์ตัวนี้",
    to: "แพตช์นี้",
  },
  tur: {
    from: "Bu canavar",
    to: "Bu yama",
  },
  zhs: {
    from: "这个怪物",
    to: "这个补丁",
  },
};

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

function extractLastPlainLine(text: string): string {
  return stripGameMarkup(lastNonEmptyLine(text));
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
  const replacement = PATCH_PREP_TIME_DESCRIPTION_REPLACEMENTS[gameLocale];
  if (!replacement) return "Today's patch is waiting to be revealed ...";
  if (!replacement.from) return replacement.to;
  if (!timelineReminder.includes(replacement.from)) {
    return gameLocale === "eng"
      ? "Today's patch is waiting to be revealed ..."
      : replacement.to;
  }
  return timelineReminder.replace(replacement.from, replacement.to);
}

function patchDelayDescription(
  gameLocale: GameLocale,
  bestiaryPlaceholder: string,
): string {
  const replacement = PATCH_DELAY_DESCRIPTION_REPLACEMENTS[gameLocale];
  if (!replacement) return "Information on this patch is yet to be revealed ...";
  if (!bestiaryPlaceholder.includes(replacement.from)) {
    return gameLocale === "eng"
      ? "Information on this patch is yet to be revealed ..."
      : replacement.to;
  }
  return bestiaryPlaceholder.replace(replacement.from, replacement.to);
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

export async function getThisOrThatGameCopy(
  gameLocale: GameLocale,
): Promise<ThisOrThatGameCopy> {
  const [title, description] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.title"),
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.pages.INITIAL.description"),
  ]);

  return {
    title: title || "This or That?",
    prompt: extractLastPlainLine(description) || extractDialogueLine(description),
  };
}
