import assert from "node:assert/strict";
import { resolveMonsterStaticArt } from "../src/lib/monster-static-art";

const doormaker = (version?: string) => resolveMonsterStaticArt("DOORMAKER", version);
const img = (n: number) => `/images/sts2/monsters-beta/doormaker_placeholder_${n}.webp`;

// Doormaker: each move shows the still the previous move set (v0.101.0+ graph: open -> hunger -> scrutiny -> grasp).
assert.equal(doormaker("0.101.0")?.byMove.HUNGER, img(3));
assert.equal(doormaker("0.104.0")?.byMove.SCRUTINY, img(2));
assert.equal(doormaker("v0.104.0")?.byMove.GRASP, img(4));
assert.equal(doormaker("0.102.0")?.defaultImage, img(1), "rocks before the door opens");
// v0.100.0 had a different graph: open -> beam -> chomp -> pulverize.
assert.equal(doormaker("0.100.0")?.byMove.BEAM, img(2));
assert.equal(doormaker("0.100.0")?.byMove.CHOMP, img(3));
assert.equal(doormaker("0.100.0")?.byMove.PULVERIZE, img(4));
// v0.98.0-v0.99.1: the scene starts on placeholder 4.
assert.equal(doormaker("0.99.1")?.byMove.WHAT_IS_IT, img(4));
// The removed boss keeps its latest look for the current / unversioned page.
assert.equal(doormaker()?.byMove.HUNGER, img(3));
assert.equal(doormaker("0.111.0")?.byMove.HUNGER, img(3));

// Skulking Colony only got its Spine animation in v0.104.0.
for (const v of ["0.98.0", "0.100.0", "0.103.2"]) {
  assert.ok(resolveMonsterStaticArt("SKULKING_COLONY", v), `still art in v${v}`);
}
for (const v of ["0.104.0", "0.105.1", "0.111.0", undefined]) {
  assert.equal(resolveMonsterStaticArt("SKULKING_COLONY", v), null, `Spine in v${v ?? "current"}`);
}
assert.equal(resolveMonsterStaticArt("NIBBIT", "0.100.0"), null);
console.log("monster static art OK");
