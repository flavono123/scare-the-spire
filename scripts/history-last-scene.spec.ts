import assert from "node:assert/strict";
import {
  highlightKindsForEntry,
  isCombatHistoryEntry,
  lastSceneKind,
  usesDedicatedLastScene,
} from "../src/lib/history-last-scene";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
  ReplayMapPointType,
} from "../src/lib/sts2-run-replay";
import {
  NODE_BASE_MS,
  SCENE_HIGHLIGHT_MS,
  SCENE_MS,
  buildActTimeline,
  nodeDurationForEntry,
} from "../src/lib/sts2-run-timeline";
import {
  eventArtUrl,
  lastSceneBackgroundUrl,
  lastSceneMonsterSlots,
} from "../src/lib/history-last-scene-assets";

function entry(partial: Partial<ReplayHistoryEntry>): ReplayHistoryEntry {
  return {
    map_point_type: "monster",
    rooms: [],
    ...partial,
  };
}

function actFromHistory(history: ReplayHistoryEntry[]): ReplayActAnalysis {
  return {
    actIndex: 0,
    actId: "ACT.OVERGROWTH",
    actLabel: "1",
    baseFloor: 1,
    history,
    historyTypes: history.map((row) => row.map_point_type as ReplayMapPointType),
    nodes: [],
    edges: [],
    candidateNodeIdsByStep: [],
    candidateEdgeIdsByStep: [],
    matchedPathCount: 1,
    matchedPathCountCapped: false,
    exactReplay: true,
    rowCount: history.length,
    mapVariant: "standard",
    flightStepIndices: [],
    flightStepsUsed: 0,
    furCoatMarkerNodeIds: [],
    spoilsMarkerNodeId: null,
    flightArrivalNodeIds: [],
    bossPool: [],
    predictedFirstBoss: null,
    predictedSecondBoss: null,
  };
}

assert.equal(
  lastSceneKind(
    entry({
      map_point_type: "monster",
      rooms: [{ room_type: "monster", model_id: "ENCOUNTER.X", turns_taken: 3, monster_ids: ["MONSTER.SLUG"] }],
    }),
  ),
  "combat",
);
assert.equal(
  lastSceneKind(entry({ map_point_type: "shop", rooms: [{ room_type: "shop", model_id: null, turns_taken: 0 }] })),
  "shop",
);
assert.equal(
  lastSceneKind(
    entry({
      map_point_type: "unknown",
      rooms: [{ room_type: "monster", model_id: "ENCOUNTER.X", turns_taken: 2 }],
    }),
  ),
  "combat",
);
assert.equal(
  lastSceneKind(
    entry({
      map_point_type: "unknown",
      event_choices: [{ id: "EVENT.CHEESE.title", picked: true }],
      rooms: [{ room_type: "event", model_id: "EVENT.CHEESE", turns_taken: 0 }],
    }),
  ),
  "event",
);
assert.equal(
  lastSceneKind(entry({ map_point_type: "unknown", rooms: [] })),
  "stack",
);
assert.equal(lastSceneKind(entry({ map_point_type: "rest_site" })), "rest");
assert.equal(lastSceneKind(entry({ map_point_type: "treasure" })), "treasure");
assert.equal(lastSceneKind(entry({ map_point_type: "ancient" })), "ancient");
assert.equal(lastSceneKind(entry({ current_hp: 0 }), { isTerminalDeath: true }), "death");
assert.equal(usesDedicatedLastScene("combat"), true);
assert.equal(usesDedicatedLastScene("stack"), false);

const warPaintStarters = entry({
  map_point_type: "unknown",
  relic_choices: [{ id: "RELIC.WAR_PAINT", picked: true }],
  upgraded_cards: ["CARD.DEFEND_IRONCLAD", "CARD.DEFEND_IRONCLAD"],
  rooms: [{ room_type: "event", model_id: "EVENT.X", turns_taken: 0 }],
});
assert.deepEqual(
  highlightKindsForEntry(warPaintStarters, {
    actEntries: [warPaintStarters],
    entryIndex: 0,
    isTerminalDeath: false,
  }),
  ["starter-upgrade"],
);

const warPaintPayoff = entry({
  map_point_type: "shop",
  relic_choices: [{ id: "RELIC.WAR_PAINT", picked: true }],
  upgraded_cards: ["CARD.ESCAPE_PLAN", "CARD.DEADLY_POISON"],
  rooms: [{ room_type: "shop", model_id: null, turns_taken: 0 }],
});
assert.deepEqual(
  highlightKindsForEntry(warPaintPayoff, {
    actEntries: [warPaintPayoff],
    entryIndex: 0,
    isTerminalDeath: false,
  }),
  ["nonstarter-upgrade"],
);

const tentShop = entry({
  map_point_type: "shop",
  current_gold: 59,
  relic_choices: [{ id: "RELIC.MINIATURE_TENT", picked: false }],
  rooms: [{ room_type: "shop", model_id: null, turns_taken: 0 }],
});
assert.ok(
  highlightKindsForEntry(tentShop, {
    actEntries: [tentShop],
    entryIndex: 0,
    isTerminalDeath: false,
  }).includes("shop-leftover"),
);

const skipElite = entry({
  map_point_type: "elite",
  card_choices: [
    { id: "CARD.A", picked: false },
    { id: "CARD.B", picked: false },
  ],
  rooms: [{ room_type: "elite", model_id: "ENCOUNTER.E", turns_taken: 4 }],
});
assert.ok(
  highlightKindsForEntry(skipElite, {
    actEntries: [skipElite],
    entryIndex: 0,
    isTerminalDeath: false,
  }).includes("skip-rewards"),
);

const u1 = entry({
  map_point_type: "unknown",
  rooms: [{ room_type: "monster", model_id: "ENCOUNTER.A", turns_taken: 2, monster_ids: ["MONSTER.A"] }],
});
const u2 = entry({
  map_point_type: "unknown",
  rooms: [{ room_type: "monster", model_id: "ENCOUNTER.B", turns_taken: 2, monster_ids: ["MONSTER.B"] }],
});
assert.ok(isCombatHistoryEntry(u1));
assert.ok(
  highlightKindsForEntry(u1, {
    actEntries: [u1, u2],
    entryIndex: 0,
    isTerminalDeath: false,
  }).includes("unknown-combat-streak"),
);

const mundaneCombat = entry({
  map_point_type: "monster",
  rooms: [{ room_type: "monster", model_id: "ENCOUNTER.X", turns_taken: 1 }],
});
assert.equal(
  nodeDurationForEntry(mundaneCombat, { sceneKind: "combat", highlight: false }),
  NODE_BASE_MS + SCENE_MS,
);
assert.equal(
  nodeDurationForEntry(mundaneCombat, { sceneKind: "combat", highlight: true }),
  NODE_BASE_MS + SCENE_HIGHLIGHT_MS,
);

const act = buildActTimeline(actFromHistory([mundaneCombat, tentShop]));
assert.equal(act.entries[0].sceneKind, "combat");
assert.equal(act.entries[1].sceneKind, "shop");
assert.ok(act.entries[1].highlightKinds.includes("shop-leftover"));
assert.equal(act.entries[1].durationMs, NODE_BASE_MS + SCENE_HIGHLIGHT_MS);

assert.match(
  lastSceneBackgroundUrl({
    kind: "combat",
    modelId: "ENCOUNTER.AEONGLASS_BOSS",
    actId: "ACT.OVERGROWTH",
  }),
  /glory-a\.webp$/,
);
assert.match(
  lastSceneBackgroundUrl({
    kind: "ancient",
    modelId: "EVENT.NEOW",
    actId: "ACT.OVERGROWTH",
  }),
  /neow_fallback\.webp$/,
);
assert.match(
  lastSceneBackgroundUrl({
    kind: "shop",
    modelId: "ROOM.SHOP",
    actId: "ACT.HIVE",
  }),
  /hive-a\.webp$/,
);
assert.ok(lastSceneMonsterSlots("ENCOUNTER.AXEBOTS_NORMAL").length >= 1);
assert.equal(eventArtUrl("EVENT.FAKE_MERCHANT"), "/images/sts2/events/fake_merchant.webp");

console.log("history-last-scene.spec.ts ok");
