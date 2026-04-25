// Triage donated STS2 .run files by priority for the Run Replay fixture set.
//
// Usage:
//   npx tsx scripts/triage-donated-runs.ts <input> [options]
//
// <input> is either a directory (scanned recursively for *.run) or a single
// .run file. Each run is scored against the priority list documented in
// public/dev/run-fixtures/CONTRIBUTING.md.
//
// Options:
//   --top <n>        Limit output rows (and copies) to top N
//   --copy <dest>    Copy selected runs into <dest>/ with descriptive names
//   --all            Include runs with zero priority hits in the output
//   --json           Emit JSON instead of the human-readable table
//   --min-build <v>  Hide (table) / mark (json) runs older than this build.
//                    Default v0.103.0 — older builds don't reproduce yet.

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  parseReplayRun,
  type ReplayRelic,
  type ReplayRun,
} from "../src/lib/sts2-run-replay";

const MIN_SUPPORTED_BUILD = "v0.103.0";

interface CliOptions {
  input: string;
  top: number | null;
  copyDest: string | null;
  showAll: boolean;
  asJson: boolean;
  minBuild: string;
}

interface PriorityHit {
  /** Short tag printed in the table. */
  tag: string;
  /** Score contribution. */
  score: number;
  /** Human-readable description for the JSON output. */
  description: string;
}

interface TriageResult {
  filePath: string;
  fileName: string;
  ok: true;
  seed: string;
  build: string;
  buildSupported: boolean;
  ascension: number;
  character: string;
  win: boolean;
  actsReached: number;
  totalActs: number;
  hits: PriorityHit[];
  score: number;
}

interface TriageError {
  filePath: string;
  fileName: string;
  ok: false;
  error: string;
}

type TriageEntry = TriageResult | TriageError;

const BUILD_PENALTY_MULTIPLIER = 0.1;

function parseCli(argv: string[]): CliOptions {
  const args = argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    throw new Error("Usage: npx tsx scripts/triage-donated-runs.ts <input> [options]");
  }
  const opts: CliOptions = {
    input: args[0],
    top: null,
    copyDest: null,
    showAll: false,
    asJson: false,
    minBuild: MIN_SUPPORTED_BUILD,
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--top":
        opts.top = parseIntOrThrow(args[++i], "--top");
        break;
      case "--copy":
        opts.copyDest = args[++i];
        if (!opts.copyDest) throw new Error("--copy requires a destination path");
        break;
      case "--all":
        opts.showAll = true;
        break;
      case "--json":
        opts.asJson = true;
        break;
      case "--min-build":
        opts.minBuild = args[++i];
        if (!opts.minBuild) throw new Error("--min-build requires a version");
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function parseIntOrThrow(value: string | undefined, flag: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return Math.floor(n);
}

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

function endsWithUpper(id: string | undefined, suffix: string): boolean {
  return typeof id === "string" && id.toUpperCase().endsWith(suffix);
}

function findRelic(run: ReplayRun, suffix: string): ReplayRelic | undefined {
  return run.players[0]?.relics.find((r) => endsWithUpper(r.id, suffix));
}

function actsActuallyReached(run: ReplayRun): number {
  // Count acts where the history is non-empty. An aborted save can leave
  // trailing empty entries; those don't count.
  let count = 0;
  for (const act of run.map_point_history) {
    if (act.length > 0) count++;
  }
  return count;
}

function spoilsMapInDeckAtAct2Start(run: ReplayRun): boolean {
  // Mirrors the cardWasInDeckAtFloor logic in sts2-run-replay.ts but inlined
  // because that helper is module-private. Spoils Map's ModifyGeneratedMap
  // only fires when the player enters act 2 with the card in the deck pile.
  // Dying in act 1 means the trigger never runs even if the card was acquired.
  const player = run.players[0];
  if (!player) return false;
  if (actsActuallyReached(run) < 2) return false;
  const act1Length = run.map_point_history[0]?.length ?? 0;
  if (act1Length === 0) return false;
  const targetFloor = act1Length + 1;
  const matches = (id: string | undefined) => endsWithUpper(id, "SPOILS_MAP");

  // (1) Final deck snapshot: any spoils map still present that was added
  //     before the target floor is in deck at act-2 start.
  for (const card of player.deck) {
    if (matches(card.id) && (card.floor_added_to_deck ?? 0) < targetFloor) {
      return true;
    }
  }

  // (2) Walk history for cards gained then removed: if the most recent gain
  //     is before the target floor and there's no removal before that floor,
  //     the card was in the deck at the act-2 start.
  let floor = 1;
  let lastGainedFloor: number | null = null;
  let lastRemovedFloor: number | null = null;
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const card of entry.cards_gained ?? []) {
        if (matches(card.id)) lastGainedFloor = floor;
      }
      for (const card of entry.cards_lost ?? []) {
        if (matches(card.id)) lastRemovedFloor = floor;
      }
      for (const card of entry.cards_removed ?? []) {
        if (matches(card.id)) lastRemovedFloor = floor;
      }
      floor++;
    }
  }
  if (lastGainedFloor === null) return false;
  if (lastGainedFloor >= targetFloor) return false;
  if (lastRemovedFloor !== null && lastRemovedFloor < targetFloor) return false;
  return true;
}

function spoilsMapEverAcquired(run: ReplayRun): boolean {
  const player = run.players[0];
  if (!player) return false;
  if (player.deck.some((c) => endsWithUpper(c.id, "SPOILS_MAP"))) return true;
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const card of entry.cards_gained ?? []) {
        if (endsWithUpper(card.id, "SPOILS_MAP")) return true;
      }
    }
  }
  return false;
}

function classifyRun(filePath: string, fileName: string, raw: string): TriageEntry {
  let run: ReplayRun;
  try {
    run = parseReplayRun(raw);
  } catch (err) {
    return {
      filePath,
      fileName,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const buildSupported = buildAtLeast(run.build_id, MIN_SUPPORTED_BUILD);
  const hits: PriorityHit[] = [];

  const goldenCompass = findRelic(run, "GOLDEN_COMPASS");
  if (goldenCompass) {
    hits.push({
      tag: "GC",
      score: 1000,
      description: "Tezcatara Golden Compass acquired",
    });
  }

  const furCoat = findRelic(run, "FUR_COAT");
  if (furCoat) {
    hits.push({
      tag: "FC",
      score: 800,
      description: "Nonupeipe Fur Coat acquired",
    });
  }

  const winged = findRelic(run, "WINGED_BOOTS");
  if (winged) {
    const used = (winged.ints?.TimesUsed ?? 0) > 0;
    hits.push({
      tag: used ? `WB+${winged.ints?.TimesUsed}` : "WB",
      score: used ? 600 : 300,
      description: used
        ? `Winged Boots used ${winged.ints?.TimesUsed}x`
        : "Winged Boots acquired (no recorded uses)",
    });
  }

  if (spoilsMapInDeckAtAct2Start(run)) {
    hits.push({
      tag: "SPM",
      score: 500,
      description: "Spoils Map in deck at start of act 2 (triggered hourglass map)",
    });
  } else if (spoilsMapEverAcquired(run)) {
    hits.push({
      tag: "spm?",
      score: 50,
      description: "Spoils Map acquired but did not survive into act 2",
    });
  }

  const reached = actsActuallyReached(run);
  if (reached >= 3) {
    hits.push({ tag: "A3", score: 200, description: "Reached act 3" });
  }

  let score = hits.reduce((sum, h) => sum + h.score, 0);
  if (!buildSupported && score > 0) {
    score = Math.round(score * BUILD_PENALTY_MULTIPLIER);
  }

  return {
    filePath,
    fileName,
    ok: true,
    seed: run.seed,
    build: run.build_id,
    buildSupported,
    ascension: run.ascension,
    character: shortCharacter(run.players[0]?.character ?? "UNKNOWN"),
    win: run.win,
    actsReached: reached,
    totalActs: run.acts.length,
    hits,
    score,
  };
}

function shortCharacter(id: string): string {
  return id.replace(/^CHARACTER\./, "");
}

function collectRunFiles(input: string): string[] {
  const stat = statSync(input);
  if (stat.isFile()) {
    if (!input.endsWith(".run")) {
      throw new Error(`Not a .run file: ${input}`);
    }
    return [input];
  }
  if (!stat.isDirectory()) {
    throw new Error(`Not a file or directory: ${input}`);
  }
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith(".run")) out.push(full);
    }
  };
  walk(input);
  return out;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function rankTier(score: number): string {
  if (score >= 1500) return "S";
  if (score >= 800) return "A";
  if (score >= 400) return "B";
  if (score > 0) return "C";
  return "·";
}

function formatHits(entry: TriageResult): string {
  if (entry.hits.length === 0) return "—";
  return entry.hits.map((h) => h.tag).join(",");
}

function copyFilenameFor(entry: TriageResult, rank: number): string {
  const tags = entry.hits.length > 0 ? entry.hits.map((h) => h.tag).join("-") : "none";
  const safeTags = tags.replace(/[^A-Za-z0-9+_-]/g, "_");
  return `${String(rank).padStart(2, "0")}_${safeTags}_${entry.character}_${entry.seed}_a${entry.ascension}_${entry.build}.run`;
}

function printTable(entries: TriageEntry[], opts: CliOptions): void {
  const ok = entries.filter((e): e is TriageResult => e.ok);
  const errors = entries.filter((e): e is TriageError => !e.ok);

  ok.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName));

  const filtered = opts.showAll ? ok : ok.filter((e) => e.hits.length > 0);
  const supported = filtered.filter((e) => e.buildSupported);
  const limited = opts.top ? supported.slice(0, opts.top).concat(filtered.filter((e) => !e.buildSupported)) : filtered;

  console.log(
    `${pad("rk", 3)} ${pad("score", 6)} ${pad("seed", 12)} ${pad("A", 3)} ${pad("build", 10)} ${pad("char", 12)} ${pad("acts", 6)} ${pad("hits", 24)} file`,
  );
  console.log("-".repeat(110));
  let rank = 0;
  for (const entry of limited) {
    rank++;
    const tier = rankTier(entry.score);
    const buildMark = entry.buildSupported ? "" : "*";
    console.log(
      `${pad(tier, 3)} ${pad(String(entry.score), 6)} ${pad(entry.seed, 12)} ${pad(String(entry.ascension), 3)} ${pad(entry.build + buildMark, 10)} ${pad(entry.character, 12)} ${pad(`${entry.actsReached}/${entry.totalActs}`, 6)} ${pad(formatHits(entry), 24)} ${entry.fileName}`,
    );
  }
  console.log("-".repeat(110));

  const flaggedSupported = supported.filter((e) => e.hits.length > 0);
  console.log(
    `Total: ${ok.length} parsed, ${flaggedSupported.length} flagged on v0.103+, ${ok.length - supported.length} on older builds (marked *), ${errors.length} unparseable`,
  );
  if (errors.length > 0) {
    console.log("\nUnparseable:");
    for (const err of errors) {
      console.log(`  ${err.fileName}: ${err.error}`);
    }
  }
}

function copySelected(entries: TriageEntry[], opts: CliOptions): void {
  if (!opts.copyDest) return;
  const dest = resolve(opts.copyDest);
  mkdirSync(dest, { recursive: true });

  const ok = entries.filter((e): e is TriageResult => e.ok);
  ok.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName));
  const supported = ok.filter((e) => e.buildSupported && e.hits.length > 0);
  const slice = opts.top ? supported.slice(0, opts.top) : supported;

  let rank = 0;
  for (const entry of slice) {
    rank++;
    const target = join(dest, copyFilenameFor(entry, rank));
    copyFileSync(entry.filePath, target);
  }
  console.log(`\nCopied ${slice.length} run(s) → ${relative(process.cwd(), dest) || dest}`);
}

function emitJson(entries: TriageEntry[]): void {
  const ok = entries.filter((e): e is TriageResult => e.ok);
  ok.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName));
  const errors = entries.filter((e): e is TriageError => !e.ok);
  const payload = {
    minSupportedBuild: MIN_SUPPORTED_BUILD,
    runs: ok.map((entry) => ({
      file: entry.fileName,
      seed: entry.seed,
      build: entry.build,
      buildSupported: entry.buildSupported,
      ascension: entry.ascension,
      character: entry.character,
      win: entry.win,
      actsReached: entry.actsReached,
      totalActs: entry.totalActs,
      score: entry.score,
      tier: rankTier(entry.score),
      hits: entry.hits.map((h) => ({ tag: h.tag, score: h.score, description: h.description })),
    })),
    errors: errors.map((e) => ({ file: e.fileName, error: e.error })),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main(): void {
  const opts = parseCli(process.argv);
  const inputAbs = resolve(opts.input);
  const files = collectRunFiles(inputAbs);
  if (files.length === 0) {
    throw new Error(`No .run files found under ${inputAbs}`);
  }
  const cwd = process.cwd();
  const entries: TriageEntry[] = files.map((filePath) => {
    const fileName = relative(cwd, filePath) || filePath;
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf8");
    } catch (err) {
      return {
        filePath,
        fileName,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return classifyRun(filePath, fileName, raw);
  });

  if (opts.asJson) {
    emitJson(entries);
  } else {
    printTable(entries, opts);
  }
  copySelected(entries, opts);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
