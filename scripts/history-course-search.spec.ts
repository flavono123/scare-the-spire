import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  buildHistoryCourseSearchDoc,
  extractRunGameElements,
  historyCourseRunMatches,
  historyCourseRunMatchesKeyword,
  resourceFromReplayId,
} from "../src/lib/history-course-search";
import type { CoverSpec } from "../src/lib/run-cover-types";
import { buildSearchTokens, formatBuildLabel } from "../src/lib/sts2-build-version";
import type { ReplayRun } from "../src/lib/sts2-run-replay";

assert.equal(formatBuildLabel("v0.111.0"), "v0.111.0");
assert.equal(formatBuildLabel("vv0.111.0"), "v0.111.0");
assert.equal(formatBuildLabel("0.111.0"), "v0.111.0");
assert.deepEqual(buildSearchTokens("v0.111.0").sort(), ["0.111.0", "v0.111.0"].sort());

assert.deepEqual(resourceFromReplayId("CHARACTER.REGENT", "character"), {
  type: "character",
  id: "REGENT",
});

const regent: EntityInfo = {
  id: "REGENT",
  nameEn: "Regent",
  nameKo: "리젠트",
  imageUrl: null,
  color: "regent",
  type: "character",
};
const ironclad: EntityInfo = {
  id: "IRONCLAD",
  nameEn: "Ironclad",
  nameKo: "아이언클래드",
  imageUrl: null,
  color: "ironclad",
  type: "character",
};
const entities = [regent, ironclad];

function makeRun(character: string, extras?: Partial<ReplayRun>): ReplayRun {
  return {
    seed: "ABC123",
    build_id: "v0.111.0",
    ascension: 10,
    game_mode: "standard",
    win: true,
    acts: ["ACT.OVERGROWTH"],
    players: [{
      id: 0,
      character,
      deck: [{ id: "STRIKE" }],
      relics: [{ id: "GOLDEN_IDOL" }],
      potions: [],
      badges: [],
    }],
    modifiers: [],
    map_point_history: [[]],
    ...extras,
  };
}

const cover: CoverSpec = {
  background: { kind: "character" },
  phrase: "커스텀 제목",
  titlePhrase: "락업 제목",
  elements: [{ kind: "card", id: "STRIKE" }],
  auto: false,
  suggestSeed: "seed",
};

const regentRun = makeRun("CHARACTER.REGENT");
const resources = extractRunGameElements(regentRun);
assert.ok(
  resources.some((resource) => resource.type === "character" && resource.id === "REGENT"),
  "character replay ids should map onto Compendium character ids",
);
assert.ok(
  resources.some((resource) => resource.type === "card" && resource.id === "STRIKE"),
);

const regentDoc = buildHistoryCourseSearchDoc({
  runId: "run-regent",
  run: regentRun,
  cover,
  entities,
});

assert.equal(historyCourseRunMatchesKeyword(regentDoc, "리젠", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "리젠트", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "0.111", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "v0.111.0", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "ABC123", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "커스텀 제목", entities), true);
assert.equal(historyCourseRunMatchesKeyword(regentDoc, "락업 제목", entities), true);
assert.equal(
  historyCourseRunMatches(regentDoc, "", [{ type: "character", id: "REGENT" }], entities),
  true,
);
assert.equal(
  historyCourseRunMatches(regentDoc, "", [{ type: "character", id: "IRONCLAD" }], entities),
  false,
);

const ironcladDoc = buildHistoryCourseSearchDoc({
  runId: "run-ironclad",
  run: makeRun("CHARACTER.IRONCLAD"),
  entities,
});
assert.equal(historyCourseRunMatchesKeyword(ironcladDoc, "리젠", entities), false);
assert.equal(historyCourseRunMatchesKeyword(ironcladDoc, "아이언", entities), true);

console.log("history course search checks passed");
