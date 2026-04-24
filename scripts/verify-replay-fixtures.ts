import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeReplayRun, parseReplayRun } from "../src/lib/sts2-run-replay";

const FIXTURE_DIR = join(__dirname, "..", "public", "dev", "run-fixtures");
const index = JSON.parse(readFileSync(join(FIXTURE_DIR, "index.json"), "utf8")) as Array<{
  slug: string;
  label: string;
  seed: string;
  ascension: number;
  build: string;
  character: string;
}>;

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

let totalActs = 0;
let exactActs = 0;
let zeroActs = 0;
let ambiguousActs = 0;

const rows: string[] = [];
rows.push(
  `${pad("seed", 12)} ${pad("A", 3)} ${pad("build", 10)} ${pad("slug", 36)} acts`,
);
rows.push("-".repeat(110));

for (const entry of index) {
  const text = readFileSync(join(FIXTURE_DIR, `${entry.slug}.json`), "utf8");
  const run = parseReplayRun(text);
  const analysis = analyzeReplayRun(run);
  const acts = analysis.acts.map((act) => {
    totalActs++;
    const label = act.actLabel;
    const variant =
      act.mapVariant === "standard"
        ? ""
        : `/${act.mapVariant === "golden_path" ? "GP" : "SP"}`;
    if (act.matchedPathCount === 0) {
      zeroActs++;
      return `${label}${variant}:ZERO`;
    }
    if (act.exactReplay) {
      exactActs++;
      return `${label}${variant}:EXACT`;
    }
    ambiguousActs++;
    return `${label}${variant}:${act.matchedPathCount}${act.matchedPathCountCapped ? "+" : ""}`;
  });
  rows.push(
    `${pad(entry.seed, 12)} ${pad(`A${entry.ascension}`, 3)} ${pad(entry.build, 10)} ${pad(entry.slug, 36)} ${acts.join("  ")}`,
  );
}

rows.push("-".repeat(110));
rows.push(
  `total acts=${totalActs}  exact=${exactActs}  ambiguous=${ambiguousActs}  zero=${zeroActs}`,
);

console.log(rows.join("\n"));
