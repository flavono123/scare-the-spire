#!/usr/bin/env npx tsx
/**
 * validate-codex-references.ts
 *
 * Validates Codex entity-to-entity reference maps and extracted entity refs.
 *
 * Usage: pnpm codex:validate-references
 * Exit code: 0 = pass, 1 = invalid IDs or duplicate IDs found
 */

import fs from "fs";
import path from "path";
import {
  CARD_RELATED_ENCHANTMENT_IDS,
  EVENT_RELATED_CARD_IDS,
  EVENT_RELATED_ENCHANTMENT_IDS,
  EVENT_RELATED_POTION_IDS,
  EVENT_RELATED_POWER_IDS,
  EVENT_RELATED_RELIC_IDS,
  POTION_RELATED_CARD_IDS,
  POTION_RELATED_ENCHANTMENT_IDS,
  POTION_RELATED_POWER_IDS,
  RELIC_RELATED_CARD_IDS,
  RELIC_RELATED_ENCHANTMENT_IDS,
} from "../src/lib/codex-references";

interface CodexEntity {
  id?: unknown;
  name?: unknown;
}

interface MonsterPowerApplication {
  power_id?: unknown;
}

interface MonsterMoveReference {
  id?: unknown;
  power_applications?: unknown;
}

interface MonsterReference {
  id?: unknown;
  moves?: unknown;
  bestiary_moves?: unknown;
  initial_power_applications?: unknown;
}

type RelationMap = Record<string, readonly string[]>;

function readJson<T>(relPath: string): T {
  const fullPath = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function idsFrom(relPath: string): Set<string> {
  return new Set(
    readJson<CodexEntity[]>(relPath)
      .map((entity) => entity.id)
      .filter((id): id is string => typeof id === "string"),
  );
}

function validateRelationMap({
  entityIds,
  entityKind,
  eventIds,
  sourceKind = "event",
  map,
  mapName,
}: {
  entityIds: Set<string>;
  entityKind: string;
  eventIds: Set<string>;
  sourceKind?: string;
  map: RelationMap;
  mapName: string;
}): number {
  let errors = 0;
  let edgeCount = 0;

  for (const [eventId, relatedIds] of Object.entries(map)) {
    if (!eventIds.has(eventId)) {
      console.error(`[ERROR] ${mapName}: unknown ${sourceKind} id ${eventId}`);
      errors++;
    }

    const seen = new Set<string>();
    for (const relatedId of relatedIds) {
      edgeCount++;

      if (seen.has(relatedId)) {
        console.error(`[ERROR] ${mapName}:${eventId}: duplicate ${entityKind} id ${relatedId}`);
        errors++;
      }
      seen.add(relatedId);

      if (!entityIds.has(relatedId)) {
        console.error(`[ERROR] ${mapName}:${eventId}: unknown ${entityKind} id ${relatedId}`);
        errors++;
      }
    }
  }

  console.log(`${mapName}: ${Object.keys(map).length} ${sourceKind}s, ${edgeCount} ${entityKind} references`);
  return errors;
}

function asPowerApplications(value: unknown): MonsterPowerApplication[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MonsterPowerApplication => item !== null && typeof item === "object");
}

function asMoves(value: unknown): MonsterMoveReference[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MonsterMoveReference => item !== null && typeof item === "object");
}

function validateMonsterPowerApplications(
  monsters: MonsterReference[],
  powerIds: Set<string>,
): number {
  let errors = 0;
  let edgeCount = 0;

  function validateApplications(monsterId: string, location: string, applications: MonsterPowerApplication[]): void {
    for (const application of applications) {
      if (typeof application.power_id !== "string") continue;
      edgeCount++;
      if (!powerIds.has(application.power_id)) {
        console.error(`[ERROR] MONSTER_POWER_APPLICATIONS:${monsterId}:${location}: unknown power id ${application.power_id}`);
        errors++;
      }
    }
  }

  for (const monster of monsters) {
    if (typeof monster.id !== "string") continue;
    validateApplications(monster.id, "initial", asPowerApplications(monster.initial_power_applications));

    for (const move of asMoves(monster.moves)) {
      const moveId = typeof move.id === "string" ? move.id : "move";
      validateApplications(monster.id, moveId, asPowerApplications(move.power_applications));
    }

    for (const move of asMoves(monster.bestiary_moves)) {
      const moveId = typeof move.id === "string" ? `bestiary:${move.id}` : "bestiary";
      validateApplications(monster.id, moveId, asPowerApplications(move.power_applications));
    }
  }

  console.log(`MONSTER_POWER_APPLICATIONS: ${monsters.length} monsters, ${edgeCount} power references`);
  return errors;
}

function main(): void {
  const eventIds = idsFrom("data/sts2/kor/events.json");
  const cardIds = idsFrom("data/sts2/kor/cards.json");
  const enchantmentIds = idsFrom("data/sts2/kor/enchantments.json");
  const potionIds = idsFrom("data/sts2/kor/potions.json");
  const powerIds = idsFrom("data/sts2/kor/powers.json");
  const relicIds = idsFrom("data/sts2/kor/relics.json");
  const monsters = readJson<MonsterReference[]>("data/sts2/kor/monsters.json");

  let errors = 0;
  errors += validateRelationMap({
    entityIds: cardIds,
    entityKind: "card",
    eventIds,
    map: EVENT_RELATED_CARD_IDS,
    mapName: "EVENT_RELATED_CARD_IDS",
  });
  errors += validateRelationMap({
    entityIds: relicIds,
    entityKind: "relic",
    eventIds,
    map: EVENT_RELATED_RELIC_IDS,
    mapName: "EVENT_RELATED_RELIC_IDS",
  });
  errors += validateRelationMap({
    entityIds: potionIds,
    entityKind: "potion",
    eventIds,
    map: EVENT_RELATED_POTION_IDS,
    mapName: "EVENT_RELATED_POTION_IDS",
  });
  errors += validateRelationMap({
    entityIds: enchantmentIds,
    entityKind: "enchantment",
    eventIds,
    map: EVENT_RELATED_ENCHANTMENT_IDS,
    mapName: "EVENT_RELATED_ENCHANTMENT_IDS",
  });
  errors += validateRelationMap({
    entityIds: powerIds,
    entityKind: "power",
    eventIds,
    map: EVENT_RELATED_POWER_IDS,
    mapName: "EVENT_RELATED_POWER_IDS",
  });
  errors += validateRelationMap({
    entityIds: enchantmentIds,
    entityKind: "enchantment",
    eventIds: cardIds,
    sourceKind: "card",
    map: CARD_RELATED_ENCHANTMENT_IDS,
    mapName: "CARD_RELATED_ENCHANTMENT_IDS",
  });
  errors += validateRelationMap({
    entityIds: cardIds,
    entityKind: "card",
    eventIds: relicIds,
    sourceKind: "relic",
    map: RELIC_RELATED_CARD_IDS,
    mapName: "RELIC_RELATED_CARD_IDS",
  });
  errors += validateRelationMap({
    entityIds: enchantmentIds,
    entityKind: "enchantment",
    eventIds: relicIds,
    sourceKind: "relic",
    map: RELIC_RELATED_ENCHANTMENT_IDS,
    mapName: "RELIC_RELATED_ENCHANTMENT_IDS",
  });
  errors += validateRelationMap({
    entityIds: cardIds,
    entityKind: "card",
    eventIds: potionIds,
    sourceKind: "potion",
    map: POTION_RELATED_CARD_IDS,
    mapName: "POTION_RELATED_CARD_IDS",
  });
  errors += validateRelationMap({
    entityIds: powerIds,
    entityKind: "power",
    eventIds: potionIds,
    sourceKind: "potion",
    map: POTION_RELATED_POWER_IDS,
    mapName: "POTION_RELATED_POWER_IDS",
  });
  errors += validateRelationMap({
    entityIds: enchantmentIds,
    entityKind: "enchantment",
    eventIds: potionIds,
    sourceKind: "potion",
    map: POTION_RELATED_ENCHANTMENT_IDS,
    mapName: "POTION_RELATED_ENCHANTMENT_IDS",
  });
  errors += validateMonsterPowerApplications(monsters, powerIds);
  if (errors > 0) {
    console.error(`\nCodex reference validation FAILED: ${errors} error(s).`);
    process.exit(1);
  }

  console.log("\nCodex reference validation PASSED.");
}

main();
