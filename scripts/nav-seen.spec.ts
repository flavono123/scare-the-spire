import assert from "node:assert/strict";
import {
  contentIsNewerThanSeen,
  displayedUnreadIds,
  effectiveUnreadIds,
  navSeenIdForHref,
  navSeenStorageKey,
  readNavSeen,
  surfaceIdForPath,
  toyBoxHasUnread,
} from "../src/lib/nav-seen";

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
};

const seen = readNavSeen(storage, "2026-09-24T00:00:00.000Z");
assert.equal(seen["patch-notes"], "2026-09-24T00:00:00.000Z");
assert.equal(seen.combo, "2026-09-24T00:00:00.000Z");
memory.clear();
storage.setItem(navSeenStorageKey(), JSON.stringify({ "patch-notes": "2026-09-01T00:00:00.000Z" }));
const filled = readNavSeen(storage, "2026-09-24T00:00:00.000Z");
assert.equal(filled["patch-notes"], "2026-09-01T00:00:00.000Z");
assert.equal(filled.combo, "2026-09-24T00:00:00.000Z");

assert.equal(surfaceIdForPath("/patches/0.111.0"), "patch-notes");
assert.equal(surfaceIdForPath("/en/patches"), "patch-notes");
assert.equal(surfaceIdForPath("/patches/neowsletters/2026-08"), "neowsletters");
assert.equal(surfaceIdForPath("/patches/changes"), null);
assert.equal(surfaceIdForPath("/this-or-that/tournament/abc"), "favorite-tournament");
assert.equal(surfaceIdForPath("/en/c-c-c-combo/abc"), "combo");
assert.equal(surfaceIdForPath("/dev/nav-indicators"), null);

assert.equal(navSeenIdForHref("/c-c-c-combo"), "combo");
assert.equal(navSeenIdForHref("/this-or-that/tournament"), null);
assert.deepEqual(displayedUnreadIds(["favorite-tournament"]), ["favorite-tournament", "this-or-that"]);
assert.equal(toyBoxHasUnread(["patch-notes"]), false);
assert.equal(toyBoxHasUnread(["neowsletters"]), false);
assert.equal(toyBoxHasUnread(["combo"]), true);
assert.equal(toyBoxHasUnread(effectiveUnreadIds([], { combo: true })), true);
assert.equal(toyBoxHasUnread(effectiveUnreadIds(["combo", "transfigure"], { combo: false, transfigure: false })), false);
assert.equal(contentIsNewerThanSeen("2026-01-01T00:00:00.000Z", "2026-09-24T00:00:00.000Z"), false);
assert.equal(contentIsNewerThanSeen("2026-09-25T00:00:00.000Z", "2026-09-24T00:00:00.000Z"), true);

console.log("nav-seen.spec.ts: ok");
