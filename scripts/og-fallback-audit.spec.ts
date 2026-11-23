/**
 * OG fallback audit (src/lib/og-fallback-audit.ts): path mapping, template matching, classification, grouping.
 *   pnpm exec tsx scripts/og-fallback-audit.spec.ts
 */
import assert from "node:assert/strict";
import {
  builtFileToPath,
  classifyPageImage,
  groupFallbackPages,
  matchRouteTemplate,
  sharedOgImages,
} from "../src/lib/og-fallback-audit";

assert.equal(builtFileToPath("index.html"), "/");
assert.equal(builtFileToPath("compendium/cards/bash.html"), "/compendium/cards/bash");
assert.equal(builtFileToPath("patches/0.103.0/index.html"), "/patches/0.103.0");

const templates = ["/compendium/cards", "/compendium/cards/[id]", "/defragment/[id]", "/defragment/[id]/[postId]", "/patches/changes", "/patches/[version]"];
assert.equal(matchRouteTemplate("/compendium/cards/bash", templates), "/compendium/cards/[id]");
assert.equal(matchRouteTemplate("/patches/changes", templates), "/patches/changes");
assert.equal(matchRouteTemplate("/patches/0.1.0", templates), "/patches/[version]");
assert.equal(matchRouteTemplate("/defragment/combo/__id__", templates), "/defragment/[id]/[postId]");
assert.equal(matchRouteTemplate("/nowhere", templates), "/nowhere");

const shared = sharedOgImages();
const exists = () => true;
const DEFAULT = "/images/sts2/cards/coordinate.webp";
assert.deepEqual(classifyPageImage({ path: "/x", image: null }, shared, exists), { kind: "none" });
assert.deepEqual(classifyPageImage({ path: "/x", image: "/images/gone.webp" }, shared, () => false), { kind: "broken" });
assert.deepEqual(classifyPageImage({ path: "/compendium", image: DEFAULT }, shared, exists), { kind: "default", owner: "/" });
assert.equal(classifyPageImage({ path: "/", image: DEFAULT }, shared, exists), null, "home owns the default");
assert.equal(classifyPageImage({ path: "/compendium/cards/coordinate", image: DEFAULT }, shared, exists), null, "own art");
assert.equal(classifyPageImage({ path: "/compendium/cards/bash", image: "/images/sts2/cards/bash.webp" }, shared, exists), null);
assert.deepEqual(
  classifyPageImage({ path: "/this-or-that/tournament", image: "/images/sts2/events/this_or_that.webp" }, shared, exists),
  { kind: "shared", owner: "/this-or-that" },
);

const page = (path: string, image: string, template: string) => ({ path, image, template, kind: "default" as const, owner: "/", files: 2 });
const groups = groupFallbackPages(
  [
    page("/a/1", DEFAULT, "/a/[id]"),
    page("/a/2", DEFAULT, "/a/[id]"),
    page("/b/1", DEFAULT, "/b/[id]"),
    page("/c", DEFAULT, "/c"),
  ],
  new Map([["/a/[id]", 2], ["/b/[id]", 5], ["/c", 1]]),
  {
    "/c": { status: "intended", image: DEFAULT, updatedAt: "2026-11-23" },
    "/b/1": { status: "undecided", image: "/images/other.webp", updatedAt: "2026-11-23" },
  },
);
assert.deepEqual(
  groups.map((group) => [group.key, group.state, group.fileCount]),
  [
    ["/a/[id]", "unconfirmed", 4],
    ["/b/1", "unconfirmed", 2], // decided for another image → reopened
    ["/c", "intended", 2],
  ],
);

console.log("og-fallback-audit.spec.ts ok");
