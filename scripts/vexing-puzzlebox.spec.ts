import assert from "node:assert/strict";
import betaArtPayload from "../data/sts2-beta-art.json";
import connectionsPayload from "../data/sts2-connections.json";
import { buildBetaArtQuizSets } from "../src/lib/beta-art-quiz";
import type { BetaArtEntry } from "../src/lib/vexing-puzzlebox-types";

assert.equal(connectionsPayload.length, 26, "every Neowsletter puzzle (#22 was never published)");
assert.equal(new Set(connectionsPayload.map((puzzle) => puzzle.number)).size, 26);
for (const puzzle of connectionsPayload) {
  assert.ok(puzzle.categories.every((category) => category.titleKo), `#${puzzle.number} has Korean titles`);
  assert.equal(puzzle.categories.length, 4, `#${puzzle.number} has four groups`);
  assert.deepEqual(puzzle.categories.map((category) => category.level).toSorted(), [0, 1, 2, 3]);
  const keys = puzzle.categories.flatMap((category) => {
    assert.equal(category.members.length, 4, `#${puzzle.number} group has four members`);
    return category.members.map((member) => (member.ref ? `${member.ref.game}:${member.ref.type}:${member.ref.id}` : member.raw));
  });
  assert.equal(new Set(keys).size, 16, `#${puzzle.number} has no repeated member`);
}

const entries = betaArtPayload.pairs.map((pair, index): BetaArtEntry => {
  const [type, id] = pair.key.split(":") as [BetaArtEntry["type"], string];
  return {
    key: pair.key,
    type,
    id,
    name: pair.key,
    nameEn: pair.key,
    color: type === "card" ? ["ironclad", "silent", "curse", "status"][index % 4] : null,
    betaUrl: "",
    officialUrl: null,
    href: "",
    earlyAccess: false,
    episode: pair.episode,
    episodeOrder: pair.episodeOrder,
  };
});

const sets = buildBetaArtQuizSets(entries);
const questions = sets.flat();
assert.equal(sets.length, 48, "one set per Shorts episode");
assert.equal(questions.length, entries.length - 1, "every paired art but Pale Blue Dot");
assert.ok(questions.every((question) => !question.entry.key.endsWith("PALE_BLUE_DOT")));
assert.equal(new Set(questions.map((question) => question.entry.key)).size, questions.length);
assert.ok(sets.every((set) => set.length >= 5 && set.length <= 7));
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
