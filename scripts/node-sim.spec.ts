/** Engine-only self-check for /dev/node-sim (no DOM): pnpm test:node-sim */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BLITZ_ENTRY_TYPES,
  blitzMerchantStateAt,
  drawStock,
  isCursed,
  runBlitzMerchant,
  type BlitzMerchantData,
} from "../src/lib/node-sim/blitz-merchant";
import { formatLoc } from "../src/lib/node-sim/loc-format";
import { NODE_SIM_PRESETS, parseNodeSimQuery } from "../src/lib/node-sim/scenarios";

const data = JSON.parse(readFileSync(path.join(process.cwd(), "data/sts2/blitz-merchant.json"), "utf8")) as BlitzMerchantData & {
  layout: { inventory: { rug: { left: number; openY: number; closedY: number }; slots: [number, number][]; hand: { position: number[] } } };
};
const inv = data.layout.inventory;
const layout = {
  rugX: 960 + inv.rug.left,
  rugOpenY: inv.rug.openY,
  rugClosedY: inv.rug.closedY,
  backstopAlpha: 0.8,
  slots: inv.slots,
  handStart: [inv.hand.position[0], inv.hand.position[1]] as [number, number],
  handOffset: [-48, 0] as [number, number],
  inventoryWidth: 1920,
};

// SmartFormat subset: Korean takes the first plural word, English picks by count.
assert.equal(formatLoc("{Enchantment}{Amount:plural:(을)를|(을)를 {}}", { Enchantment: "예리", Amount: 2 }, "kor"), "예리(을)를");
assert.equal(formatLoc("with {Enchantment}{Amount:plural:| {}}.", { Enchantment: "Sharp", Amount: 2 }, "eng"), "with Sharp 2.");
assert.equal(formatLoc("{Times:choose(1):1번|[blue]{}[/blue]번}", { Times: 1 }, "kor"), "1번");
assert.equal(formatLoc("{Amount:plural(ru):| {} раза|{} раз}", { Amount: 2 }, "eng"), " 2 раза");
assert.equal(formatLoc("{Amount:plural(ru):| {} раза|{} раз}", { Amount: 5 }, "eng"), "5 раз");
assert.equal(formatLoc("{Amount:plural(ru):| {} раза|{} раз}", { Amount: 1 }, "eng"), "");

// GetBlitzEntries: five distinct non-cursed entries, then one cursed, for any seed.
for (let seed = 0; seed < 200; seed += 1) {
  const stock = drawStock(seed);
  assert.equal(stock.length, 6);
  assert.equal(new Set(stock).size, 6);
  assert.ok(stock.slice(0, 5).every((type) => !isCursed(type)) && isCursed(stock[5]), `seed ${seed}: ${stock}`);
}

// Every entry type has a preset whose stock holds it, hovers it and shows its game tooltip text.
for (const type of BLITZ_ENTRY_TYPES) {
  const name = `blitz-merchant-${type.replace(/(?<!^)(?=[A-Z])/g, "_").toLowerCase()}`;
  const input = NODE_SIM_PRESETS[name];
  assert.ok(input, `preset ${name}`);
  for (const locale of ["kor", "eng"] as const) {
    const result = runBlitzMerchant({ ...input, locale }, data);
    const slot = result.stock.findIndex((entry) => entry.type === type);
    assert.ok(slot >= 0, `${name}: stock holds ${type}`);
    assert.ok(result.beats.every((beat) => !beat.rejected), `${name}: ${result.warnings.join("; ")}`);
    const tips = result.stock[slot].tips;
    assert.ok(tips[0].title && tips[0].description && !/[{}]/.test(tips[0].title + tips[0].description), `${name} ${locale}: ${JSON.stringify(tips[0])}`);
    assert.equal(result.stock[slot].tipAlign, slot % 3 === 2 ? "left" : "right");
    const end = blitzMerchantStateAt(result, layout, result.duration);
    assert.equal(end.hovered, slot);
    assert.equal(end.slots[slot].scale, 1.1);
    assert.equal(end.rugY, inv.rug.openY);
  }
}

// Enchant entries carry the enchantment's own tip (and its extra tip), as HoverTipFactory.FromEnchantment does.
const enchant = runBlitzMerchant({ ...NODE_SIM_PRESETS["blitz-merchant-card_enchant"], enchant: "STEADY" }, data);
const steady = enchant.stock.find((entry) => entry.type === "CardEnchant")!;
assert.deepEqual(steady.tips.map((tip) => tip.title), ["안정", "안정", "보존"]);
assert.equal(steady.tips[0].description, "카드 1장에 [purple]안정(을)를[/purple] [gold]인챈트[/gold]합니다.");
const glam = runBlitzMerchant({ ...NODE_SIM_PRESETS["blitz-merchant-glam"], locale: "eng" }, data).stock.find((entry) => entry.type === "Glam")!;
assert.deepEqual(glam.tips.map((tip) => tip.title), ["Cursed Glam", "Glam", "Replay"]);
assert.equal(glam.tips[2].description, "Plays this card an additional time.");

// Buying: three choices, then the rest are disabled; Cursed Choices adds two.
const buy = (entries: string[]) => {
  const input = { ...NODE_SIM_PRESETS["blitz-merchant-browse"], startOpen: true, script: entries.map((entry) => ({ do: "buy" as const, entry })) };
  const result = runBlitzMerchant(input, data);
  return { result, state: blitzMerchantStateAt(result, layout, result.duration) };
};
const three = buy(["1", "2", "3"]);
assert.deepEqual(three.state.slots.map((slot) => slot.status), ["used", "used", "used", "disabled", "disabled", "disabled"]);
assert.equal(three.result.selectionText(three.state.remaining), "[red]더 이상 아이템을 선택할 수 없습니다.[/red]");
assert.equal(three.result.selectionText(3), "[blue]3[/blue]개의 아이템을 더 선택할 수 있습니다.");
const twoMore = runBlitzMerchant({
  ...NODE_SIM_PRESETS["blitz-merchant-browse"],
  entries: ["CardUpgrade", "Relic", "Potions", "CardRemoval", "CardRewards", "TwoMoreChoices"],
  startOpen: true,
  script: ["6", "1", "2", "3"].map((entry) => ({ do: "buy" as const, entry })),
}, data);
assert.equal(blitzMerchantStateAt(twoMore, layout, twoMore.duration).remaining, 1);
const twice = buy(["1", "1"]).result;
assert.equal(twice.beats[1].rejected, `${twice.stock[0].type} is used (its hitbox ignores the mouse)`);

// Open tween: the step is 1 s; the rug lands at y 80 after 0.7 s.
const open = runBlitzMerchant(NODE_SIM_PRESETS["blitz-merchant-browse"], data);
const openBeat = open.beats.find((beat) => beat.action.do === "open")!;
assert.equal(openBeat.end - openBeat.start, 1000);
assert.equal(blitzMerchantStateAt(open, layout, openBeat.start + 700).rugY, 80);
assert.equal(blitzMerchantStateAt(open, layout, openBeat.start).rugY, -1000);

// Same input, same state (the capture seeks frames out of order).
const a = blitzMerchantStateAt(open, layout, 4321);
blitzMerchantStateAt(open, layout, 900);
assert.deepEqual(blitzMerchantStateAt(open, layout, 4321), a);

// Query form.
const query = parseNodeSimQuery({ node: "blitz_merchant", entry: "two_relics", locale: "eng", script: "wait:100,open,hover:TwoRelics,buy:TwoRelics" });
assert.deepEqual(query.errors, []);
assert.equal(query.input.include, "TwoRelics");
assert.deepEqual(query.input.script.map((action) => action.do), ["wait", "open", "hover", "buy"]);
assert.match(parseNodeSimQuery({ node: "rest_site" }).errors.join(), /not simulated/);

console.log("node-sim spec: ok");
