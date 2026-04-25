import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeReplayRun, parseReplayRun } from "../src/lib/sts2-run-replay";

const slug = process.argv[2] ?? "winged-boots-a10";
const actIndex = Number(process.argv[3] ?? "1");

const FIXTURE_DIR = join(__dirname, "..", "public", "dev", "run-fixtures");
const text = readFileSync(join(FIXTURE_DIR, `${slug}.json`), "utf8");
const run = parseReplayRun(text);
const analysis = analyzeReplayRun(run);
const act = analysis.acts[actIndex];

console.log(
  `seed=${run.seed} act=${actIndex} variant=${act.mapVariant} matched=${act.matchedPathCount} flightUsed=${act.flightStepsUsed}`,
);
console.log("history:");
act.history.forEach((entry, i) => {
  const cands = act.candidateNodeIdsByStep[i] ?? [];
  const edges = act.candidateEdgeIdsByStep[i] ?? [];
  const flight = act.flightStepIndices.includes(i) ? "  ✈" : "";
  console.log(
    `  ${String(i + 1).padStart(2)} ${entry.map_point_type.padEnd(11)} cands=[${cands.join(", ")}] edges=[${edges.join(", ")}]${flight}`,
  );
});

console.log("\nedges adjacent to ambiguous steps:");
const ambiguousNodes = act.candidateNodeIdsByStep
  .map((cands, i) => ({ i, cands }))
  .filter((e) => e.cands.length > 1);
for (const { i, cands } of ambiguousNodes) {
  console.log(`  step ${i + 1}: ${cands.join(", ")}`);
  for (const cand of cands) {
    const node = act.nodes.find((n) => n.id === cand);
    if (!node) continue;
    const out = act.edges
      .filter((e) => e.from === cand)
      .map((e) => e.to)
      .sort();
    const inn = act.edges
      .filter((e) => e.to === cand)
      .map((e) => e.from)
      .sort();
    console.log(`    ${cand} (${node.type}) parents=[${inn.join(", ")}] children=[${out.join(", ")}]`);
  }
}
