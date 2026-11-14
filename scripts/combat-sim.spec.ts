import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { archiveDir, archiveRoot, idToPascal, loadCombatSimCatalog } from "../src/lib/combat-sim/catalog";
import { evaluateExpression, parseNumericProperties } from "../src/lib/combat-sim/csharp-values";
import { DOMINION_RULES } from "../src/lib/combat-sim/dread";
import { modifiedBlock, modifiedDamage } from "../src/lib/combat-sim/modifiers";
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

  // OnPlayWrapper order (await numbering): the card's own OnPlay (draw, discard) runs
  // first, then the affliction's OnPlay (Weighted), then the card goes to its result pile.
  const firstPlay = result.steps.filter(({ action }) => action === 1).map(({ event }) => event);
  const at = (test: (event: SimEvent) => boolean) => firstPlay.findIndex(test);
  const lastDraw = firstPlay.map((event, i) => (event.kind === "move" && event.cause === "draw" ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const discardAt = at((event) => event.kind === "move" && event.cause === "discard");
  const weightedAt = at((event) => event.kind === "afflictionTrigger");
  const resultAt = at((event) => event.kind === "move" && event.cause === "result");
  assert.ok(lastDraw < discardAt && discardAt < weightedAt && weightedAt < resultAt, "draw -> discard -> Weighted -> result pile");
  // Skills trigger no animation; the play's wait counts from the move to the play pile.
  assert.ok(!firstPlay.some((event) => event.kind === "animate"));

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

  // Speed (settings FastMode): timing only. Same events and state; Normal > Fast > Instant.
  const bySpeed = (["normal", "fast", "instant"] as const).map((speed) => {
    const speedInput = { ...input, speed };
    const run = runCombat(speedInput, catalog);
    return { speed, run, timeline: buildTimeline(run, speedInput) };
  });
  const [normal, fast, instant] = bySpeed;
  for (const { run } of bySpeed) {
    assert.deepEqual(run.final, normal.run.final);
    assert.deepEqual(run.steps.map((step) => step.event), normal.run.steps.map((step) => step.event));
  }
  assert.equal(instant.run.final.energy, 0);
  assert.deepEqual(ids(instant.run.final, "hand"), ["STRIKE_SILENT", "STRIKE_SILENT"]);
  assert.ok(normal.timeline.duration > fast.timeline.duration && fast.timeline.duration > instant.timeline.duration);
  // Every play action ends earlier at higher speed; script waits do not scale.
  for (const index of [1, 2, 3]) {
    assert.ok(normal.timeline.actionEnds[index] > fast.timeline.actionEnds[index], `action ${index}: normal > fast`);
    assert.ok(fast.timeline.actionEnds[index] > instant.timeline.actionEnds[index], `action ${index}: fast > instant`);
  }
  assert.equal(normal.timeline.actionEnds[0], instant.timeline.actionEnds[0], "script wait is not a game wait");
  // Game time = everything but script waits and the simulator's hover stand-in (player input).
  const gameTime = ({ timeline }: (typeof bySpeed)[number]) =>
    timeline.beats.filter((beat) => beat.event.kind !== "wait" && beat.event.kind !== "select").reduce((sum, beat) => sum + beat.duration, 0);
  assert.ok(gameTime(normal) > gameTime(fast) && gameTime(fast) > gameTime(instant));
  assert.ok(gameTime(instant) < 200, `instant game time ${gameTime(instant)} ms`);

  // Draw limit: the hand stops at 10.
  const full = runCombat({ ...input, powers: {}, hand: ["ACROBATICS", "STRIKE_SILENT*8"], drawPile: ["STRIKE_SILENT*5"], script: [{ do: "play", card: "ACROBATICS" }] }, catalog);
  assert.equal(kinds(full, "move").filter(({ event }) => event.kind === "move" && event.cause === "draw").length, 2);

  // Neutralize.cs: WithAttackerAnim("Attack", AttackAnimDelay + 0.2 s only when FastMode is Normal).
  const neutralizeInput = { ...input, powers: {}, hand: ["NEUTRALIZE"], drawPile: [], script: [{ do: "play" as const, card: "NEUTRALIZE", target: 0 }] };
  const neutralizeLoad = await loadCombatSimCatalog(neutralizeInput);
  const neutralize = runCombat(neutralizeInput, neutralizeLoad.catalog);
  const attackDelay = neutralizeLoad.catalog.character!.attackAnimDelay * 1000;
  const attackWait = (speed: "normal" | "fast" | "instant") =>
    buildTimeline(neutralize, { ...neutralizeInput, speed }).beats.find((beat) => beat.event.kind === "animate")!.duration;
  assert.ok(attackDelay > 0);
  assert.ok(Math.abs(attackWait("normal") - (attackDelay + 200)) < 1e-6);
  assert.ok(Math.abs(attackWait("fast") - Math.min(attackDelay * 0.5, 250)) < 1e-6);
  assert.equal(attackWait("instant"), 0);

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

  // --- monsters= and monsterHp=, card presentation, monster death (0.113.0 source) --------------
  if (archiveDir("0.113.0")) {
    const monsterQuery = parseCombatSimQuery({
      version: "0.113.0",
      character: "REGENT",
      monsters: "ASSASSIN_RUBY_RAIDER,BYRDONIS,TRACKER_RUBY_RAIDER",
      monsterHp: "BYRDONIS=20",
      hand: "COMET",
      script: "play:COMET@1",
      layout: "shorts",
      hp: "0",
    });
    assert.deepEqual(monsterQuery.errors, []);
    assert.equal(monsterQuery.input?.encounter, undefined);
    assert.equal(monsterQuery.input?.hp, undefined, "hp=0 hides the bars, it is not the player's HP");
    assert.deepEqual(
      { ...monsterQuery.options, t: null },
      { t: null, autoplay: false, frame: 360, badges: false, hpBars: false, intents: false, ui: "card", bgHeight: 1050, feetY: 840, crop: 1050, layer: "all" },
    );

    const comet = await loadCombatSimCatalog(monsterQuery.input!);
    assert.deepEqual(comet.catalog.encounter.monsters.map((entry) => entry.monsterId), ["ASSASSIN_RUBY_RAIDER", "BYRDONIS", "TRACKER_RUBY_RAIDER"]);
    assert.ok(comet.catalog.encounter.monsters.every((entry) => entry.slot === null));
    const run = runCombat(monsterQuery.input!, comet.catalog);
    assert.equal(run.start.monsters[1].hp, 20);
    // Comet has no hand-written recipe: its OnPlay presentation plays (Cast, the missile, a wait, 33 damage).
    const playEvents = run.steps.filter((step) => step.action === 0).map((step) => step.event);
    const cast = playEvents.find((event) => event.kind === "animate");
    assert.ok(cast?.kind === "animate" && cast.animation === "cast" && cast.delayMs === comet.catalog.character!.castAnimDelay * 1000 && cast.delayMs > 0);
    const missile = playEvents.find((event) => event.kind === "vfx");
    assert.ok(missile?.kind === "vfx" && missile.effect === "NSmallMagicMissileVfx" && missile.target === "m1" && missile.color === "50b598" && missile.at === "bottom");
    const damage = playEvents.find((event) => event.kind === "damage");
    assert.ok(damage?.kind === "damage" && damage.amount === 33 && damage.hpFrom === 20 && damage.hpTo === 0);
    // A killing blow starts the death animation, not the hit animation.
    const animations = playEvents.flatMap((event) => (event.kind === "animate" ? [event.animation] : []));
    assert.deepEqual(animations, ["cast", "die"]);
    assert.ok(playEvents.some((event) => event.kind === "unimplemented" && event.what.includes("PowerCmd.Apply")));
    // The missile's own wait is Cmd.Wait(0.2): not scaled by Fast, skipped on Instant.
    const missileWait = (speed: "normal" | "fast" | "instant") =>
      buildTimeline(run, { ...monsterQuery.input!, speed }).beats.find((beat) => beat.event.kind === "pause" && beat.event.reason === "NSmallMagicMissileVfx")!.duration;
    assert.deepEqual([missileWait("normal"), missileWait("fast"), missileWait("instant")], [200, 200, 0]);

    // A hit VFX scene comes from WithHitFx; a recipe card (Strike) plays it too, before its damage.
    const slash = { version: "0.113.0", character: "SILENT", monsters: ["BYRDONIS"], hand: ["STRIKE_SILENT"], script: [{ do: "play" as const, card: "STRIKE_SILENT", target: 0 }] };
    const slashLoad = await loadCombatSimCatalog(slash);
    const slashEvents = runCombat(slash, slashLoad.catalog).steps.map((step) => step.event.kind);
    assert.ok(slashEvents.indexOf("vfx") > 0 && slashEvents.indexOf("vfx") < slashEvents.indexOf("damage"));
    // A monster not in the given scene's encounter, and a missing background encounter, both resolve.
    await assert.rejects(loadCombatSimCatalog({ version: "0.113.0", monsters: ["NO_SUCH_MONSTER"] }), /배경으로 쓸 조우/);

    // --- ascension, Dread, composition, start powers, branch states, turn-end powers ------------------
    const q = parseCombatSimQuery({ version: "0.113.0", encounter: "BOWLBUGS_WEAK", ascension: "9", dread: "1", dominion: "kaiser_crab", composition: "1", startPowers: "0", script: "end_turn,monsters" });
    assert.deepEqual(q.errors, []);
    assert.deepEqual(
      { ascension: q.input?.ascension, dread: q.input?.dread, dominion: q.input?.dominion, composition: q.input?.composition, startPowers: q.input?.startPowers, script: q.input?.script },
      { ascension: 9, dread: true, dominion: "KAISER_CRAB", composition: 1, startPowers: false, script: [{ do: "endTurn" }, { do: "monsterTurn" }] },
    );
    assert.ok(parseCombatSimQuery({ version: "0.113.0", encounter: "BOWLBUGS_WEAK", ascension: "11" }).errors.length > 0, "ascension above 10 is refused");

    // Composition: the archived source builds a random Egg or Nectar there (not spelled as a tuple), so the site's compositions are used.
    const bowl = async (extra: object) => loadCombatSimCatalog({ version: "0.113.0", encounter: "BOWLBUGS_WEAK", ...extra });
    assert.deepEqual((await bowl({})).catalog.encounter.monsters.map((entry) => entry.monsterId), ["BOWLBUG_ROCK", "BOWLBUG_EGG"]);
    const second = (await bowl({ composition: 1 })).catalog.encounter;
    assert.deepEqual([second.monsters.map((entry) => entry.monsterId), second.composition, second.compositionCount], [["BOWLBUG_ROCK", "BOWLBUG_NECTAR"], 1, 2]);
    await assert.rejects(bowl({ composition: 2 }), /composition 2/);

    // The first move of a branch state resolves to a real move (Exoskeletons pick by slot name).
    const exoskeletons = await loadCombatSimCatalog({ version: "0.113.0", encounter: "EXOSKELETONS_NORMAL" });
    const exoRun = runCombat({ version: "0.113.0", encounter: "EXOSKELETONS_NORMAL" }, exoskeletons.catalog);
    assert.deepEqual(exoRun.start.monsters.slice(0, 3).map((monster) => monster.moveId), ["SKITTER", "MANDIBLES", "ENRAGE"]);
    assert.ok(exoRun.start.monsters.every((monster) => monster.moveId && exoskeletons.catalog.monsters.EXOSKELETON.moves[monster.moveId]));
    assert.deepEqual(exoRun.start.monsters[0].powers, [{ id: "HARD_TO_KILL", amount: 9 }], "AfterAddedToRoom powers are applied without powers=");

    // Ascension: HP range at 8 (ToughEnemies), damage at 9 (DeadlyEnemies); the HP roll is fixed by the seed.
    const tunneler = async (extra: object) => loadCombatSimCatalog({ version: "0.113.0", encounter: "TUNNELER_WEAK", ...extra });
    const [a0, a8, a9] = (await Promise.all([0, 8, 9].map((ascension) => tunneler({ ascension })))).map((load) => load.catalog.monsters.TUNNELER);
    assert.ok(a8.hp > a0.hp && a9.hp === a8.hp, "tough HP from level 8");
    assert.ok(a9.moves.BITE.intents[0].damage! > a8.moves.BITE.intents[0].damage!, "deadly damage from level 9");
    assert.equal(a8.moves.BITE.intents[0].damage, a0.moves.BITE.intents[0].damage);
    const rolled = async (seed: number) => runCombat({ version: "0.113.0", encounter: "BOWLBUGS_NORMAL", seed }, (await loadCombatSimCatalog({ version: "0.113.0", encounter: "BOWLBUGS_NORMAL", seed })).catalog).start.monsters.map((monster) => monster.hp);
    assert.deepEqual(await rolled(3), await rolled(3));
    const hpOf = (monster: { hp: number; maxHp: number }) => monster.hp === monster.maxHp;
    assert.ok((runCombat({ version: "0.113.0", encounter: "BOWLBUGS_NORMAL" }, (await loadCombatSimCatalog({ version: "0.113.0", encounter: "BOWLBUGS_NORMAL" })).catalog).start.monsters).every(hpOf), "max HP is the roll");

    // Start powers off: only `powers`.
    const plain = await loadCombatSimCatalog({ version: "0.113.0", encounter: "AEONGLASS_BOSS" });
    assert.deepEqual(runCombat({ version: "0.113.0", encounter: "AEONGLASS_BOSS" }, plain.catalog).start.monsters[0].powers.map((power) => power.id).sort(), ["ARTIFACT", "WITHERING_PRESENCE"]);
    assert.deepEqual(runCombat({ version: "0.113.0", encounter: "AEONGLASS_BOSS", startPowers: false }, (await loadCombatSimCatalog({ version: "0.113.0", encounter: "AEONGLASS_BOSS", startPowers: false })).catalog).start.monsters[0].powers, []);

    // Dread: a boss reads IsDread() values (HP from FirstFormHp, Enrage +1) and has no dominion; other rooms get the act's.
    const dreadBoss = { version: "0.113.0", encounter: "TEST_SUBJECT_BOSS", dread: true, ascension: 10 };
    const dreadBossRun = runCombat(dreadBoss, (await loadCombatSimCatalog(dreadBoss)).catalog);
    const normalBossRun = runCombat({ ...dreadBoss, dread: false }, (await loadCombatSimCatalog({ ...dreadBoss, dread: false })).catalog);
    assert.equal(dreadBossRun.start.monsters[0].hp, 111);
    assert.equal(dreadBossRun.start.monsters[0].powers.find((power) => power.id === "ENRAGE")?.amount, (normalBossRun.start.monsters[0].powers.find((power) => power.id === "ENRAGE")?.amount ?? 0) + 1);
    assert.equal((await loadCombatSimCatalog(dreadBoss)).catalog.dominion, null);
    assert.equal((await tunneler({ dread: true, dominion: "KAISER_CRAB" })).catalog.dominion?.id, "KAISER_CRAB");
    await assert.rejects(tunneler({ dread: true, dominion: "NO_SUCH_BOSS" }), /알 수 없는 dominion/);
    // Waterfall Giant: GetExplosiveAmount(encounter): 3 for several monsters, 4 weak, 5, 7 elite.
    const explosive = async (encounter: string) => (await loadCombatSimCatalog({ version: "0.113.0", encounter, dread: true, dominion: "WATERFALL_GIANT" })).catalog.dominion?.enemies[0].amount;
    assert.deepEqual([await explosive("BOWLBUGS_NORMAL"), await explosive("TUNNELER_WEAK")], [3, 4]);
    // Each dominion rule names the powers the archived class applies.
    for (const rule of DOMINION_RULES) {
      const file = path.join(archiveRoot(), "0.113.0", "src/MegaCrit.Sts2.Core.Models.Dread.Dominions", `${idToPascal(rule.id)}Dominion.cs`);
      const source = readFileSync(file, "utf8");
      const facts = { id: "X", roomType: "Monster", isWeak: false, monsterCount: 1 };
      for (const power of [...(rule.player ?? []), ...(rule.enemies?.(facts) ?? [])]) {
        assert.ok(source.includes(`Apply<${idToPascal(power.powerId)}>`), `${rule.id}: ${power.powerId}`);
      }
      for (const card of [...(rule.drawPileCards ?? []), ...(rule.chooseScreen ?? [])]) assert.ok(source.includes(`<${idToPascal(card)}>`), `${rule.id}: ${card}`);
    }

    // Powers change the intent number and the hit: Strength 3 from Test Subject's dominion.
    const strong = { version: "0.113.0", encounter: "TUNNELER_WEAK", character: "SILENT", parts: ["player" as const], dread: true, dominion: "TEST_SUBJECT", script: [{ do: "monsterTurn" as const }] };
    const strongLoad = await loadCombatSimCatalog(strong);
    const strongRun = runCombat(strong, strongLoad.catalog);
    const biteDamage = strongLoad.catalog.monsters.TUNNELER.moves.BITE.intents[0].damage!;
    assert.equal(strongRun.start.monsters[0].powers.find((power) => power.id === "STRENGTH_POWER")?.amount, 3);
    assert.equal(kinds(strongRun, "damage").map((step) => (step.event.kind === "damage" ? step.event.amount : 0))[0], biteDamage + 3);
    assert.equal(modifiedDamage(10, [{ id: "STRENGTH_POWER", amount: 3 }], []), 13);
    assert.equal(modifiedDamage(10, [{ id: "WEAK_POWER", amount: 1 }], [{ id: "VULNERABLE_POWER", amount: 1 }]), 11);
    assert.equal(modifiedBlock(5, [{ id: "DEXTERITY_POWER", amount: -1 }, { id: "FRAIL_POWER", amount: 1 }]), 3);

    // Turn-end powers: Plating (block now, block again and 1 less each round), Lagavulin's dominion (-1 Strength, Dexterity, gone).
    const plating = { version: "0.113.0", encounter: "TUNNELER_WEAK", character: "SILENT", parts: ["player" as const], dread: true, dominion: "KAISER_CRAB", script: [{ do: "endTurn" as const }, { do: "monsterTurn" as const }, { do: "startTurn" as const }, { do: "endTurn" as const }, { do: "monsterTurn" as const }] };
    const platingRun = runCombat(plating, (await loadCombatSimCatalog(plating)).catalog);
    assert.equal(platingRun.start.monsters[0].block, 7, "round 1 starts with the block");
    assert.deepEqual(platingRun.final.monsters[0].powers.find((power) => power.id === "PLATING_POWER"), { id: "PLATING_POWER", amount: 6 });
    assert.equal(platingRun.final.monsters[0].block, 6);
    const lagavulin = { ...plating, dominion: "LAGAVULIN_MATRIARCH", script: [{ do: "endTurn" as const }] };
    const lagavulinRun = runCombat(lagavulin, (await loadCombatSimCatalog(lagavulin)).catalog);
    assert.deepEqual(lagavulinRun.final.player.powers.map((power) => `${power.id}:${power.amount}`).sort(), ["DEXTERITY_POWER:-1", "STRENGTH_POWER:-1"]);

    // Dominion cards and the choose screen.
    const knowledge = { version: "0.113.0", encounter: "TUNNELER_WEAK", character: "SILENT", dread: true, dominion: "KNOWLEDGE_DEMON", hand: ["STRIKE_SILENT"], script: [{ do: "wait" as const, ms: 50 }] };
    const knowledgeLoad = await loadCombatSimCatalog(knowledge);
    const knowledgeRun = runCombat(knowledge, knowledgeLoad.catalog);
    assert.ok(knowledgeRun.steps.some((step) => step.event.kind === "choose" && step.event.cards.join() === "SLOTH,AMNESIA"));
    assert.equal(buildTimeline(knowledgeRun, knowledge).beats.find((beat) => beat.event.kind === "choose")?.duration, 2000);
    const beckon = { version: "0.113.0", encounter: "TUNNELER_WEAK", character: "SILENT", dread: true, dominion: "SOUL_FYSH", drawPile: ["STRIKE_SILENT*3"] };
    const beckonRun = runCombat(beckon, (await loadCombatSimCatalog(beckon)).catalog);
    assert.equal(beckonRun.start.piles.draw.length, 4);
    assert.ok(beckonRun.start.piles.draw.some((uid) => beckonRun.start.cards[uid].id === "BECKON"));

    // The C# expression reader behind the Dread values.
    const props = parseNumericProperties("public int FirstFormHp => AscensionHelper.GetValueIfAscension(AscensionLevel.ToughEnemies, 111, 100);\nprivate int Count\n{\n get\n {\n if (!AscensionHelper.IsDread())\n {\n return 3;\n }\n return 4;\n }\n}");
    assert.equal(evaluateExpression(props.FirstFormHp, props, { ascension: 8, dread: false }), 111);
    assert.equal(evaluateExpression(props.FirstFormHp, props, { ascension: 7, dread: false }), 100);
    assert.deepEqual([false, true].map((dread) => evaluateExpression(props.Count, props, { ascension: 0, dread })), [3, 4]);
    assert.equal(evaluateExpression("_respawns + 1", props, { ascension: 0, dread: false }), null, "state fields are not read");
  } else {
    console.log("skip monsters=, presentation, ascension, dread: 0.113.0 build archive not found");
  }

  console.log("combat sim OK");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
