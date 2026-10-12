import assert from "node:assert/strict";
import {
  coverToPublishAfterShare,
  duplicateShareShouldUpdateCover,
  localCoverSaveAttemptsRemoteSync,
  unionDonatedIds,
} from "../src/lib/history-course-share-state";
import type { CoverSpec } from "../src/lib/run-cover-types";

const autoCover: CoverSpec = {
  background: { kind: "character" },
  phrase: "auto",
  elements: [],
  auto: true,
  suggestSeed: "seed:A",
};

const manualCover: CoverSpec = {
  ...autoCover,
  phrase: "edited",
  auto: false,
};

assert.equal(coverToPublishAfterShare(autoCover, autoCover), null);
assert.equal(coverToPublishAfterShare(autoCover, null), null);
assert.equal(coverToPublishAfterShare(manualCover, manualCover), null);
assert.equal(coverToPublishAfterShare(autoCover, manualCover), manualCover);
assert.equal(coverToPublishAfterShare(null, manualCover), manualCover);

assert.equal(duplicateShareShouldUpdateCover(autoCover), false);
assert.equal(duplicateShareShouldUpdateCover(manualCover), true);
assert.equal(duplicateShareShouldUpdateCover(null), false);
assert.equal(duplicateShareShouldUpdateCover(undefined), false);

assert.equal(localCoverSaveAttemptsRemoteSync(true), true);
assert.equal(localCoverSaveAttemptsRemoteSync(false), false);

const empty = new Set<string>();
const optimistic = unionDonatedIds(empty, ["run-1"], empty);
assert.equal(optimistic.has("run-1"), true);

const dismissed = unionDonatedIds(new Set(["run-1"]), ["run-1"], new Set(["run-1"]));
assert.equal(dismissed.has("run-1"), false);

const serverWins = unionDonatedIds(new Set(["run-2"]), [], empty);
assert.equal(serverWins.has("run-2"), true);

console.log("history-course-cover-sync.spec.ts: ok");
