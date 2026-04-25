import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeReplayRun, parseReplayRun } from "../src/lib/sts2-run-replay";

const FIXTURE_DIR = join(__dirname, "..", "public", "dev", "run-fixtures");
const slugs = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => f.replace(/\.json$/, ""));

for (const slug of slugs) {
  const text = readFileSync(join(FIXTURE_DIR, `${slug}.json`), "utf8");
  const run = parseReplayRun(text);
  const analysis = analyzeReplayRun(run);
  console.log(`\n=== ${slug} (${run.seed}) ===`);
  for (const act of analysis.acts) {
    const variant = act.mapVariant === "standard" ? "" : ` [${act.mapVariant}]`;
    const fur = act.furCoatMarkerNodeIds.length;
    const spoils = act.spoilsMarkerNodeId ? `1 (${act.spoilsMarkerNodeId})` : "0";
    const fly = act.flightArrivalNodeIds.length;
    console.log(
      `  ${act.actLabel}${variant}: furCoat=${fur} spoils=${spoils} flightArrival=${fly} ${act.flightArrivalNodeIds.length > 0 ? `(${act.flightArrivalNodeIds.join(", ")})` : ""}`,
    );
  }
}
