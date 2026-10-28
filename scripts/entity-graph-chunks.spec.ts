import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildAllEntities } from "../src/lib/all-entities";
import {
  ALL_ENTITY_DATA_KEYS,
  compendiumDataChunkPath,
  COMPENDIUM_DATA_CHUNK_KEYS,
  type CompendiumDataChunkName,
  type CompendiumDataResources,
} from "../src/lib/compendium-data-chunks";
import { loadCompendiumDataResources } from "../src/lib/compendium-data-chunks.server";
import { GAME_LOCALES } from "../src/lib/i18n";
import { loadAllEntities } from "../src/lib/load-all-entities";

// Pages that used to receive loadAllEntities() as a prop now build the same
// graph on the client from the Compendium data chunks (loadAllEntityGraph).
// This guards that both paths keep producing the same entities.

type EntityDataResources = Pick<CompendiumDataResources, (typeof ALL_ENTITY_DATA_KEYS)[number]>;

function pickEntityData(resources: Partial<CompendiumDataResources>): EntityDataResources {
  const picked = {} as Record<string, unknown>;
  for (const key of ALL_ENTITY_DATA_KEYS) {
    assert.ok(key in resources, `missing ${key}`);
    picked[key] = resources[key];
  }
  return picked as EntityDataResources;
}

function readPublishedChunks(gameLocale: (typeof GAME_LOCALES)[number]): Partial<CompendiumDataResources> | null {
  const chunkNames = new Set<CompendiumDataChunkName>();
  for (const [chunk, keys] of Object.entries(COMPENDIUM_DATA_CHUNK_KEYS)) {
    if (keys.some((key) => (ALL_ENTITY_DATA_KEYS as readonly string[]).includes(key))) {
      chunkNames.add(chunk as CompendiumDataChunkName);
    }
  }
  const merged: Partial<CompendiumDataResources> = {};
  for (const chunk of chunkNames) {
    const file = path.join("public", compendiumDataChunkPath(gameLocale, chunk));
    if (!existsSync(file)) return null;
    Object.assign(merged, JSON.parse(readFileSync(file, "utf8")));
  }
  return merged;
}

async function main() {
  let publishedChecked = 0;
  for (const gameLocale of GAME_LOCALES) {
    const expected = JSON.stringify(await loadAllEntities({ gameLocale }));

    // The chunk payload goes through JSON on its way to the browser.
    const resources = JSON.parse(JSON.stringify(await loadCompendiumDataResources(gameLocale)));
    const fromResources = JSON.stringify(buildAllEntities(pickEntityData(resources)));
    assert.equal(fromResources, expected, `${gameLocale}: chunk-built entity graph differs from loadAllEntities`);

    const published = readPublishedChunks(gameLocale);
    if (published) {
      const fromPublished = JSON.stringify(buildAllEntities(pickEntityData(published)));
      assert.equal(fromPublished, expected, `${gameLocale}: published chunks are stale (run pnpm static:data)`);
      publishedChecked += 1;
    }
  }
  console.log(
    `entity graph chunks match loadAllEntities for ${GAME_LOCALES.length} game locales`
      + ` (${publishedChecked} checked against public/generated chunks)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
