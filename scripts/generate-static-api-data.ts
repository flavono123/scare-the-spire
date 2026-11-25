import fs from "fs/promises";
import path from "path";
import { buildElementArt, buildSearchIndexPayload, buildSearchNames } from "../src/lib/search-index-data";
import { GLOBAL_SEARCH_NAMES_ROOT, globalSearchNamesPath } from "../src/lib/global-search";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { getCodexCards } from "../src/lib/codex-data";
import { cardConLocaleText } from "../src/lib/card-con-locale";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";
import {
  COMPENDIUM_DATA_CHUNK_MAX_BYTES,
  COMPENDIUM_DATA_CHUNK_ROOT,
} from "../src/lib/compendium-data-chunks";
import { buildCompendiumDataChunkFiles } from "../src/lib/compendium-data-chunks.server";
import { buildCompendiumResourceManifest } from "../src/lib/compendium-resource-manifest";
import { getLatestByrdispatchNotice } from "../src/lib/byrdispatch";
import { getSTS2PatchLines } from "../src/lib/data";
import { GAME_LOCALES } from "../src/lib/i18n";
import type { GameLocale } from "../src/lib/i18n";
import { readGameLocalizationTable } from "../src/lib/game-localization";
import { loadCompactLegacyCards, loadCompactThisOrThatEntities } from "../src/lib/this-or-that-data";
import {
  DECISIONS_DECISIONS_GAME_VERSION,
  stampAllPresetIds,
} from "../src/lib/decisions-decisions";
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


async function writeJson(target: StaticJsonTarget) {
  const filePath = path.join(publicDir, target.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(target.data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function writeCompendiumDataChunks(
  files: Awaited<ReturnType<typeof buildCompendiumDataChunkFiles>>,
) {
  const chunkRoot = path.join(publicDir, COMPENDIUM_DATA_CHUNK_ROOT.slice(1));
  await fs.rm(chunkRoot, { recursive: true, force: true });
  let largest = { path: "", bytes: 0 };
  for (const file of files) {
    const body = `${JSON.stringify(file.data)}\n`;
    const bytes = Buffer.byteLength(body);
    if (bytes > COMPENDIUM_DATA_CHUNK_MAX_BYTES) {
      throw new Error(
        `${file.path} is ${bytes} bytes; split it so every Compendium data chunk stays under ${COMPENDIUM_DATA_CHUNK_MAX_BYTES} bytes.`,
      );
    }
    if (bytes > largest.bytes) largest = { path: file.path, bytes };
    const filePath = path.join(publicDir, file.path.slice(1));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }
  console.log(
    `Wrote ${files.length} Compendium data chunks under ${path.relative(process.cwd(), chunkRoot)} (largest ${largest.path}: ${largest.bytes} bytes)`,
  );
}

// Older builds published the whole Compendium as one >2MB payload per locale.
const STALE_STATIC_ALIASES = [
  "api/search-index",
  "comment-entities/sts2",
  "generated/compendium-detail-kor.json",
  "generated/compendium-detail-eng.json",
];

async function removeStaleStaticAliases() {
  await Promise.all(
    STALE_STATIC_ALIASES.map((relativePath) => fs.rm(path.join(publicDir, relativePath), { force: true })),
  );
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
    targets.push({
      path: `generated/decisions-decisions-legacy-cards-${gameLocale}.json`,
      data: await loadCompactLegacyCards({ gameLocale }),
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

async function cardConLocaleTargets(): Promise<StaticJsonTarget[]> {
  const locales = GAME_LOCALES.filter((gameLocale) => gameLocale !== "kor");
  const targets: StaticJsonTarget[] = [];
  for (const gameLocale of locales) {
    const cards = await getCodexCards({ includeDeprecated: true, gameLocale });
    const data: Record<string, ReturnType<typeof cardConLocaleText>> = {};
    for (const card of cards) data[card.id] = cardConLocaleText(card);
    targets.push({
      path: `generated/card-con-locale-${gameLocale}.json`,
      data,
    });
  }
  return targets;
}

async function generateCommentEntitiesOnly() {
  const commentEntities = await loadAllEntities();
  await writeJson({ path: "generated/comment-entities-sts2.json", data: commentEntities });
  await removeStaleStaticAliases();
}

async function searchNameTargets(): Promise<StaticJsonTarget[]> {
  const gameLocales = GAME_LOCALES.filter((gameLocale) => globalSearchNamesPath(gameLocale));
  return Promise.all(gameLocales.map(async (gameLocale) => ({
    path: `${GLOBAL_SEARCH_NAMES_ROOT}/${gameLocale}.json`,
    data: await buildSearchNames(gameLocale),
  })));
}

async function generateSearchIndexOnly() {
  const [searchIndex, searchNames] = await Promise.all([buildSearchIndexPayload(), searchNameTargets()]);
  await Promise.all([
    writeJson({ path: "generated/search-index.json", data: searchIndex }),
    writeJson({ path: "generated/element-art.json", data: buildElementArt(searchIndex) }),
    ...searchNames.map(writeJson),
  ]);
  await removeStaleStaticAliases();
}

async function main() {
  if (process.argv.includes("--card-con-locales-only")) {
    await Promise.all((await cardConLocaleTargets()).map(writeJson));
    return;
  }
  if (process.argv.includes("--comment-entities-only")) {
    await generateCommentEntitiesOnly();
    return;
  }
  if (process.argv.includes("--search-index-only")) {
    await generateSearchIndexOnly();
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

  const cardConLocales = await cardConLocaleTargets();
  const [
    searchIndex,
    commentEntities,
    koreanCompendiumDetailPayload,
    compendiumDataChunkFiles,
    compendiumResourceManifest,
    latestByrdispatchNotice,
    sts2PatchLines,
    thisOrThatResourceTargets,
    decisionsDecisionsPresetTarget,
    historyLocTableTargets,
    searchNames,
  ] = await Promise.all([
    buildSearchIndexPayload(),
    loadAllEntities(),
    buildCompendiumDetailPayload("ko"),
    buildCompendiumDataChunkFiles(),
    buildCompendiumResourceManifest(),
    getLatestByrdispatchNotice(),
    getSTS2PatchLines(),
    buildThisOrThatResourceTargets(),
    buildDecisionsDecisionsPresetTarget(),
    buildHistoryLocTableTargets(),
    searchNameTargets(),
  ]);

  await Promise.all([
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
    writeJson({ path: "generated/element-art.json", data: buildElementArt(searchIndex) }),
    ...searchNames.map(writeJson),
    writeJson({ path: "generated/comment-entities-sts2.json", data: commentEntities }),
    ...cardConLocales.map(writeJson),
    writeCompendiumDataChunks(compendiumDataChunkFiles),
    writeJson({ path: "generated/compendium-resource-manifest.json", data: compendiumResourceManifest }),
    writeJson({ path: "generated/latest-byrdispatch-notice.json", data: latestByrdispatchNotice }),
    writeJson({ path: "generated/sts2-patch-lines.json", data: sts2PatchLines }),
    ...thisOrThatResourceTargets.map(writeJson),
    ...historyLocTableTargets.map(writeJson),
    writeJson(decisionsDecisionsPresetTarget),
    copyPublicFile(spinePlayerClientPath, "generated/spine-player.min.js"),
  ]);
  await removeStaleStaticAliases();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
