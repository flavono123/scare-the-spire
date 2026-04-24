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

// Extracted game source is v0.104. Older-build fixtures may have generation
// drift we can't port (no access to historical source). Track v0.103+ runs
// separately as the primary compatibility target.
const MIN_SUPPORTED_BUILD = "v0.103.0";

function parseBuild(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? "0")];
}

function buildAtLeast(a: string, b: string): boolean {
  const pa = parseBuild(a);
  const pb = parseBuild(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return true;
}

let totalActs = 0;
let exactActs = 0;
let zeroActs = 0;
let ambiguousActs = 0;
let supportedActs = 0;
let supportedExact = 0;
let supportedZero = 0;
let supportedAmbiguous = 0;

const rows: string[] = [];
rows.push(
  `${pad("seed", 12)} ${pad("A", 3)} ${pad("build", 10)} ${pad("slug", 36)} acts`,
);
rows.push("-".repeat(110));

for (const entry of index) {
  const supported = buildAtLeast(entry.build, MIN_SUPPORTED_BUILD);
  const text = readFileSync(join(FIXTURE_DIR, `${entry.slug}.json`), "utf8");
  const run = parseReplayRun(text);
  const analysis = analyzeReplayRun(run);
  const acts = analysis.acts.map((act) => {
    totalActs++;
    if (supported) supportedActs++;
    const label = act.actLabel;
    const variant =
      act.mapVariant === "standard"
        ? ""
        : `/${act.mapVariant === "golden_path" ? "GP" : "SP"}`;
    if (act.matchedPathCount === 0) {
      zeroActs++;
      if (supported) supportedZero++;
      return `${label}${variant}:ZERO`;
    }
    if (act.exactReplay) {
      exactActs++;
      if (supported) supportedExact++;
      return `${label}${variant}:EXACT`;
    }
    ambiguousActs++;
    if (supported) supportedAmbiguous++;
    return `${label}${variant}:${act.matchedPathCount}${act.matchedPathCountCapped ? "+" : ""}`;
  });
  const marker = supported ? " " : "*";
  rows.push(
    `${marker}${pad(entry.seed, 12)} ${pad(`A${entry.ascension}`, 3)} ${pad(entry.build, 10)} ${pad(entry.slug, 36)} ${acts.join("  ")}`,
  );
}

rows.push("-".repeat(110));
rows.push(
  `all     : total=${totalActs}  exact=${exactActs}  ambiguous=${ambiguousActs}  zero=${zeroActs}`,
);
rows.push(
  `v0.103+ : total=${supportedActs}  exact=${supportedExact}  ambiguous=${supportedAmbiguous}  zero=${supportedZero}   (primary target)`,
);
rows.push(
  `* = build < ${MIN_SUPPORTED_BUILD} (no historical source available — expected to zero-match in some cases)`,
);

console.log(rows.join("\n"));
