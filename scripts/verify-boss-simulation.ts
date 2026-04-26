import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analyzeReplayRun,
  parseReplayRun,
} from "../src/lib/sts2-run-replay";

const FIXTURE_DIR = join(__dirname, "..", "public", "dev", "run-fixtures");

interface IndexEntry {
  slug: string;
  label: string;
  seed: string;
  ascension: number;
  build: string;
  character: string;
}

const index = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "index.json"), "utf8"),
) as IndexEntry[];

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

function bossModelToId(modelId: string | null | undefined): string | null {
  if (!modelId) return null;
  // Run history records boss as `ENCOUNTER.<UPPER_SNAKE>`. Strip prefix to
  // match what `simulateActsUpFront` returns.
  return modelId.split(".").pop() ?? null;
}

interface ActVerdict {
  actIndex: number;
  actId: string;
  predictedFirst: string | null;
  actualFirst: string | null;
  predictedSecond: string | null;
  actualSecond: string | null;
}

let totalActsWithKnownBoss = 0;
let matched = 0;
const mismatches: Array<{ entry: IndexEntry; verdicts: ActVerdict[] }> = [];

for (const entry of index) {
  if (!buildAtLeast(entry.build, MIN_SUPPORTED_BUILD)) continue;

  const text = readFileSync(join(FIXTURE_DIR, `${entry.slug}.json`), "utf8");
  const run = parseReplayRun(text);
  const analysis = analyzeReplayRun(run);

  const verdicts: ActVerdict[] = [];
  let entryMismatch = false;

  for (const act of analysis.acts) {
    const bosses = act.history
      .filter((h) => h.map_point_type === "boss")
      .map((h) => bossModelToId(h.rooms[0]?.model_id));
    const actualFirst = bosses[0] ?? null;
    const actualSecond = bosses[1] ?? null;

    const v: ActVerdict = {
      actIndex: act.actIndex,
      actId: act.actId,
      predictedFirst: act.predictedFirstBoss,
      actualFirst,
      predictedSecond: act.predictedSecondBoss,
      actualSecond,
    };
    verdicts.push(v);

    if (actualFirst != null) {
      totalActsWithKnownBoss++;
      if (act.predictedFirstBoss === actualFirst) {
        matched++;
      } else {
        entryMismatch = true;
      }
    }
    if (actualSecond != null) {
      totalActsWithKnownBoss++;
      if (act.predictedSecondBoss === actualSecond) {
        matched++;
      } else {
        entryMismatch = true;
      }
    }
  }

  if (entryMismatch) {
    mismatches.push({ entry, verdicts });
  }
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

console.log(
  `\nBoss simulation match: ${matched}/${totalActsWithKnownBoss} (${
    totalActsWithKnownBoss > 0 ? ((matched / totalActsWithKnownBoss) * 100).toFixed(1) : "0"
  }%)\n`,
);

if (mismatches.length === 0) {
  console.log("All v0.103+ fixtures match — boss simulator is bit-exact.");
} else {
  console.log(`Mismatches: ${mismatches.length} fixtures\n`);
  for (const { entry, verdicts } of mismatches) {
    console.log(
      `${pad(entry.seed, 12)} ${pad("A" + entry.ascension, 3)} ${pad(entry.build, 10)} ${entry.slug}`,
    );
    for (const v of verdicts) {
      const firstStatus =
        v.actualFirst == null
          ? "—"
          : v.predictedFirst === v.actualFirst
            ? "OK"
            : `MISMATCH (pred=${v.predictedFirst}, got=${v.actualFirst})`;
      const secondStatus =
        v.actualSecond == null
          ? ""
          : v.predictedSecond === v.actualSecond
            ? " | 2nd OK"
            : ` | 2nd MISMATCH (pred=${v.predictedSecond}, got=${v.actualSecond})`;
      console.log(`  ${pad(v.actId, 16)} ${firstStatus}${secondStatus}`);
    }
    console.log();
  }
}

