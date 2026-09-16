import assert from "node:assert/strict";
import {
  countStoriesByPatchLine,
  indexPatchLines,
  resolveStoryPatchLine,
  storyMatchesPatchLine,
} from "../src/lib/resolve-story-patch-line";
import type { STS2PatchLine } from "../src/lib/types";

function line(id: string, refs: STS2PatchLine["entityRefs"] = []): STS2PatchLine {
  const patch = id.split(":")[0] ?? "v0.111.0";
  return {
    id,
    patch,
    version: patch.replace(/^v/, ""),
    date: "2026-08-14",
    section: ["콘텐츠 및 밸런스"],
    markdownKo: id,
    textKo: id,
    entityRefs: refs,
    searchText: id,
  };
}

const bladeCurrent = line("v0.111.0:line-022-card-blade-of-ink-enchantment-inky", [
  { type: "card", id: "BLADE_OF_INK", label: "잉크 칼날" },
  { type: "enchantment", id: "INKY", label: "잉크투성이" },
]);
const rampageNested = line("v0.111.0:line-021-text-1i3gv3i");
const rampage = line("v0.111.0:line-019-card-rampage", [
  { type: "card", id: "RAMPAGE", label: "광란" },
]);
const map = indexPatchLines([rampage, rampageNested, bladeCurrent]);

const shiftedBladeStory = {
  patchLineId: "v0.111.0:line-021-card-blade-of-ink-enchantment-inky",
  source: "v0.111.0",
  entityType: "card" as const,
  entityId: "BLADE_OF_INK",
};

assert.equal(
  resolveStoryPatchLine({ patchLineId: bladeCurrent.id }, map)?.id,
  bladeCurrent.id,
  "exact ids still resolve",
);

assert.equal(
  resolveStoryPatchLine(shiftedBladeStory, map)?.id,
  bladeCurrent.id,
  "stories keep the Blade of Ink line after later notes shift its ordinal",
);

assert.equal(
  resolveStoryPatchLine(
    { patchLineId: "v0.111.0:line-021-card-blade-of-ink-enchantment-inky" },
    map,
  )?.id,
  bladeCurrent.id,
  "slug match does not need entity fields",
);

assert.notEqual(
  resolveStoryPatchLine(
    { patchLineId: "v0.111.0:line-021-card-blade-of-ink-enchantment-inky" },
    map,
  )?.id,
  rampageNested.id,
  "stale ordinals must not attach to a different line that reused the number",
);

assert.equal(
  resolveStoryPatchLine(
    { patchLineId: "v0.111.0:line-020-text-1i3gv3i" },
    map,
  )?.id,
  rampageNested.id,
  "text-hash slugs survive ordinal shifts",
);

assert.equal(
  resolveStoryPatchLine(
    {
      patchLineId: "v0.111.0:line-099-missing-slug",
      source: "v0.111.0",
      entityType: "card",
      entityId: "BLADE_OF_INK",
    },
    map,
  )?.id,
  bladeCurrent.id,
  "a unique entity in the same patch is a last-resort match",
);

const duplicateSlugMap = indexPatchLines([
  line("v0.111.0:line-021-card-blade-of-ink-enchantment-inky", [
    { type: "card", id: "BLADE_OF_INK", label: "잉크 칼날" },
  ]),
  line("v0.111.0:line-022-card-blade-of-ink-enchantment-inky", [
    { type: "card", id: "BLADE_OF_INK", label: "잉크 칼날" },
  ]),
]);
assert.equal(
  resolveStoryPatchLine(
    { patchLineId: "v0.111.0:line-018-card-blade-of-ink-enchantment-inky" },
    duplicateSlugMap,
  ),
  undefined,
  "ambiguous slugs stay unresolved instead of picking the wrong line",
);

assert.equal(
  storyMatchesPatchLine(shiftedBladeStory, bladeCurrent, map),
  true,
);
assert.equal(
  storyMatchesPatchLine(shiftedBladeStory, rampageNested, map),
  false,
);

const counts = countStoriesByPatchLine([shiftedBladeStory], map);
assert.equal(counts.get(bladeCurrent.id), 1);
assert.equal(counts.get(rampageNested.id), undefined);

const preparedLine = line("v0.100.0:line-007-card-prepared", [
  { type: "card", id: "PREPARED", label: "예비" },
]);
const aliasMap = indexPatchLines([preparedLine]);
assert.equal(
  resolveStoryPatchLine(
    { patchLineId: "v0.100.0:line-001-text-qgkkr7" },
    aliasMap,
  )?.id,
  preparedLine.id,
  "aliased legacy text-hash patch line resolves to rewritten entity line",
);

import {
  patchLineAnchorId,
  patchLineHref,
  resolveCanonicalAnchorId,
} from "../src/lib/patch-line-links";
import { resolveCanonicalPatchLineId } from "../src/lib/resolve-story-patch-line";

assert.equal(
  resolveCanonicalPatchLineId("v0.100.0:line-001-text-qgkkr7"),
  "v0.100.0:line-007-card-prepared",
  "resolveCanonicalPatchLineId transforms legacy ID",
);
assert.equal(
  resolveCanonicalPatchLineId("v0.111.0:line-022-card-blade"),
  "v0.111.0:line-022-card-blade",
  "resolveCanonicalPatchLineId preserves canonical ID",
);
assert.equal(
  patchLineAnchorId("v0.100.0:line-001-text-qgkkr7"),
  "patch-line-v0-100-0-line-007-card-prepared",
  "patchLineAnchorId transforms legacy ID to canonical anchor",
);
assert.equal(
  resolveCanonicalAnchorId("patch-line-v0-100-0-line-001-text-qgkkr7"),
  "patch-line-v0-100-0-line-007-card-prepared",
  "resolveCanonicalAnchorId transforms legacy anchor to canonical anchor",
);
assert.equal(
  patchLineHref({
    id: "v0.100.0:line-001-text-qgkkr7",
    patch: "v0.100.0",
    version: "0.100.0",
    date: "2026-03-20",
    section: ["콘텐츠"],
    markdownKo: "",
    textKo: "",
    entityRefs: [],
    searchText: "",
  }),
  "/patches/0.100.0#patch-line-v0-100-0-line-007-card-prepared",
  "patchLineHref outputs canonical anchor link for aliased patch line",
);

console.log("resolve-story-patch-line.spec.ts passed");
