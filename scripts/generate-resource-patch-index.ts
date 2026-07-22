import fs from "fs/promises";
import path from "path";
import { getSTS2Patches, getSTS2PatchLines, getSTS2Stories } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { GAME_LOCALES } from "@/lib/i18n";
import {
  addResourcePatchIndexLocalizedNames,
  buildResourcePatchIndex,
} from "@/lib/resource-patch-index";

const outputPath = path.join(process.cwd(), "public/generated/sts2-resource-patch-index.json");

async function main() {
  const [patchLines, patches, localizedEntityEntries, stories] = await Promise.all([
    getSTS2PatchLines(),
    getSTS2Patches(),
    Promise.all(GAME_LOCALES.map(async (gameLocale) => [
      gameLocale,
      await loadAllEntities({ gameLocale }),
    ] as const)),
    getSTS2Stories(),
  ]);
  const entitiesByLocale = new Map(localizedEntityEntries);
  const entities = entitiesByLocale.get("kor") ?? [];
  const index = addResourcePatchIndexLocalizedNames(
    buildResourcePatchIndex({ patchLines, patches, entities, stories }),
    entitiesByLocale,
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(index)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
