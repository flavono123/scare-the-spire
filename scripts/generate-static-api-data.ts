import fs from "fs/promises";
import path from "path";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";
import { buildCompendiumResourceManifest } from "../src/lib/compendium-resource-manifest";
import { getLatestByrdispatchNotice } from "../src/lib/byrdispatch";
import { getSTS2PatchLines } from "../src/lib/data";
import { GAME_LOCALES } from "../src/lib/i18n";
import type { GameLocale } from "../src/lib/i18n";
import { readGameLocalizationTable } from "../src/lib/game-localization";
import { loadCompactThisOrThatEntities } from "../src/lib/this-or-that-data";

type StaticJsonTarget = {
  path: string;
  data: unknown;
};

const publicDir = path.join(process.cwd(), "public");
const srcDir = path.join(process.cwd(), "src");
const spinePlayerClientPath = path.join(
  process.cwd(),
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);

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

interface HistoryCourseLandingGameCopy {
  title: string;
  runHistoryLabel: string;
  heroQuote: string;
}

interface ThisOrThatGameCopy {
  title: string;
  prompt: string;
}

interface PatchStageGameCopy {
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

interface BorrowedGameCopyPayload {
  chemicalXPlaceholder: string;
  historyCourseLanding: HistoryCourseLandingGameCopy;
  patchStage: PatchStageGameCopy;
  thisOrThat: ThisOrThatGameCopy;
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

async function writeJson(target: StaticJsonTarget) {
  const filePath = path.join(publicDir, target.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(target.data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function writeSourceJson(target: StaticJsonTarget) {
  const filePath = path.join(srcDir, target.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(target.data, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function copyPublicFile(sourcePath: string, publicPath: string) {
  const filePath = path.join(publicDir, publicPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.copyFile(sourcePath, filePath);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function buildThisOrThatResourceTargets(): Promise<StaticJsonTarget[]> {
  const targets: StaticJsonTarget[] = [];
  for (const gameLocale of GAME_LOCALES) {
    targets.push({
      path: `generated/this-or-that-resources-${gameLocale}.json`,
      data: await loadCompactThisOrThatEntities({ gameLocale }),
    });
  }
  return targets;
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

async function buildPatchStageGameCopy(gameLocale: GameLocale): Promise<PatchStageGameCopy> {
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

async function buildHistoryCourseLandingGameCopy(gameLocale: GameLocale): Promise<HistoryCourseLandingGameCopy> {
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

async function buildThisOrThatGameCopy(gameLocale: GameLocale): Promise<ThisOrThatGameCopy> {
  const [title, description] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.title"),
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.pages.INITIAL.description"),
  ]);

  return {
    title: title || "This or That?",
    prompt: extractLastPlainLine(description) || extractDialogueLine(description),
  };
}

async function buildBorrowedGameCopyPayload(): Promise<Record<GameLocale, BorrowedGameCopyPayload>> {
  const entries = await Promise.all(
    GAME_LOCALES.map(async (gameLocale) => {
      const [chemicalXPlaceholder, historyCourseLanding, patchStage, thisOrThat] = await Promise.all([
        readGameTextWithEnglishFallback(
          gameLocale,
          "events",
          "TEA_MASTER.pages.TEA_OF_DISCOURTESY.description",
        ).then((description) => stripGameMarkup(lastNonEmptyLine(description))),
        buildHistoryCourseLandingGameCopy(gameLocale),
        buildPatchStageGameCopy(gameLocale),
        buildThisOrThatGameCopy(gameLocale),
      ]);
      return [
        gameLocale,
        {
          chemicalXPlaceholder,
          historyCourseLanding,
          patchStage,
          thisOrThat,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<GameLocale, BorrowedGameCopyPayload>;
}

async function main() {
  const [
    searchIndex,
    commentEntities,
    koreanCompendiumDetailPayload,
    englishCompendiumDetailPayload,
    compendiumResourceManifest,
    latestByrdispatchNotice,
    sts2PatchLines,
    thisOrThatResourceTargets,
    borrowedGameCopyPayload,
  ] = await Promise.all([
    buildSearchIndexPayload(),
    loadAllEntities(),
    buildCompendiumDetailPayload("ko"),
    buildCompendiumDetailPayload("en"),
    buildCompendiumResourceManifest(),
    getLatestByrdispatchNotice(),
    getSTS2PatchLines(),
    buildThisOrThatResourceTargets(),
    buildBorrowedGameCopyPayload(),
  ]);

  await Promise.all([
    writeSourceJson({ path: "generated/borrowed-game-copy.json", data: borrowedGameCopyPayload }),
    writeJson({ path: "generated/search-index.json", data: searchIndex }),
    writeJson({ path: "generated/comment-entities-sts2.json", data: commentEntities }),
    writeJson({ path: "generated/compendium-detail-kor.json", data: koreanCompendiumDetailPayload }),
    writeJson({ path: "generated/compendium-detail-eng.json", data: englishCompendiumDetailPayload }),
    writeJson({ path: "generated/compendium-resource-manifest.json", data: compendiumResourceManifest }),
    writeJson({ path: "generated/latest-byrdispatch-notice.json", data: latestByrdispatchNotice }),
    writeJson({ path: "generated/sts2-patch-lines.json", data: sts2PatchLines }),
    writeJson({ path: "api/search-index", data: searchIndex }),
    writeJson({ path: "comment-entities/sts2", data: commentEntities }),
    ...thisOrThatResourceTargets.map(writeJson),
    copyPublicFile(spinePlayerClientPath, "generated/spine-player.min.js"),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
