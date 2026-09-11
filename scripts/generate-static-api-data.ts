import fs from "fs/promises";
import path from "path";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";
import { buildCompendiumResourceManifest } from "../src/lib/compendium-resource-manifest";
import {
  getLatestByrdispatchEntry,
  getLatestByrdispatchNotice,
} from "../src/lib/byrdispatch";
import { getSTS2PatchLines } from "../src/lib/data";
import { GAME_LOCALES } from "../src/lib/i18n";
import type { GameLocale } from "../src/lib/i18n";
import { readGameLocalizationTable } from "../src/lib/game-localization";
import { loadCompactThisOrThatEntities } from "../src/lib/this-or-that-data";
import {
  DECISIONS_DECISIONS_GAME_VERSION,
  stampAllPresetIds,
} from "../src/lib/decisions-decisions";
import { getCodexNavGameLabel } from "../src/lib/codex-nav-game-labels";
import {
  HISTORY_LOC_PUBLIC_DIR,
  HISTORY_LOC_TABLE_SOURCES,
  type HistoryLocTables,
} from "../src/lib/history-loc-tables";

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
  votePrompt: string;
  voteDone: string;
}

interface TransfigureGameCopy {
  title: string;
  subtitle: string;
  viewUpgrades: string;
}

interface DefragmentGameCopy {
  title: string;
  subtitle: string;
  placeholder: string;
}

interface DecisionsDecisionsGameCopy {
  title: string;
  hero: string;
  presetLabels: Record<string, string>;
}

interface PagestormGameCopy {
  title: string;
  hero: string;
}

interface FeedbackFormGameCopy {
  title: string;
  categoryLabel: string;
  descriptionPlaceholder: string;
  sendLabel: string;
  sendingLabel: string;
  sendFailedLabel: string;
  sendSuccessLabel: string;
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
  draft: {
    title: string;
    notice: string;
  };
}

interface PatchBackstabGameCopy {
  title: string;
  description: string;
  emptyDraw: string;
}

interface BorrowedGameCopyPayload {
  chemicalXPlaceholder: string;
  comboPlaceholder: string;
  feedbackForm: FeedbackFormGameCopy;
  historyCourseLanding: HistoryCourseLandingGameCopy;
  patchStage: PatchStageGameCopy;
  patchBackstab: PatchBackstabGameCopy;
  thisOrThat: ThisOrThatGameCopy;
  transfigure: TransfigureGameCopy;
  defragment: DefragmentGameCopy;
  decisionsDecisions: DecisionsDecisionsGameCopy;
  pagestorm: PagestormGameCopy;
}

interface ToyBoxNewsPayload {
  latestDate: string | null;
  newSectionTitles: string[];
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

const PATCH_DRAFT_NOTICE_REPLACEMENTS: Partial<Record<GameLocale, LocalizedPhraseReplacement>> = {
  deu: {
    from: "Das heißt, es ist noch nicht fertig!",
    to: "Das heißt, diese Patchnotes sind noch nicht fertig.",
  },
  eng: {
    from: "That means it's not done yet!",
    to: "That means this patch note isn't done yet.",
  },
  esp: {
    from: "Eso quiere decir que aún no está terminado.",
    to: "Eso quiere decir que estas notas aún no están terminadas.",
  },
  fra: {
    from: "Cela signifie que le jeu n'est pas terminé",
    to: "Cela signifie que ces notes de patch ne sont pas terminées.",
  },
  ita: {
    from: "Ciò significa che non è ancora pronto!",
    to: "Ciò significa che queste patch notes non sono ancora pronte.",
  },
  jpn: {
    from: "つまり、ゲームはまだ未完成です！",
    to: "つまり、このパッチノートはまだ未完成です。",
  },
  kor: {
    from: "아직 개발이 완료되지 않았다는 뜻이죠!",
    to: "아직 작업이 완료되지 않았다는 뜻이죠.",
  },
  pol: {
    from: "Oznacza to, że nie została jeszcze ukończona!",
    to: "Oznacza to, że te notatki nie zostały jeszcze ukończone.",
  },
  ptb: {
    from: "Isto significa que o jogo ainda não está pronto!",
    to: "Isto significa que estas notas ainda não estão prontas.",
  },
  rus: {
    from: "То есть игра пока не готова!",
    to: "То есть эти заметки пока не готовы.",
  },
  spa: {
    from: "lo que significa que aún no está acabado.",
    to: "lo que significa que estas notas aún no están acabadas.",
  },
  tha: {
    from: "ซึ่งหมายความว่าเกมยังไม่สมบูรณ์!",
    to: "ซึ่งหมายความว่าบันทึกแพตช์นี้ยังไม่สมบูรณ์",
  },
  tur: {
    from: "Bu da oyun henüz tamamlanmamış demek!",
    to: "Bu da bu yama notu henüz tamamlanmamış demek.",
  },
  zhs: {
    from: "这意味着游戏还没有完全完成！",
    to: "这意味着这篇补丁说明还没有完全完成！",
  },
};

const PATCH_BACKSTAB_DESCRIPTION_REPLACEMENTS: Partial<Record<GameLocale, LocalizedPhraseReplacement>> = {
  deu: {
    from: "dieser Kreatur",
    to: "dem heutigen Patch",
  },
  eng: {
    from: "this creature",
    to: "today's patch",
  },
  esp: {
    from: "Esta criatura",
    to: "El parche de hoy",
  },
  fra: {
    from: "cette créature",
    to: "le patch du jour",
  },
  ita: {
    from: "questa creatura",
    to: "la patch di oggi",
  },
  jpn: {
    from: "このモンスター",
    to: "今日のパッチ",
  },
  kor: {
    from: "이 생물은",
    to: "오늘의 패치는",
  },
  pol: {
    from: "tym stworzeniem",
    to: "dzisiejszym patchem",
  },
  ptb: {
    from: "esta criatura",
    to: "o patch de hoje",
  },
  rus: {
    from: "этим врагом",
    to: "сегодняшним патчем",
  },
  spa: {
    from: "Esta criatura",
    to: "El parche de hoy",
  },
  tha: {
    from: "สิ่งมีชีวิตนี้",
    to: "แพตช์วันนี้",
  },
  tur: {
    from: "Bu yaratıkta",
    to: "Bugünün yamasında",
  },
  zhs: {
    from: "这个生物",
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

async function writeSourceJsonCompact(target: StaticJsonTarget) {
  const filePath = path.join(srcDir, target.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(target.data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function buildHistoryLocTableTargets(): Promise<StaticJsonTarget[]> {
  const locales = GAME_LOCALES.filter((locale): locale is Exclude<GameLocale, "kor"> => locale !== "kor");
  return Promise.all(locales.map(async (locale) => {
    const entries = await Promise.all(
      HISTORY_LOC_TABLE_SOURCES.map(async ([key, file]) => [
        key,
        await readGameLocalizationTable(locale, file),
      ] as const),
    );
    return {
      path: `${HISTORY_LOC_PUBLIC_DIR}/${locale}.json`,
      data: Object.fromEntries(entries) as HistoryLocTables,
    };
  }));
}

function pickChoiceLocEntries(table: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(table)) {
    if (key.endsWith(".description") || key.endsWith(".eventDescription")) {
      out[key] = value;
    }
  }
  return out;
}

async function buildHistoryChoiceLoc() {
  const [events, ancients, relics] = await Promise.all([
    readGameLocalizationTable("kor", "events"),
    readGameLocalizationTable("kor", "ancients"),
    readGameLocalizationTable("kor", "relics"),
  ]);
  return {
    events: pickChoiceLocEntries(events),
    ancients: pickChoiceLocEntries(ancients),
    relics: pickChoiceLocEntries(relics),
  };
}

async function writeHistoryLastSceneCatalog(resources: {
  encounters: unknown;
  characters: unknown;
  ancients: unknown;
  events: unknown;
}) {
  await writeSourceJsonCompact({
    path: "generated/history-last-scene-catalog.json",
    data: {
      ...resources,
      choiceLoc: await buildHistoryChoiceLoc(),
    },
  });
}

async function generateHistoryCourseCatalogOnly() {
  const {
    getCodexCards,
    getCodexRelics,
    getCodexPotions,
    getCodexPowers,
    getCodexMonsters,
    getCodexEnchantments,
    getCodexEncounters,
    getCodexCharacters,
    getCodexAncients,
    getCodexEvents,
  } = await import("../src/lib/codex-data");
  const { loadCardSideTipCatalogSources } = await import(
    "../src/lib/card-side-tip-catalog.server"
  );
  const [
    cards,
    relics,
    potions,
    powers,
    monsters,
    enchantments,
    tipSources,
    encounters,
    characters,
    ancients,
    events,
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true }),
    getCodexRelics(),
    getCodexPotions(),
    getCodexPowers({ includeDeprecated: true }),
    getCodexMonsters(),
    getCodexEnchantments(),
    loadCardSideTipCatalogSources("kor"),
    getCodexEncounters(),
    getCodexCharacters(),
    getCodexAncients(),
    getCodexEvents(),
  ]);
  await writeSourceJsonCompact({
    path: "generated/history-course-catalog.json",
    data: { cards, relics, potions, powers, monsters, enchantments, tipSources },
  });
  await writeHistoryLastSceneCatalog({ encounters, characters, ancients, events });
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

async function buildDecisionsDecisionsPresetTarget(): Promise<StaticJsonTarget> {
  const entities = await loadCompactThisOrThatEntities({ gameLocale: "kor" });
  return {
    path: "generated/decisions-decisions-presets.json",
    data: {
      gameVersion: DECISIONS_DECISIONS_GAME_VERSION,
      presets: stampAllPresetIds(entities),
    },
  };
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

/** Static pages have no player gender; keep the first SmartFormat branch. */
function resolveCharacterGenderChoose(text: string): string {
  return text.replace(
    /\{characterGender:choose\([^)]*\):([^}|]*)(?:\|[^}]*)*\}/g,
    "$1",
  );
}

function lastNonEmptyLine(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? "";
}

function stripAquaMarkup(text: string): string {
  return text.replace(/\[\/?aqua\]/gi, "");
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

function patchBackstabDescription(
  gameLocale: GameLocale,
  surpriseDescription: string,
): string {
  const replacement = PATCH_BACKSTAB_DESCRIPTION_REPLACEMENTS[gameLocale];
  if (!replacement) return "Something is off about today's patch...";
  if (!surpriseDescription.includes(replacement.from)) {
    return gameLocale === "eng"
      ? "Something is off about today's patch..."
      : replacement.to;
  }
  return surpriseDescription.replace(replacement.from, replacement.to);
}

function patchDraftNotice(
  gameLocale: GameLocale,
  earlyAccessDisclaimer: string,
): string {
  const replacement = PATCH_DRAFT_NOTICE_REPLACEMENTS[gameLocale];
  const fallback = "That means this patch note isn't done yet.";
  if (!replacement) return fallback;
  const stripped = stripGameMarkup(earlyAccessDisclaimer);
  if (!stripped.includes(replacement.from)) {
    return gameLocale === "eng" ? fallback : replacement.to;
  }
  return replacement.to;
}

async function buildPatchStageGameCopy(gameLocale: GameLocale): Promise<PatchStageGameCopy> {
  const [
    cards,
    powers,
    timeline,
    bestiary,
    mainMenu,
  ] = await Promise.all([
    readGameLocalizationTable(gameLocale, "cards"),
    readGameLocalizationTable(gameLocale, "powers"),
    readGameLocalizationTable(gameLocale, "timeline"),
    readGameLocalizationTable(gameLocale, "bestiary"),
    readGameLocalizationTable(gameLocale, "main_menu_ui"),
  ]);

  const [
    englishCards,
    englishPowers,
    englishTimeline,
    englishBestiary,
    englishMainMenu,
  ] = gameLocale === ENGLISH_GAME_LOCALE
    ? [cards, powers, timeline, bestiary, mainMenu]
    : await Promise.all([
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "cards"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "powers"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "timeline"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "bestiary"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "main_menu_ui"),
      ]);

  const timelineReminder = timeline.REMINDER_TEXT ?? englishTimeline.REMINDER_TEXT ?? "";
  const bestiaryPlaceholder = bestiary["DESCRIPTION.placeholder"]
    ?? englishBestiary["DESCRIPTION.placeholder"]
    ?? "";
  const earlyAccessDisclaimer = mainMenu["EARLY_ACCESS_DISCLAIMER.description_mkb"]
    ?? englishMainMenu["EARLY_ACCESS_DISCLAIMER.description_mkb"]
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
    draft: {
      title: cards["BEAT_INTO_SHAPE.title"]
        ?? englishCards["BEAT_INTO_SHAPE.title"]
        ?? "Beat into Shape",
      notice: patchDraftNotice(gameLocale, earlyAccessDisclaimer),
    },
  };
}

async function buildPatchBackstabGameCopy(gameLocale: GameLocale): Promise<PatchBackstabGameCopy> {
  const [cards, powers, combatMessages] = await Promise.all([
    readGameLocalizationTable(gameLocale, "cards"),
    readGameLocalizationTable(gameLocale, "powers"),
    readGameLocalizationTable(gameLocale, "combat_messages"),
  ]);
  const [englishCards, englishPowers, englishCombatMessages] = gameLocale === ENGLISH_GAME_LOCALE
    ? [cards, powers, combatMessages]
    : await Promise.all([
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "cards"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "powers"),
        readGameLocalizationTable(ENGLISH_GAME_LOCALE, "combat_messages"),
      ]);

  const surpriseDescription = powers["SURPRISE_POWER.description"]
    ?? englishPowers["SURPRISE_POWER.description"]
    ?? "";

  return {
    title: cards["BACKSTAB.title"] ?? englishCards["BACKSTAB.title"] ?? "Backstab",
    description: patchBackstabDescription(gameLocale, surpriseDescription),
    emptyDraw: combatMessages.OPEN_EMPTY_DRAW
      ?? englishCombatMessages.OPEN_EMPTY_DRAW
      ?? "My Draw Pile is [red]empty[/red].",
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
  const [title, description, votePrompt, voteDone] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.title"),
    readGameTextWithEnglishFallback(gameLocale, "events", "THIS_OR_THAT.pages.INITIAL.description"),
    readGameTextWithEnglishFallback(
      gameLocale,
      "monsters",
      "KNOWLEDGE_DEMON.moves.CURSE_OF_KNOWLEDGE.startLine",
    ),
    readGameTextWithEnglishFallback(
      gameLocale,
      "monsters",
      "KNOWLEDGE_DEMON.moves.CURSE_OF_KNOWLEDGE.doneLine",
    ),
  ]);

  return {
    title: title || "This or That?",
    prompt: extractLastPlainLine(description) || extractDialogueLine(description),
    votePrompt,
    voteDone,
  };
}

async function buildTransfigureGameCopy(
  gameLocale: GameLocale,
): Promise<TransfigureGameCopy> {
  const [title, morphicGroveDescription, viewUpgrades] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "cards", "TRANSFIGURE.title"),
    readGameTextWithEnglishFallback(
      gameLocale,
      "events",
      "MORPHIC_GROVE.pages.GROUP.description",
    ),
    readGameTextWithEnglishFallback(gameLocale, "card_library", "VIEW_UPGRADES"),
  ]);
  const paragraphs = morphicGroveDescription
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    title: title || "Transfigure",
    subtitle: paragraphs[1] ?? paragraphs[0] ?? "",
    viewUpgrades: viewUpgrades || "View Upgrades",
  };
}

async function buildDefragmentGameCopy(
  gameLocale: GameLocale,
): Promise<DefragmentGameCopy> {
  const [title, subtitle, description] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "cards", "DEFRAGMENT.title"),
    readGameTextWithEnglishFallback(gameLocale, "powers", "FOCUS_POWER.description"),
    readGameTextWithEnglishFallback(gameLocale, "cards", "DEFRAGMENT.description"),
  ]);
  const placeholder = stripGameMarkup(description)
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || "Defragment",
    subtitle: stripGameMarkup(subtitle),
    placeholder: placeholder || "Gain Focus.",
  };
}

function stripTrailingSentenceMark(text: string): string {
  return text.replace(/[.。]\s*$/, "").trim();
}

async function buildDecisionsDecisionsGameCopy(
  gameLocale: GameLocale,
): Promise<DecisionsDecisionsGameCopy> {
  const [
    title,
    hero,
    ironclad,
    silent,
    defect,
    necrobinder,
    regent,
    colorlessTip,
  ] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "cards", "DECISIONS_DECISIONS.title"),
    readGameTextWithEnglishFallback(
      gameLocale,
      "events",
      "TRIAL.pages.INITIAL.options.ACCEPT.description",
    ),
    readGameTextWithEnglishFallback(gameLocale, "characters", "IRONCLAD.title"),
    readGameTextWithEnglishFallback(gameLocale, "characters", "SILENT.title"),
    readGameTextWithEnglishFallback(gameLocale, "characters", "DEFECT.title"),
    readGameTextWithEnglishFallback(gameLocale, "characters", "NECROBINDER.title"),
    readGameTextWithEnglishFallback(gameLocale, "characters", "REGENT.title"),
    readGameTextWithEnglishFallback(gameLocale, "card_library", "POOL_COLORLESS_TIP"),
  ]);

  return {
    title: title || "Decisions, Decisions",
    hero: resolveCharacterGenderChoose(hero) || "Serve as today's Decider.",
    presetLabels: {
      "cards-ironclad": ironclad,
      "cards-silent": silent,
      "cards-defect": defect,
      "cards-necrobinder": necrobinder,
      "cards-regent": regent,
      "cards-colorless": stripTrailingSentenceMark(stripGameMarkup(colorlessTip)),
      "relics-shared": getCodexNavGameLabel(gameLocale, "relics") ?? "Relics",
      "potions-all": getCodexNavGameLabel(gameLocale, "potions") ?? "Potions",
    },
  };
}

async function buildPagestormGameCopy(
  gameLocale: GameLocale,
): Promise<PagestormGameCopy> {
  const [title, hero] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "cards", "PAGESTORM.title"),
    readGameTextWithEnglishFallback(gameLocale, "powers", "PAGESTORM_POWER.description"),
  ]);

  return {
    title: title || "Pagestorm",
    hero: hero || "",
  };
}

async function buildFeedbackFormGameCopy(
  gameLocale: GameLocale,
): Promise<FeedbackFormGameCopy> {
  const [
    title,
    categoryLabel,
    descriptionPlaceholder,
    sendLabel,
    sendingLabel,
    sendFailedLabel,
    sendSuccessLabel,
  ] = await Promise.all([
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "SEND_FEEDBACK"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_CATEGORY_LABEL"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_DESCRIPTION_PLACEHOLDER"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_SEND_BUTTON_LABEL"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_SENDING_LABEL"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_SEND_FAILED_LABEL"),
    readGameTextWithEnglishFallback(gameLocale, "settings_ui", "FEEDBACK_SEND_SUCCESS_LABEL"),
  ]);

  return {
    title,
    categoryLabel,
    descriptionPlaceholder,
    sendLabel,
    sendingLabel: stripGameMarkup(sendingLabel),
    sendFailedLabel,
    sendSuccessLabel,
  };
}

async function buildBorrowedGameCopyPayload(): Promise<Record<GameLocale, BorrowedGameCopyPayload>> {
  const entries = await Promise.all(
    GAME_LOCALES.map(async (gameLocale) => {
      const [
        chemicalXPlaceholder,
        comboPlaceholder,
        feedbackForm,
        historyCourseLanding,
        patchStage,
        patchBackstab,
        thisOrThat,
        transfigure,
        defragment,
        decisionsDecisions,
        pagestorm,
      ] = await Promise.all([
        readGameTextWithEnglishFallback(
          gameLocale,
          "events",
          "TEA_MASTER.pages.TEA_OF_DISCOURTESY.description",
        ).then((description) => stripGameMarkup(lastNonEmptyLine(description))),
        readGameTextWithEnglishFallback(
          gameLocale,
          "events",
          "AMALGAMATOR.pages.INITIAL.description",
        ).then((description) => stripAquaMarkup(lastNonEmptyLine(description))),
        buildFeedbackFormGameCopy(gameLocale),
        buildHistoryCourseLandingGameCopy(gameLocale),
        buildPatchStageGameCopy(gameLocale),
        buildPatchBackstabGameCopy(gameLocale),
        buildThisOrThatGameCopy(gameLocale),
        buildTransfigureGameCopy(gameLocale),
        buildDefragmentGameCopy(gameLocale),
        buildDecisionsDecisionsGameCopy(gameLocale),
        buildPagestormGameCopy(gameLocale),
      ]);
      return [
        gameLocale,
        {
          chemicalXPlaceholder,
          comboPlaceholder,
          feedbackForm,
          historyCourseLanding,
          patchStage,
          patchBackstab,
          thisOrThat,
          transfigure,
          defragment,
          decisionsDecisions,
          pagestorm,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<GameLocale, BorrowedGameCopyPayload>;
}

async function buildToyBoxNewsPayload(): Promise<ToyBoxNewsPayload> {
  const latest = await getLatestByrdispatchEntry();
  return {
    latestDate: latest?.date ?? null,
    newSectionTitles: latest?.regularSections
      .filter((section) => section.statuses.includes("new"))
      .map((section) => section.title) ?? [],
  };
}

async function generateCommentEntitiesOnly() {
  const commentEntities = await loadAllEntities();
  await Promise.all([
    writeJson({ path: "generated/comment-entities-sts2.json", data: commentEntities }),
    writeJson({ path: "comment-entities/sts2", data: commentEntities }),
  ]);
}

async function generateSearchIndexOnly() {
  const searchIndex = await buildSearchIndexPayload();
  await Promise.all([
    writeJson({ path: "generated/search-index.json", data: searchIndex }),
    writeJson({ path: "api/search-index", data: searchIndex }),
  ]);
}

async function main() {
  if (process.argv.includes("--comment-entities-only")) {
    await generateCommentEntitiesOnly();
    return;
  }
  if (process.argv.includes("--search-index-only")) {
    await generateSearchIndexOnly();
    return;
  }
  if (process.argv.includes("--borrowed-game-copy-only")) {
    const borrowedGameCopyPayload = await buildBorrowedGameCopyPayload();
    await writeSourceJson({
      path: "generated/borrowed-game-copy.json",
      data: borrowedGameCopyPayload,
    });
    return;
  }
  if (process.argv.includes("--toy-box-news-only")) {
    const toyBoxNewsPayload = await buildToyBoxNewsPayload();
    await writeSourceJson({
      path: "generated/toy-box-news.json",
      data: toyBoxNewsPayload,
    });
    return;
  }
  if (process.argv.includes("--history-course-catalog-only")) {
    await generateHistoryCourseCatalogOnly();
    return;
  }
  if (process.argv.includes("--history-loc-tables-only")) {
    await Promise.all((await buildHistoryLocTableTargets()).map(writeJson));
    return;
  }
  if (process.argv.includes("--this-or-that-resources-only")) {
    const thisOrThatResourceTargets = await buildThisOrThatResourceTargets();
    await Promise.all(thisOrThatResourceTargets.map(writeJson));
    return;
  }
  if (process.argv.includes("--decisions-decisions-presets-only")) {
    await writeJson(await buildDecisionsDecisionsPresetTarget());
    return;
  }

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
    toyBoxNewsPayload,
    decisionsDecisionsPresetTarget,
    historyLocTableTargets,
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
    buildToyBoxNewsPayload(),
    buildDecisionsDecisionsPresetTarget(),
    buildHistoryLocTableTargets(),
  ]);

  await Promise.all([
    writeSourceJson({ path: "generated/borrowed-game-copy.json", data: borrowedGameCopyPayload }),
    writeSourceJson({ path: "generated/toy-box-news.json", data: toyBoxNewsPayload }),
    writeSourceJsonCompact({
      path: "generated/history-course-catalog.json",
      data: {
        cards: koreanCompendiumDetailPayload.resources.cards,
        relics: koreanCompendiumDetailPayload.resources.relics,
        potions: koreanCompendiumDetailPayload.resources.potions,
        powers: koreanCompendiumDetailPayload.resources.powers,
        monsters: koreanCompendiumDetailPayload.resources.monsters,
        enchantments: koreanCompendiumDetailPayload.resources.enchantments,
        tipSources: koreanCompendiumDetailPayload.cardSideTipSources,
      },
    }),
    writeHistoryLastSceneCatalog({
      encounters: koreanCompendiumDetailPayload.resources.encounters,
      characters: koreanCompendiumDetailPayload.resources.characters,
      ancients: koreanCompendiumDetailPayload.resources.ancients,
      events: koreanCompendiumDetailPayload.resources.events,
    }),
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
    ...historyLocTableTargets.map(writeJson),
    writeJson(decisionsDecisionsPresetTarget),
    copyPublicFile(spinePlayerClientPath, "generated/spine-player.min.js"),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
