import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeReplayRun, parseReplayRun } from "../src/lib/sts2-run-replay";

const slug = process.argv[2] ?? "defect-2la5-a10";
const actIndex = Number(process.argv[3] ?? "1");

const FIXTURE_DIR = join(__dirname, "..", "public", "dev", "run-fixtures");
const text = readFileSync(join(FIXTURE_DIR, `${slug}.json`), "utf8");
const run = parseReplayRun(text);
const analysis = analyzeReplayRun(run);
const act = analysis.acts[actIndex];

console.log(`seed=${run.seed} act=${actIndex} variant=${act.mapVariant} matched=${act.matchedPathCount}`);
console.log(`history types:`);
console.log("  " + act.historyTypes.join(", "));
console.log();
console.log(`generated map (rows = floor):`);
const grid = new Map<number, string[]>();
for (const node of act.nodes) {
  const row = node.row;
  if (!grid.has(row)) grid.set(row, []);
  grid.get(row)!.push(`${node.col}=${node.type[0]}`);
}
const sortedRows = [...grid.keys()].sort((a, b) => a - b);
for (const row of sortedRows) {
  console.log(`  row ${String(row).padStart(2)}: ${grid.get(row)!.sort().join("  ")}`);
}
console.log();
console.log("type counts in generated map:");
const counts: Record<string, number> = {};
for (const node of act.nodes) {
  counts[node.type] = (counts[node.type] ?? 0) + 1;
}
console.log(" ", JSON.stringify(counts));
console.log();
console.log("type counts in history:");
const hcounts: Record<string, number> = {};
for (const t of act.historyTypes) hcounts[t] = (hcounts[t] ?? 0) + 1;
console.log(" ", JSON.stringify(hcounts));
