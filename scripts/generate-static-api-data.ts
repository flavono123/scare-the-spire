import fs from "fs/promises";
import path from "path";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";
import { buildCompendiumResourceManifest } from "../src/lib/compendium-resource-manifest";
import { getLatestByrdispatchNotice } from "../src/lib/byrdispatch";
import { getSTS2PatchLines } from "../src/lib/data";

type StaticJsonTarget = {
  path: string;
  data: unknown;
};

const publicDir = path.join(process.cwd(), "public");

async function writeJson(target: StaticJsonTarget) {
  const filePath = path.join(publicDir, target.path);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(target.data)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
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
  ] = await Promise.all([
    buildSearchIndexPayload(),
    loadAllEntities(),
    buildCompendiumDetailPayload("ko"),
    buildCompendiumDetailPayload("en"),
    buildCompendiumResourceManifest(),
    getLatestByrdispatchNotice(),
    getSTS2PatchLines(),
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
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
