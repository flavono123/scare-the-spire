import assert from "node:assert/strict";
import {
  NAV_INDICATORS_CACHE_MS,
  navIndicatorFlagsFromRow,
  readNavIndicatorCache,
  writeNavIndicatorCache,
} from "../src/lib/nav-indicators";

assert.deepEqual(navIndicatorFlagsFromRow(null), { patchNotes: false, toyBox: false });
assert.deepEqual(
  navIndicatorFlagsFromRow({ patch_notes: true, toy_box: false }),
  { patchNotes: true, toyBox: false },
);
assert.deepEqual(
  navIndicatorFlagsFromRow({ patch_notes: "true", toy_box: 1 }),
  { patchNotes: false, toyBox: false },
);

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
};

const now = 1_000_000;
writeNavIndicatorCache(storage, "development", { patchNotes: true, toyBox: false }, now);
assert.deepEqual(
  readNavIndicatorCache(storage, "development", now + NAV_INDICATORS_CACHE_MS),
  { patchNotes: true, toyBox: false },
);
assert.equal(
  readNavIndicatorCache(storage, "development", now + NAV_INDICATORS_CACHE_MS + 1),
  null,
);
assert.equal(readNavIndicatorCache(storage, "production", now), null);

console.log("nav-indicators.spec.ts: ok");
