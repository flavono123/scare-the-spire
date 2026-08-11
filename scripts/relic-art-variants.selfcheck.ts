import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../data/sts2/relic-art-variants.json";
import {
  composeRelicDetailFilters,
  relicArtFilterCss,
  resolveRelicArtFilterMode,
} from "../src/lib/relic-art-filters";
import { getRelicArtVariants } from "../src/lib/relic-art-variants-catalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engRelics = JSON.parse(
  readFileSync(join(root, "data/sts2/eng/relics.json"), "utf8"),
) as Array<{ id: string; rarity: string }>;

assert.equal(catalog.waxEligibleIds.length, 120);
assert.equal(catalog.usedUpIds.length, 10);
assert.equal(catalog.disabledIds.length, 3);

const wax = new Set(catalog.waxEligibleIds);
const usedUp = new Set(catalog.usedUpIds);
const disabled = new Set(catalog.disabledIds);
for (const id of usedUp) assert.equal(disabled.has(id), false);

const byId = new Map(engRelics.map((r) => [r.id, r]));
for (const id of [...wax, ...usedUp, ...disabled]) assert.ok(byId.has(id));

const waxRarities = new Set(["Common Relic", "Uncommon Relic", "Rare Relic"]);
assert.deepEqual(
  [...wax].sort(),
  engRelics.filter((r) => waxRarities.has(r.rarity)).map((r) => r.id).sort(),
);

// CSS-only filters (no SVG url(#...) — that path was a no-op on detail <img>).
const melted = relicArtFilterCss("melted");
assert.equal(melted, "grayscale(1) brightness(0.22)");
assert.equal(melted.includes("url("), false);
assert.equal(melted.includes("saturate"), false);

const composedMelted = composeRelicDetailFilters("melted", "drop-shadow(0 4px 8px rgba(0,0,0,0.65))");
assert.ok(composedMelted?.startsWith("grayscale(1) brightness(0.22)"));
assert.equal(composedMelted?.includes("248"), false);

const waxFilter = relicArtFilterCss("wax");
assert.ok(waxFilter);
assert.equal(waxFilter.includes("url("), false);

const composed = composeRelicDetailFilters("melted", "drop-shadow(0 4px 8px rgba(0,0,0,0.5))");
assert.ok(composed?.startsWith("grayscale"));
assert.ok(composed?.includes("drop-shadow"));

assert.ok(getRelicArtVariants("RUINED_HELMET").wax);
assert.ok(getRelicArtVariants("TEA_OF_DISCOURTESY").usedUp);

const filterSrc = readFileSync(join(root, "src/lib/relic-art-filters.ts"), "utf8");
assert.doesNotMatch(filterSrc, /feColorMatrix|ensureRelicArtFilters|createElementNS/);

assert.equal(
  resolveRelicArtFilterMode({ betaOverrides: false, source: "wax", waxCycle: "wax", statusOn: true }),
  "wax",
);
assert.equal(
  resolveRelicArtFilterMode({ betaOverrides: false, source: "status", waxCycle: "melted", statusOn: true }),
  "gray",
);
assert.equal(
  resolveRelicArtFilterMode({ betaOverrides: false, source: "wax", waxCycle: "off", statusOn: true }),
  "gray",
);

console.log("relic-art-variants.selfcheck: ok");

