/**
 * Minimal assert for suggestCovers — fails if axis-1 cover logic regresses.
 *   pnpm exec tsx scripts/run-cover-suggest.selfcheck.ts
 */
import { readFileSync } from "node:fs";
import { suggestCovers } from "../src/lib/run-cover-suggest";
import { computeRunHash, runRouteSlug } from "../src/lib/sts2-run-hash";
import { parseReplayRun } from "../src/lib/sts2-run-replay";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const runPath =
    process.argv[2] ??
    `${process.env.HOME}/Library/Application Support/SlayTheSpire2/steam/76561199168753671/profile1/saves/history/1786252308.run`;

  const raw = readFileSync(runPath, "utf8");
  const run = parseReplayRun(raw);
  const runId = runRouteSlug(await computeRunHash(run));
  const { covers } = suggestCovers({ runId, run });
  const [a, b] = covers;
  assert(a && b, "two covers");

  assert(a.background.kind === "character", "cover A must be character bg");
  assert(
    b.background.kind === "card-beta" || b.background.kind === "character",
    "cover B must be card-beta (or character fallback)",
  );
  if (b.background.kind === "card-beta") {
    const focusId = b.background.cardId;
    assert(
      b.elements.every((el) => el.id !== focusId),
      "cover B must not repeat focus card in elements",
    );
  }
  assert(a.elements.length >= 1 && a.elements.length <= 3, "elements A 1..3");
  assert(b.elements.length >= 1 && b.elements.length <= 3, "elements B 1..3");
  assert(a.phrase.length > 0 && a.phrase.length <= 40, "phrase A length");
  assert(b.phrase.length > 0 && b.phrase.length <= 40, "phrase B length");

  const again = suggestCovers({ runId, run }).covers[0]!;
  assert(again.phrase === a.phrase, "stable seed must repeat phrase");
  assert(
    JSON.stringify(again.elements) === JSON.stringify(a.elements),
    "stable seed must repeat elements",
  );

  console.log("ok", {
    runId,
    a: { phrase: a.phrase, elements: a.elements },
    b: {
      phrase: b.phrase,
      background: b.background,
      elements: b.elements,
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
