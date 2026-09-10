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
  buildActTimeline,
  buildRunTimeline,
  nodeDurationForEntry,
} from "../src/lib/sts2-run-timeline";
import { historyRoomChoiceCopy, eventLastSceneChoices } from "../src/lib/history-room-choice";
import { restSiteChoiceDescription, restSiteOptionsForEntry } from "../src/lib/history-party";
import {
  quadraticBezier,
  itemHopPoint,
  cardFlyParametric,
} from "../src/components/history-course/last-scene-obtain-vfx";
import {
  LAST_SCENE_ALIVE_MS,
  LAST_SCENE_DYING_MS,
  LAST_SCENE_STEP_MS,
  lastSceneDurationMs,
  lastSceneHiddenRelicIds,
  lastSceneIdSetHas,
  lastScenePhase,
  lootSpecTaken,
  combatLootSpecs,
} from "../src/lib/history-last-scene-steps";
import {
  eventArtUrl,
  lastSceneBackgroundUrl,
  lastSceneMonsterSlots,
  restSiteBackgroundUrl,
  treasureRoomSpineAct,
} from "../src/lib/history-last-scene-assets";
import { playbackSpeedMultiplier } from "../src/lib/history-playback-rate";
import { matchEncounterFormationIndex } from "../src/lib/history-encounter-match";
import { getGameI18nTablesSync } from "../src/lib/sts2-game-i18n";
import type { CodexEncounter, CodexEvent } from "../src/lib/codex-types";

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
  NODE_BASE_MS + LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS,
);
assert.equal(
  nodeDurationForEntry(mundaneCombat, { sceneKind: "combat", highlight: true }),
  NODE_BASE_MS + LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS,
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
assert.equal(
  lastSceneBackgroundUrl({
    kind: "treasure",
    modelId: "ROOM.TREASURE",
    actId: "ACT.OVERGROWTH",
  }),
  "",
);
assert.equal(treasureRoomSpineAct("ACT.OVERGROWTH"), 1);
assert.equal(treasureRoomSpineAct("ACT.HIVE"), 2);
assert.equal(treasureRoomSpineAct("ACT.GLORY"), 3);
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

assert.equal(
  lastSceneKind(
    entry({
      map_point_type: "unknown",
      ancient_choice: [{ id: "RELIC.KALEIDOSCOPE", picked: true }],
      rooms: [{ room_type: "event", model_id: "EVENT.NEOW", turns_taken: 0 }],
    }),
  ),
  "ancient",
);

const twoFormations = {
  id: "TEST",
  compositions: [
    {
      id: "pair",
      weight: 1,
      slots: [
        [{ id: "AXEBOT", name: "잘라봇", nameEn: "Axebot" }],
        [{ id: "AXEBOT", name: "잘라봇", nameEn: "Axebot" }],
      ],
      slotNames: [null, null],
    },
    {
      id: "solo",
      weight: 1,
      slots: [[{ id: "TURRET", name: "포탑", nameEn: "Turret" }]],
      slotNames: [null],
    },
  ],
  monsters: [],
} as unknown as CodexEncounter;

assert.equal(
  matchEncounterFormationIndex(twoFormations, ["MONSTER.AXEBOT", "MONSTER.AXEBOT"]),
  0,
);
assert.equal(
  matchEncounterFormationIndex(twoFormations, ["TURRET"]),
  1,
);

const tables = getGameI18nTablesSync("kor");
const eventCopy = historyRoomChoiceCopy(
  {
    id: "IMMERSE",
    picked: true,
    locTable: "events",
    locKey: "ABYSSAL_BATHS.pages.INITIAL.options.IMMERSE.title",
    locVars: { MaxHp: 2, Damage: 9 },
  },
  tables,
  "events",
  {
    choiceLoc: {
      events: {
        "ABYSSAL_BATHS.pages.INITIAL.options.IMMERSE.description":
          "최대 체력을 [green]{MaxHp}[/green] 얻습니다. 피해를 [red]{Damage}[/red] 받습니다.",
      },
      ancients: {},
      relics: {},
    },
  },
);
assert.equal(eventCopy.title, "몸을 담근다");
assert.match(eventCopy.description ?? "", /9/);

const relicCopy = historyRoomChoiceCopy(
  {
    id: "RELIC.KALEIDOSCOPE",
    picked: true,
    locTable: "relics",
    locKey: "KALEIDOSCOPE.eventDescription",
  },
  tables,
  "ancients",
  {
    choiceLoc: {
      events: {},
      ancients: {},
      relics: {
        "KALEIDOSCOPE.eventDescription": "다른 캐릭터의 카드 보상을 2번 얻습니다.",
      },
    },
  },
);
assert.equal(relicCopy.title, "만화경");
assert.ok(relicCopy.description);

const selfHelpCopy = historyRoomChoiceCopy(
  {
    id: "READ_PASSAGE",
    picked: true,
    locTable: "events",
    locKey: "SELF_HELP_BOOK.pages.INITIAL.options.READ_PASSAGE.title",
    locVars: { Enchantment2: "NIMBLE" },
  },
  tables,
  "events",
  {
    choiceLoc: {
      events: {
        "SELF_HELP_BOOK.pages.INITIAL.options.READ_PASSAGE.description":
          "스킬 카드를 1장 선택해 [purple]{Enchantment2}[/purple]을 [blue]{Enchantment2Amount}[/blue] [gold]인챈트[/gold]합니다.",
      },
      ancients: {},
      relics: {},
    },
  },
);
assert.equal(selfHelpCopy.title, "무작위 문단을 읽는다");
assert.match(selfHelpCopy.description ?? "", /기민함/);
assert.doesNotMatch(selfHelpCopy.description ?? "", /\{Enchantment2Amount\}/);

const combatWithLoot = entry({
  map_point_type: "monster",
  gold_gained: 12,
  potion_choices: [{ id: "POTION.EXPLOSIVE_VIAL", picked: true }],
  card_choices: [
    { id: "CARD.A", picked: true },
    { id: "CARD.B", picked: false },
    { id: "CARD.C", picked: false },
  ],
  rooms: [{ room_type: "monster", model_id: "ENCOUNTER.X", turns_taken: 1 }],
});
assert.equal(
  lastSceneDurationMs("combat", combatWithLoot),
  LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS + 4 * LAST_SCENE_STEP_MS,
);
assert.equal(lastScenePhase("combat", combatWithLoot, 0).kind, "alive");
assert.equal(lastScenePhase("combat", combatWithLoot, LAST_SCENE_STEP_MS).kind, "dying");
assert.deepEqual(
  lastScenePhase("combat", combatWithLoot, LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS),
  { kind: "loot", resolvedCount: 0, total: 3, beatProgress: 0 },
);
assert.equal(
  lastScenePhase(
    "combat",
    combatWithLoot,
    LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS + 3 * LAST_SCENE_STEP_MS,
  ).kind,
  "cards",
);
assert.equal(lastScenePhase("event", combatWithLoot, 0).kind, "choice");
assert.equal(lastScenePhase("event", combatWithLoot, LAST_SCENE_STEP_MS).kind, "receipt");
assert.equal(lastScenePhase("shop", combatWithLoot, 0).kind, "shop");

const rateTimeline = buildRunTimeline([actFromHistory([mundaneCombat])]);
assert.equal(playbackSpeedMultiplier(rateTimeline, 0, 2), 2);
assert.equal(playbackSpeedMultiplier(rateTimeline, NODE_BASE_MS + 1, 2), 1);

assert.match(
  lastSceneBackgroundUrl({
    kind: "rest",
    modelId: null,
    actId: "ACT.OVERGROWTH",
  }),
  /overgrowth_rest_site_bg\.webp$/,
);
assert.equal(restSiteBackgroundUrl("ACT.HIVE"), "/images/sts2/rooms/rest-sites/hive_rest_site_00.webp");
assert.deepEqual(restSiteOptionsForEntry({ rest_site_choices: ["SMITH"] }), ["HEAL", "SMITH"]);
assert.match(
  restSiteChoiceDescription("HEAL", "kor", { hp_healed: 23, max_hp: 76 }) ?? "",
  /23/,
);
assert.doesNotMatch(
  restSiteChoiceDescription("HEAL", "kor", { hp_healed: 23, max_hp: 76 }) ?? "",
  /\{Heal\}|\{ExtraText\}/,
);

const cheeseEvent = {
  id: "ROOM_FULL_OF_CHEESE",
  pages: [
    {
      id: "INITIAL",
      description: null,
      options: [
        { id: "GORGE", title: "잔뜩 먹는다", description: "cards" },
        { id: "SEARCH", title: "탐색한다", description: "damage" },
      ],
    },
  ],
  options: null,
} as unknown as CodexEvent;
const cheeseChoices = eventLastSceneChoices(cheeseEvent, [
  { id: "SEARCH", picked: true },
]);
assert.equal(cheeseChoices.length, 2);
assert.equal(cheeseChoices.filter((choice) => !choice.picked).length, 1);
assert.equal(cheeseChoices.find((choice) => choice.picked)?.id, "SEARCH");

const skippedPotion = combatLootSpecs(entry({
  potion_choices: [{ id: "POTION.EXPLOSIVE_VIAL", picked: false }],
}))[0];
assert.ok(skippedPotion);
assert.equal(lootSpecTaken(skippedPotion, entry({ potion_choices: [{ id: "POTION.EXPLOSIVE_VIAL", picked: false }] })), false);

const relicLootEntry = entry({
  map_point_type: "monster",
  relic_choices: [{ id: "RELIC.POMANDER", picked: true }],
  rooms: [{ room_type: "monster", model_id: "ENCOUNTER.X", turns_taken: 1 }],
});
const combatLootStart = LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS;
assert.ok(
  lastSceneHiddenRelicIds("combat", relicLootEntry, combatLootStart).has("RELIC.POMANDER"),
);
assert.equal(
  lastSceneHiddenRelicIds("combat", relicLootEntry, combatLootStart + LAST_SCENE_STEP_MS).has("RELIC.POMANDER"),
  false,
);
assert.ok(
  lastSceneIdSetHas(
    lastSceneHiddenRelicIds("combat", relicLootEntry, combatLootStart),
    "POMANDER",
  ),
);

const shopRelicEntry = entry({
  map_point_type: "shop",
  relic_choices: [{ id: "RELIC.POMANDER", picked: true }],
});
assert.ok(lastSceneHiddenRelicIds("shop", shopRelicEntry, 0).has("RELIC.POMANDER"));
assert.equal(
  lastSceneHiddenRelicIds("shop", shopRelicEntry, LAST_SCENE_STEP_MS).has("RELIC.POMANDER"),
  false,
);

assert.equal(cardFlyParametric(0), 0);
assert.ok(cardFlyParametric(1) >= 1 - 1e-9);
const hopMid = itemHopPoint({ x: 0, y: 100 }, { x: 100, y: 0 }, 0.5);
assert.ok(hopMid.y > -40 && hopMid.y < 60, "relic/potion hop stays a shallow arc, not a 350px throw");
const cardMid = quadraticBezier(
  { x: 0, y: 400 },
  { x: 200, y: 40 },
  { x: 100, y: 700 },
  0.5,
);
assert.ok(cardMid.y > 400, "card bezier control below the midpoint dips then rises to the deck");

console.log("history-last-scene.spec.ts ok");
