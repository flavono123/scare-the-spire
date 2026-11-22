import assert from "node:assert/strict";
import {
  navVisitSearchBonus,
  navVisitsStorageKey,
  placeIdForPath,
  readNavVisits,
  recordNavVisit,
  sortNavMenuEntries,
} from "../src/lib/nav-visits";

const places = [
  { id: "vexing-puzzlebox", href: "/vexing-puzzlebox" },
  { id: "beta-art", href: "/vexing-puzzlebox/beta-art" },
  { id: "history-course", href: "/history-course" },
];

// The longest matching href wins, locale prefixes are ignored, other paths count nothing.
assert.equal(placeIdForPath("/vexing-puzzlebox/beta-art", places), "beta-art");
assert.equal(placeIdForPath("/en/vexing-puzzlebox/beta-art/", places), "beta-art");
assert.equal(placeIdForPath("/vexing-puzzlebox", places), "vexing-puzzlebox");
assert.equal(placeIdForPath("/history-course/abc123", places), "history-course");
assert.equal(placeIdForPath("/history-courses", places), null);
assert.equal(placeIdForPath("/", places), null);

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
};
recordNavVisit(storage, "/history-course/abc", places);
recordNavVisit(storage, "/history-course", places);
recordNavVisit(storage, "/patches", places);
assert.deepEqual(readNavVisits(storage), { "history-course": 2 });

// Broken or blocked storage: no visits, no throw.
memory.set(navVisitsStorageKey(), "{not json");
assert.deepEqual(readNavVisits(storage), {});
assert.deepEqual(readNavVisits(null), {});
recordNavVisit(null, "/history-course", places);
recordNavVisit({ getItem: () => null, setItem: () => { throw new Error("full"); } }, "/history-course", places);

// Folded last, new service or new post first, then visits, then registry order.
const entry = (id: string, order: number, extra: Partial<{ fold: boolean; isNew: boolean; unread: boolean }> = {}) => ({
  id, order, fold: false, isNew: false, unread: false, ...extra,
});
assert.deepEqual(
  sortNavMenuEntries([
    entry("combo", 0, { fold: true, isNew: true }),
    entry("a", 1),
    entry("b", 2),
    entry("c", 3, { unread: true }),
    entry("d", 4, { isNew: true }),
    entry("e", 5),
  ], { b: 3, e: 5, combo: 99 }).map((item) => item.id),
  ["c", "d", "e", "b", "a", "combo"],
);

// The search bonus is capped and only for menu destinations.
const bonus = navVisitSearchBonus({ toybox: 1, "history-course": 50 });
assert.equal(bonus({ type: "toybox", id: "history-course" }), 200);
assert.equal(bonus({ type: "toybox", id: "toybox" }), 20);
assert.equal(bonus({ type: "card", id: "history-course" }), 0);

console.log("nav-visits.spec.ts: ok");
