import assert from "node:assert/strict";
import { archiveDir, loadCombatSimCatalog } from "../src/lib/combat-sim/catalog";
import { effectiveCard, parseCardSpec, runCombat, sceneParts } from "../src/lib/combat-sim/engine";
import { COMBAT_SIM_PRESETS } from "../src/lib/combat-sim/scenarios";
import { parseCombatSimQuery } from "../src/app/(main)/dev/combat-sim/query-input";
import { buildTimeline } from "../src/lib/combat-sim/timeline";
import type { SimEvent, SimResult, SimState } from "../src/lib/combat-sim/types";

const ids = (state: SimState, pile: keyof SimState["piles"]) =>
  state.piles[pile].map((uid) => {
    const card = state.cards[uid];
    return `${card.id}${card.upgraded ? "+" : ""}`;
  });

const energyTrail = (result: SimResult) =>
  result.steps.flatMap(({ event }) => (event.kind === "energy" ? [`${event.from}->${event.to}:${event.cause}`] : []));

const kinds = (result: SimResult, kind: SimEvent["kind"]) => result.steps.filter(({ event }) => event.kind === kind);

async function main() {
  assert.deepEqual(parseCardSpec("PREPARED+"), { id: "PREPARED", upgraded: true, count: 1 });
  assert.deepEqual(parseCardSpec("strike_silent*5"), { id: "STRIKE_SILENT", upgraded: false, count: 5 });

  // The query form decodes a raw `+` to a space; it still means upgraded.
  const query = parseCombatSimQuery({
    version: "0.102.0",
    character: "SILENT",
    encounter: "DOORMAKER_BOSS",
    energy: "3/3",
    hand: "ACROBATICS,PREPARED ",
    draw: "STRIKE_SILENT*6",
    powers: "DOORMAKER=GRASP_POWER:1",
    moves: "DOORMAKER=GRASP",
    script: "wait:600,play:ACROBATICS,play:PREPARED ,wait:1500",
  });
  assert.deepEqual(query.errors, []);
  assert.deepEqual(query.input, COMBAT_SIM_PRESETS["doormaker-grasp-0.102.0"]);

  // --- First scenario: v0.102.0 Doormaker Grasp ---------------------------------
  const input = COMBAT_SIM_PRESETS["doormaker-grasp-0.102.0"];
  const { catalog, warnings } = await loadCombatSimCatalog(input);

  // Versioned values, not invented ones.
  assert.equal(catalog.character?.hp, 70);
  assert.equal(catalog.character?.maxEnergy, 3);
  assert.equal(effectiveCard(catalog.cards.ACROBATICS, false).cost, 1);
  assert.equal(effectiveCard(catalog.cards.ACROBATICS, false).vars.Cards, 3);
  assert.equal(effectiveCard(catalog.cards.PREPARED, true).cost, 0);
  assert.equal(effectiveCard(catalog.cards.PREPARED, true).vars.Cards, 2, "Prepared+ draws and discards 2");
  assert.equal(effectiveCard(catalog.cards.STRIKE_SILENT, false).cost, 1);
  assert.deepEqual(catalog.encounter.monsters, [{ monsterId: "DOORMAKER", slot: null }]);
  assert.equal(catalog.monsters.DOORMAKER.moves.GRASP.intents[0].damage, 20, "v0.102.0 Grasp attacks for 20");

  const result = runCombat(input, catalog);
  assert.deepEqual(result.warnings.filter((warning) => !warnings.includes(warning)), []);

  // Setup: Grasp afflicts every card (hand and draw pile) with Weighted 1.
  const afflicted = Object.values(result.start.cards).filter((card) => card.affliction?.id === "WEIGHTED" && card.affliction.amount === 1);
  assert.equal(afflicted.length, 8);
  assert.equal(result.start.energy, 3);

  // Acrobatics: cost 3->2, Weighted 2->1, draw 3, discard 1.
  // Prepared+: cost 0 (no change), Weighted 1->0, draw 2, discard 2.
  assert.deepEqual(energyTrail(result), ["3->2:cost", "2->1:affliction", "1->0:affliction"]);
  assert.equal(kinds(result, "afflictionTrigger").length, 2);
  const draws = result.steps.filter(({ event }) => event.kind === "move" && event.cause === "draw");
  const discards = result.steps.filter(({ event }) => event.kind === "move" && event.cause === "discard");
  assert.deepEqual(draws.map(({ action }) => action), [1, 1, 1, 2, 2]);
  assert.deepEqual(discards.map(({ action }) => action), [1, 2, 2]);

  // The Weighted energy loss lands before the card's own draw (OnPlayWrapper order).
  const firstPlay = result.steps.filter(({ action }) => action === 1).map(({ event }) => event.kind);
  assert.ok(firstPlay.indexOf("afflictionTrigger") < firstPlay.indexOf("move", firstPlay.indexOf("afflictionTrigger")));

  const end = result.final;
  assert.equal(end.energy, 0);
  assert.deepEqual(ids(end, "hand"), ["STRIKE_SILENT", "STRIKE_SILENT"]);
  assert.deepEqual(ids(end, "discard"), ["STRIKE_SILENT", "ACROBATICS", "STRIKE_SILENT", "STRIKE_SILENT", "PREPARED+"]);
  assert.deepEqual(ids(end, "draw"), ["STRIKE_SILENT"]);
  assert.deepEqual(ids(end, "play"), []);
  // Every card left in hand costs 1 with 0 energy: nothing is playable.
  for (const uid of end.piles.hand) {
    assert.ok(effectiveCard(catalog.cards[end.cards[uid].id], end.cards[uid].upgraded).cost > end.energy);
  }

  // Playing a Strike now is rejected for energy.
  const stuck = runCombat({ ...input, script: [...input.script!, { do: "play", card: "STRIKE_SILENT" }] }, catalog);
  const rejected = kinds(stuck, "rejected").at(-1)?.event;
  assert.ok(rejected?.kind === "rejected" && rejected.reason.includes("에너지 부족"));

  // AfterCardEnteredCombat: a card that enters later is afflicted too.
  const entered = runCombat({ ...input, script: [{ do: "addCard", card: "STRIKE_SILENT" }] }, catalog);
  const added = Object.values(entered.final.cards).find((card) => card.uid.startsWith("added-"));
  assert.equal(added?.affliction?.id, "WEIGHTED");

  // Without Grasp there is no Weighted and only the costs are paid.
  const plain = runCombat({ ...input, powers: {} }, catalog);
  assert.deepEqual(energyTrail(plain), ["3->2:cost"]);
  assert.equal(plain.final.energy, 2);

  // Deterministic: the same input gives the same steps and timeline.
  assert.deepEqual(runCombat(input, catalog), result);
  const timeline = buildTimeline(result, input);
  const again = buildTimeline(runCombat(input, catalog), input);
  assert.deepEqual([again.duration, again.actionEnds, again.beats], [timeline.duration, timeline.actionEnds, timeline.beats]);
  assert.ok(timeline.duration > 0);
  assert.equal(timeline.actionEnds.length, input.script!.length);
  assert.deepEqual(timeline.frameAt(timeline.duration).state, result.final);
  assert.deepEqual(timeline.frameAt(0).state, result.start);

  // Draw limit: the hand stops at 10.
  const full = runCombat({ ...input, powers: {}, hand: ["ACROBATICS", "STRIKE_SILENT*8"], drawPile: ["STRIKE_SILENT*5"], script: [{ do: "play", card: "ACROBATICS" }] }, catalog);
  assert.equal(kinds(full, "move").filter(({ event }) => event.kind === "move" && event.cause === "draw").length, 2);

  // Empty draw pile reshuffles the discard pile with the seed.
  const reshuffle = runCombat({ ...input, powers: {}, hand: ["ACROBATICS"], drawPile: [], discardPile: ["STRIKE_SILENT*2", "PREPARED"], seed: 7, script: [{ do: "play", card: "ACROBATICS" }] }, catalog);
  assert.equal(kinds(reshuffle, "shuffle").length, 1);
  assert.deepEqual(runCombat({ ...input, powers: {}, hand: ["ACROBATICS"], drawPile: [], discardPile: ["STRIKE_SILENT*2", "PREPARED"], seed: 7, script: [{ do: "play", card: "ACROBATICS" }] }, catalog), reshuffle);

  // Scene parts: the default depends on whether a character is given.
  assert.deepEqual(sceneParts(input), ["player", "cards"]);
  assert.deepEqual(sceneParts({ version: "0.104.0", encounter: "AXEBOTS_NORMAL" }), []);
  assert.deepEqual(sceneParts({ ...input, parts: ["player"] }), ["player"]);
  await assert.rejects(loadCombatSimCatalog({ version: "0.104.0", encounter: "AXEBOTS_NORMAL", parts: ["cards"] }), /character/);
  // Without the cards part, card piles are not loaded and card actions are skipped.
  const noCards = runCombat({ ...input, parts: ["player"] }, catalog);
  assert.deepEqual(noCards.final.piles.hand, []);
  assert.equal(noCards.final.energy, 0);
  assert.ok(noCards.warnings.some((warning) => warning.includes("cards 파트")));

  // --- Second candidate: Axebots 0.103.2 (two) -> 0.104.0 (one), encounter only --
  if (archiveDir("0.103.2") && archiveDir("0.104.0")) {
    const before = await loadCombatSimCatalog(COMBAT_SIM_PRESETS["axebots-0.103.2"]);
    const after = await loadCombatSimCatalog(COMBAT_SIM_PRESETS["axebots-0.104.0"]);
    assert.deepEqual(before.catalog.encounter.monsters, [{ monsterId: "AXEBOT", slot: "front" }, { monsterId: "AXEBOT", slot: "back" }]);
    assert.deepEqual(after.catalog.encounter.monsters, [{ monsterId: "AXEBOT", slot: "front" }]);
    // Encounter-only presets load no character, cards or affliction text.
    for (const load of [before, after]) {
      assert.equal(load.catalog.character, null);
      assert.deepEqual(load.catalog.cards, {});
      assert.deepEqual(load.catalog.afflictions, {});
      const run = runCombat(COMBAT_SIM_PRESETS[load === before ? "axebots-0.103.2" : "axebots-0.104.0"], load.catalog);
      assert.deepEqual(run.warnings, []);
      assert.equal(Object.keys(run.final.cards).length, 0);
    }
    // The same encounter with a character and cards still plays cards.
    const full = { version: "0.104.0", character: "SILENT", encounter: "AXEBOTS_NORMAL", hand: ["STRIKE_SILENT", "DEFEND_SILENT"], script: [{ do: "play" as const, card: "STRIKE_SILENT", target: 0 }, { do: "play" as const, card: "DEFEND_SILENT" }] };
    const fullLoad = await loadCombatSimCatalog(full);
    const strike = runCombat(full, fullLoad.catalog);
    const hit = kinds(strike, "damage")[0]?.event;
    assert.ok(hit?.kind === "damage" && hit.amount === 6 && hit.creature === "m0");
    assert.equal(strike.final.player.block, 5);
  } else {
    console.log("skip Axebots: build archive not found");
  }

  console.log("combat sim OK");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
