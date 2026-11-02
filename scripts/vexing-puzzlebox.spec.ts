import assert from "node:assert/strict";
import betaArtPayload from "../data/sts2-beta-art.json";
import connectionsPayload from "../data/sts2-connections.json";
import { BETA_ART_QUIZ_SET_SIZE, buildBetaArtQuizSets } from "../src/lib/beta-art-quiz";
import type { BetaArtEntry } from "../src/lib/vexing-puzzlebox-types";

for (const puzzle of connectionsPayload) {
  assert.equal(puzzle.categories.length, 4, `#${puzzle.number} has four groups`);
  assert.deepEqual(puzzle.categories.map((category) => category.level).toSorted(), [0, 1, 2, 3]);
  const keys = puzzle.categories.flatMap((category) => {
    assert.equal(category.members.length, 4, `#${puzzle.number} group has four members`);
    return category.members.map((member) => `${member.ref.type}:${member.ref.id}`);
  });
  assert.equal(new Set(keys).size, 16, `#${puzzle.number} has no repeated member`);
}

const entries = [...betaArtPayload.pairs.map((pair) => pair.key), ...betaArtPayload.betaOnly]
  .filter((key) => key.startsWith("card:"))
  .map((key, index): BetaArtEntry => ({
    key,
    type: "card",
    id: key.slice("card:".length),
    name: key,
    color: ["ironclad", "silent", "curse", "status"][index % 4],
    betaUrl: "",
    officialUrl: null,
    href: "",
    earlyAccess: false,
  }));

const sets = buildBetaArtQuizSets(entries);
const questions = sets.flat();
assert.equal(questions.length, 274);
assert.ok(questions.every((question) => !question.entry.key.endsWith("PALE_BLUE_DOT")));
assert.equal(new Set(questions.map((question) => question.entry.key)).size, questions.length);
assert.ok(sets.slice(0, -1).every((set) => set.length === BETA_ART_QUIZ_SET_SIZE));
for (const question of questions) {
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices.map((choice) => choice.key)).size, 4);
  assert.ok(question.choices.some((choice) => choice.key === question.entry.key));
}
assert.deepEqual(
  buildBetaArtQuizSets(entries).flat().map((question) => question.entry.key),
  questions.map((question) => question.entry.key),
);

console.log("vexing-puzzlebox.spec passed");
