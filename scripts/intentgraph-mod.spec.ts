import assert from "node:assert/strict";
import {
  evaluateIntentGraphCondition,
  resolveIntentGraph,
  type IntentGraphEntry,
} from "../src/lib/intent-graph/intentgraph-mod";

assert.equal(evaluateIntentGraphCondition("true", { ascension: 0 }), true);
assert.equal(evaluateIntentGraphCondition("ascension>=3 && !m.asleep", { ascension: 3, monsterFields: { asleep: false } }), true);
assert.equal(evaluateIntentGraphCondition("ascension>=3 && !m.asleep", { ascension: 3, monsterFields: { asleep: true } }), false);
assert.equal(evaluateIntentGraphCondition("m.hardMode || ascension < 2", { ascension: 5 }), false);
assert.equal(evaluateIntentGraphCondition("(act == 3) && index != 0", { ascension: 0, act: 3, index: 1 }), true);

// Synthetic entries (not mod data) covering legacy a0/a1/a2 tiers and graphList extend/overwrite.
const legacy: IntentGraphEntry = {
  width: 3,
  height: 1,
  a0: {
    damages: [{ min: 6 }, { min: 14 }],
    icons: [
      { x: 0, y: 0, type: "BUFF" },
      { x: 1, y: 0, type: "ATTACK", damageIndex: 1, percentage: 67, limit: 2 },
    ],
    arrows: [{ path: [0, 1, 0.5, 2] }],
  },
  a1: { damages: [{ min: 8 }, { min: 16 }] },
  a2: { overwrite: true, width: 5, height: 1, icons: [{ x: 0, y: 0, type: "BUFF" }] },
};

const eliteA0 = resolveIntentGraph(legacy, "ELITE", { ascension: 2 });
assert.equal(eliteA0?.ascensionLevel, 0);
assert.equal(eliteA0?.damages[1]?.min, 14);

const eliteA3 = resolveIntentGraph(legacy, "ELITE", { ascension: 3 });
assert.equal(eliteA3?.ascensionLevel, 3);
assert.equal(eliteA3?.damages[0]?.min, 8);
assert.equal(eliteA3?.icons.length, 2, "a1 extends a0 icons");
assert.equal(eliteA3?.icons[1]?.attackCount, 1, "attackCount defaults to 1");

const eliteA18 = resolveIntentGraph(legacy, "ELITE", { ascension: 18 });
assert.equal(eliteA18?.ascensionLevel, 18);
assert.equal(eliteA18?.width, 5);
assert.equal(eliteA18?.icons.length, 1, "overwrite replaces everything");

const normalA17 = resolveIntentGraph(legacy, "NORMAL", { ascension: 17 });
assert.equal(normalA17?.ascensionLevel, 17, "normal monsters use 2/17 tiers");

const listed: IntentGraphEntry = {
  width: 4,
  height: 2,
  graphList: [
    { id: "base", damages: [{ min: 11 }, { min: 7 }], icons: [{ x: 0, y: 0, type: "ATTACK", damageIndex: 0 }] },
    { condition: "ascension>=2", extend: "base", ascensionLevel: 2, damages: [{ min: 12 }] },
    { id: "hard", condition: "m.hardMode", width: 2, damages: [{ min: 11, max: 9 }] },
  ],
};

assert.equal(resolveIntentGraph(listed, "NORMAL", { ascension: 0 })?.damages[0]?.min, 11);
const listedA2 = resolveIntentGraph(listed, "NORMAL", { ascension: 2 });
assert.equal(listedA2?.damages[0]?.min, 12);
assert.equal(listedA2?.damages[1]?.min, 7, "null-free patch keeps inherited damages");
const hard = resolveIntentGraph(listed, "NORMAL", { ascension: 2, monsterFields: { hardMode: 1 } });
assert.equal(hard?.width, 2, "last declared matching graph wins");
assert.equal(hard?.damages[0]?.max, 11, "max is clamped up to min");

console.log("intentgraph-mod.spec.ts: ok");
