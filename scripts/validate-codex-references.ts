#!/usr/bin/env npx tsx
/**
 * validate-codex-references.ts
 *
 * Validates manually curated Codex entity-to-entity reference maps.
 *
 * Usage: pnpm codex:validate-references
 * Exit code: 0 = pass, 1 = invalid IDs or duplicate IDs found
 */

import fs from "fs";
import path from "path";
import {
  EVENT_RELATED_CARD_IDS,
  EVENT_RELATED_RELIC_IDS,
} from "../src/lib/codex-references";

interface CodexEntity {
  id?: unknown;
  name?: unknown;
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
  map,
  mapName,
}: {
  entityIds: Set<string>;
  entityKind: string;
  eventIds: Set<string>;
  map: RelationMap;
  mapName: string;
}): number {
  let errors = 0;
  let edgeCount = 0;

  for (const [eventId, relatedIds] of Object.entries(map)) {
    if (!eventIds.has(eventId)) {
      console.error(`[ERROR] ${mapName}: unknown event id ${eventId}`);
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

  console.log(`${mapName}: ${Object.keys(map).length} events, ${edgeCount} ${entityKind} references`);
  return errors;
}

function main(): void {
  const eventIds = idsFrom("data/sts2/kor/events.json");
  const cardIds = idsFrom("data/sts2/kor/cards.json");
  const relicIds = idsFrom("data/sts2/kor/relics.json");

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

  if (errors > 0) {
    console.error(`\nCodex reference validation FAILED: ${errors} error(s).`);
    process.exit(1);
  }

  console.log("\nCodex reference validation PASSED.");
}

main();
