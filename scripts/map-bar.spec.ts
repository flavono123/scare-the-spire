import assert from "node:assert/strict";
import { buildMapBarLayout, buildMapBarTimeline, cssEase, defaultReach, nodeArt, validateMapBarInput } from "../src/lib/map-bar/engine";
import { MAP_BAR_PRESETS } from "../src/lib/map-bar/scenarios";
import type { MapBarInput, MapBarOutcome } from "../src/lib/map-bar/types";
import { parseMapBarQuery } from "../src/app/(main)/dev/map-bar/query-input";

const preset = MAP_BAR_PRESETS["untouchable-history"];
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// --- Outcome -> icon (R4, R5): the engine maps, it does not judge.
const icons: Record<MapBarOutcome, string> = {
  monster: "map_unknown_monster",
  elite: "map_unknown_elite",
  shop: "map_unknown_shop",
  chest: "map_unknown_chest",
  event: "map_unknown",
  unknown: "map_unknown",
  rest: "map_rest",
};
for (const [outcome, icon] of Object.entries(icons)) {
  const art = nodeArt({ type: "unknown", outcome: outcome as MapBarOutcome }, true, "neow");
  assert.deepEqual(art.kind === "room" && art.icon, icon, outcome);
  const before = nodeArt({ type: "unknown", outcome: outcome as MapBarOutcome }, false, "neow");
  assert.deepEqual(before.kind === "room" && before.icon, "map_unknown");
}
assert.deepEqual(nodeArt({ type: "chest" }, false, "neow"), { kind: "room", icon: "map_chest", outline: "map_chest_outline" });
assert.deepEqual(nodeArt({ type: "rest" }, false, "neow"), { kind: "room", icon: "map_rest", outline: "map_rest_outline" });
assert.deepEqual(nodeArt({ type: "ancient" }, false, "orobas"), { kind: "ancient", key: "orobas" });

// --- Reach (R3): a trailing "?" without an outcome stays ahead of the marker.
assert.equal(defaultReach(preset.nodes), 3);
assert.equal(defaultReach([{ type: "ancient" }, { type: "monster" }, { type: "unknown" }, { type: "shop" }]), 3);
assert.equal(defaultReach([{ type: "ancient" }, { type: "unknown" }]), 0);

// --- Orientation (R2): horizontal runs left to right, vertical bottom to top; only the dots turn.
const horizontal = buildMapBarLayout({ ...preset, orientation: "horizontal" });
const vertical = buildMapBarLayout({ ...preset, orientation: "vertical" });
for (let i = 1; i < preset.nodes.length; i += 1) {
  assert.ok(horizontal.nodes[i].x > horizontal.nodes[i - 1].x);
  close(horizontal.nodes[i].y, horizontal.nodes[0].y);
  assert.ok(vertical.nodes[i].y < vertical.nodes[i - 1].y);
  close(vertical.nodes[i].x, vertical.nodes[0].x);
}
for (const tick of horizontal.edges.flat()) assert.ok(Math.abs(tick.rotation - Math.PI / 2) <= 0.1 + 1e-9);
for (const tick of vertical.edges.flat()) assert.ok(Math.abs(tick.rotation) <= 0.1 + 1e-9);
// Marker below (horizontal) or right (vertical) of its node.
assert.ok(horizontal.nodes[1].marker.y > horizontal.nodes[1].y && horizontal.nodes[1].marker.x === horizontal.nodes[1].x);
assert.ok(vertical.nodes[1].marker.x > vertical.nodes[1].x && vertical.nodes[1].marker.y === vertical.nodes[1].y);
// Size is the input's when given, 1:1.
const sized = buildMapBarLayout({ ...preset, width: 720, height: 140 });
assert.equal(sized.width, 720);
assert.equal(sized.height, 140);
assert.ok(sized.nodes[0].x >= 0 && sized.nodes.at(-1)!.x <= 720);
// Bigger scale, bigger nodes and dots further apart.
const big = buildMapBarLayout({ ...preset, scale: 0.9 });
assert.ok(big.nodes[1].size > horizontal.nodes[1].size);

// --- Timeline (R6, R7): Phase 4 windows, default schedule and given arrivals.
const timeline = buildMapBarTimeline(preset);
assert.equal(timeline.transits.length, 3);
const [first, second, third] = timeline.transits;
assert.equal(first.start, 500);
close(first.arrive, 500 + 0.92 * 2500);
assert.equal(first.end, 3000);
assert.equal(second.start, 4000);
assert.equal(third.end, 4000 + 2500 + 1000 + 2500);
assert.equal(timeline.duration, third.end + 1000);
const kinds = timeline.events.map((event) => `${event.kind}:${event.node}`);
assert.deepEqual(kinds.slice(0, 6), ["start:0", "depart:1", "ring:1", "arrive:1", "reveal:1", "settle:1"]);
assert.ok(!kinds.some((kind) => kind.endsWith(":4")), "the trailing ? is never reached");
const reveals = timeline.events.filter((event) => event.kind === "reveal");
assert.deepEqual(reveals.map((event) => event.icon), ["map_unknown_monster", "map_unknown_monster", "map_unknown_chest"]);

// Before arrival the destination is still "?"; at 0.92 it reveals and the marker pops.
const at = (progress: number) => timeline.frameAt(first.start + progress * first.duration);
assert.equal(at(0.9).nodes[1].revealed, false);
assert.deepEqual(at(0.9).nodes[1].art, { kind: "room", icon: "map_unknown", outline: "map_unknown_outline" });
assert.equal(at(0.93).nodes[1].revealed, true);
assert.equal(at(0.9).marker!.node, 0);
assert.equal(at(0.93).marker!.node, 1);
assert.ok(at(0.93).marker!.opacity < 1);
// Trail 0..0.70: about half the dots at 0.35.
const dots = timeline.layout.edges[0].length;
assert.equal(at(0.35).traveledTicks[0], Math.floor(0.5 * dots));
assert.equal(at(0.69).traveledTicks[0] < dots, true);
assert.equal(at(0.71).traveledTicks[0], dots);
// Ring 0.70..0.92, clockwise from 0 to 360.
assert.equal(at(0.6).ring, null);
close(at(0.81).ring!.angle, 180, 1e-6);
assert.equal(at(0.93).ring, null);
assert.equal(at(0.81).nodes[1].state, "active");
assert.equal(at(0.93).nodes[1].state, "current");
// After the last arrival the trailing "?" is still there, dim and unrevealed.
const end = timeline.frameAt(timeline.duration);
assert.equal(end.nodes[4].state, "inactive");
assert.deepEqual(end.nodes[4].art, { kind: "room", icon: "map_unknown", outline: "map_unknown_outline" });
assert.equal(end.marker!.node, 3);
assert.deepEqual(end.traveledTicks.map((n, i) => n === timeline.layout.edges[i].length), [true, true, true, false]);
close(end.nodes[3].scale, 1.08);
close(end.nodes[1].scale, 1);
close(end.nodes[4].scale, 0.95);
// The node scale eases like the CSS transition.
close(cssEase(0.5), 0.8024033877399112, 1e-6);
assert.ok(at(0.93).nodes[1].scale > 1 && at(0.93).nodes[1].scale !== 1.08);

// Same input and time, same frame.
assert.deepEqual(buildMapBarTimeline(preset).frameAt(5123), timeline.frameAt(5123));

// External arrivals (R7): the reveal lands exactly there.
const driven = buildMapBarTimeline({ ...preset, arrivals: [null, 2000, 5000, 8000], transitMs: 1200 });
assert.deepEqual(driven.events.filter((event) => event.kind === "arrive").map((event) => event.t), [2000, 5000, 8000]);
close(driven.transits[0].start, 2000 - 0.92 * 1200);
// Arrivals closer than a transit shorten it and say so.
const squeezed = buildMapBarTimeline({ ...preset, arrivals: [null, 2000, 2600, 9000] });
assert.ok(squeezed.warnings.some((warning) => warning.includes("arrivals[2]")));
assert.equal(squeezed.transits[1].start, squeezed.transits[0].end + 0);
close(squeezed.transits[1].arrive, 2600);

// Synthetic rest reveal (R5).
const rest = buildMapBarTimeline({ nodes: [{ type: "ancient" }, { type: "unknown", outcome: "rest" }] });
const restReveal = rest.events.find((event) => event.kind === "reveal");
assert.equal(restReveal?.synthetic, true);
assert.equal(rest.layout.nodes[1].synthetic, true);
assert.equal(rest.frameAt(rest.duration).nodes[1].synthetic, true);
assert.ok(rest.warnings.some((warning) => warning.includes("synthetic")));

// No marker when character is null.
assert.equal(buildMapBarTimeline({ ...preset, character: null }).frameAt(0).marker, null);

// Validation.
assert.ok(validateMapBarInput({ nodes: [] } as MapBarInput).length > 0);
assert.ok(validateMapBarInput({ nodes: [{ type: "boss" as never }] }).length > 0);
assert.throws(() => buildMapBarTimeline({ ...preset, arrivals: [null, 2000, 1000] }));

// Query parsing.
const parsed = parseMapBarQuery({ nodes: "ancient,unknown:monster,unknown:chest,unknown", orientation: "vertical", arrivals: ",1500,4000", width: "200", character: "none" });
assert.deepEqual(parsed.input?.nodes, [{ type: "ancient" }, { type: "unknown", outcome: "monster" }, { type: "unknown", outcome: "chest" }, { type: "unknown" }]);
assert.equal(parsed.input?.orientation, "vertical");
assert.deepEqual(parsed.input?.arrivals, [null, 1500, 4000]);
assert.equal(parsed.input?.width, 200);
assert.equal(parsed.input?.character, null);
assert.deepEqual(parseMapBarQuery({ preset: "untouchable-history", orientation: "vertical" }).input?.orientation, "vertical");
assert.ok(parseMapBarQuery({ nodes: "ancient,boss" }).errors.length > 0);

console.log("map bar OK");
