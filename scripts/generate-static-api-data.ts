import fs from "fs/promises";
import path from "path";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import { buildCompendiumDetailPayload } from "../src/lib/compendium-detail-payload-builder";

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
  const [searchIndex, commentEntities, compendiumDetailPayload] = await Promise.all([
    buildSearchIndexPayload(),
    loadAllEntities(),
    buildCompendiumDetailPayload(),
  ]);

  await Promise.all([
    writeJson({ path: "generated/search-index.json", data: searchIndex }),
    writeJson({ path: "generated/comment-entities-sts2.json", data: commentEntities }),
    writeJson({ path: "generated/compendium-detail-kor.json", data: compendiumDetailPayload }),
    writeJson({ path: "api/search-index", data: searchIndex }),
    writeJson({ path: "comment-entities/sts2", data: commentEntities }),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
