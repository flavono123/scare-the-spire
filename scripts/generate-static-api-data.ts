import fs from "fs/promises";
import path from "path";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";
import { buildCompendiumResourceManifest } from "../src/lib/compendium-resource-manifest";
import { getLatestByrdispatchNotice } from "../src/lib/byrdispatch";
import { getSTS2PatchLines } from "../src/lib/data";
import { GAME_LOCALES } from "../src/lib/i18n";
import { loadThisOrThatEntities } from "../src/lib/this-or-that-data";

type StaticJsonTarget = {
  path: string;
  data: unknown;
};

const publicDir = path.join(process.cwd(), "public");
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
      data: await loadThisOrThatEntities({ gameLocale }),
    });
  }
  return targets;
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
  ] = await Promise.all([
    buildSearchIndexPayload(),
    loadAllEntities(),
    buildCompendiumDetailPayload("ko"),
    buildCompendiumDetailPayload("en"),
    buildCompendiumResourceManifest(),
    getLatestByrdispatchNotice(),
    getSTS2PatchLines(),
    buildThisOrThatResourceTargets(),
  ]);

  await Promise.all([
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
