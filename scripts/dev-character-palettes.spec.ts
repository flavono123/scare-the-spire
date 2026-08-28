import assert from "node:assert/strict";
import {
  CHARACTER_PALETTE_PAIRS,
  CHARACTER_PALETTE_SOURCE,
  hexToRgb01,
  normalizeHex,
  resolveDuotoneColors,
  swapHexPair,
} from "../src/lib/dev-character-palettes";

assert.equal(CHARACTER_PALETTE_PAIRS.length, 16);
assert.equal(CHARACTER_PALETTE_SOURCE.url, "https://youtu.be/23kxFVxYZIY");

const ids = CHARACTER_PALETTE_PAIRS.map((pair) => pair.id);
assert.equal(new Set(ids).size, ids.length);

for (const pair of CHARACTER_PALETTE_PAIRS) {
  assert.equal(normalizeHex(pair.colorA), pair.colorA);
  assert.equal(normalizeHex(pair.colorB), pair.colorB);
  assert.notEqual(pair.colorA, pair.colorB);
  assert.ok(pair.nameKoA);
  assert.ok(pair.nameKoB);
}

assert.equal(normalizeHex("#abc"), "#AABBCC");
assert.equal(normalizeHex("719470"), "#719470");
assert.equal(normalizeHex("  #e0b3b6  "), "#E0B3B6");
assert.equal(normalizeHex("nope"), null);

const rgb = hexToRgb01("#FFFFFF");
assert.equal(rgb.r, 1);
assert.equal(rgb.g, 1);
assert.equal(rgb.b, 1);

const mapped = resolveDuotoneColors("#111111", "#EEEEEE", false);
assert.deepEqual(mapped, { shadow: "#111111", highlight: "#EEEEEE" });
assert.deepEqual(resolveDuotoneColors("#111111", "#EEEEEE", true), {
  shadow: "#EEEEEE",
  highlight: "#111111",
});

assert.deepEqual(swapHexPair("#111111", "#EEEEEE"), {
  colorA: "#EEEEEE",
  colorB: "#111111",
});

const sage = CHARACTER_PALETTE_PAIRS[0];
assert.equal(sage.colorA, "#719470");
assert.equal(sage.colorB, "#E0B3B6");

const coral = CHARACTER_PALETTE_PAIRS[15];
assert.equal(coral.colorA, "#F48067");
assert.equal(coral.colorB, "#051230");

console.log("dev-character-palettes.spec.ts: ok");
