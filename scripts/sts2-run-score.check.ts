/**
 * src/lib/sts2/run-score.ts against the game's own ScoreUtility (scripts/sts2-score-harness) on real run files.
 *
 *   dotnet run -c Release --project scripts/sts2-score-harness -- <runs-dir> > harness.jsonl
 *   dotnet run -c Release --project scripts/sts2-score-harness -- --models > models.json   (optional)
 *   pnpm exec tsx scripts/sts2-run-score.check.ts <runs-dir> <harness.jsonl> [models.json]
 *
 * Fails on any score, score-line or badge mismatch with the harness's GetBadges, or a card/character fact the
 * port reads that differs from the game's models. Badges the game recorded in a file but the 0.113 rules do not give
 * (older builds) are listed, not failed. Run files and harness output stay outside the repo.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { clampSts2ScoreInput, sts2BadgesFromInput, sts2Score, type Sts2ScoreInput } from "../src/lib/sts2/score";
import { sts2BadgeCardFacts, sts2RunBadges, sts2RunScore, sts2StartingHp, type Sts2RunFile } from "../src/lib/sts2/run-score";

type HarnessBadge = { id: string; rarity: string };
type HarnessLine = {
  file: string;
  error?: string;
  modelDbError?: string;
  score: number;
  floors: number;
  goldPoints: number;
  elites: number;
  bosses: number;
  players: { id: number; recorded: HarnessBadge[]; computed?: HarnessBadge[]; computedError?: string }[];
};

const [dir, harnessPath, modelsPath] = process.argv.slice(2);
if (!dir || !harnessPath) {
  console.error("usage: tsx scripts/sts2-run-score.check.ts <runs-dir> <harness.jsonl> [models.json]");
  process.exit(2);
}

const harness = new Map<string, HarnessLine>();
for (const line of readFileSync(harnessPath, "utf8").split("\n")) {
  if (!line.startsWith("{")) continue; // the game's Sentry module initializer prints a line to stdout
  const parsed = JSON.parse(line) as HarnessLine;
  harness.set(parsed.file, parsed);
}

const mismatches: string[] = [];
const recordedDiffs = new Map<string, string[]>();
const coverage = new Map<string, Map<string, number>>();
const count = (group: string, key: string | number | boolean) => {
  const counts = coverage.get(group) ?? new Map<string, number>();
  counts.set(String(key), (counts.get(String(key)) ?? 0) + 1);
  coverage.set(group, counts);
};
const badgeKey = (badges: HarnessBadge[]) => badges.map((b) => `${b.id}:${b.rarity.toLowerCase()}`).sort().join(",");

const files = readdirSync(dir).filter((name) => name.endsWith(".run")).sort();
for (const file of files) {
  const run = JSON.parse(readFileSync(join(dir, file), "utf8")) as Sts2RunFile & { build_id?: string; modifiers?: unknown[]; is_custom_game?: boolean };
  const truth = harness.get(file);
  if (!truth) {
    mismatches.push(`${file}: missing from the harness output`);
    continue;
  }
  if (truth.error || truth.modelDbError) {
    mismatches.push(`${file}: harness error ${truth.error ?? truth.modelDbError}`);
    continue;
  }

  const score = sts2RunScore(run);
  const line = (key: string) => score.lines.find((l) => l.key === key);
  const got = {
    score: score.total,
    floors: line("floorsClimbed")?.points ?? 0,
    goldPoints: line("goldGained")?.points ?? 0,
    elites: line("elitesKilled")?.count ?? 0,
    bosses: line("bossesSlain")?.count ?? 0,
  };
  for (const key of Object.keys(got) as (keyof typeof got)[]) {
    if (key === "goldPoints" && run.game_mode === "blitz") continue; // no gold line on Blitz; the total still counts it
    if (got[key] !== truth[key]) mismatches.push(`${file}: ${key} ${got[key]} != game ${truth[key]}`);
  }

  // DAMAGE_LEADER / DEBUFFER compare ExtraFields across players; a history keeps neither, so the harness gives them back
  // to whoever recorded the badge. A file where nobody did (builds before the badge, e.g. v0.103.2) leaves every
  // player at 0 and the game's tie-break would pick the first: that input is unknowable, so those two are skipped.
  const unknowable = ["DAMAGE_LEADER", "DEBUFFER"].filter((id) => !truth.players.some((p) => p.recorded.some((b) => b.id === id)));
  const known = (badges: HarnessBadge[]) => badges.filter((b) => !unknowable.includes(b.id));
  for (const player of truth.players) {
    if (player.computedError || !player.computed) {
      mismatches.push(`${file}: harness GetBadges failed for player ${player.id}: ${player.computedError}`);
      continue;
    }
    const mine = sts2RunBadges(run, player.id);
    if (run.players.length > 1 && unknowable.some((id) => player.computed?.some((b) => b.id === id))) count("skipped (leader badge not in file)", run.build_id ?? "?");
    if (badgeKey(known(mine)) !== badgeKey(known(player.computed))) {
      mismatches.push(`${file} player ${player.id}: badges [${badgeKey(mine)}] != game [${badgeKey(player.computed)}]`);
    }
    if (badgeKey(mine) !== badgeKey(player.recorded)) {
      const key = `${run.build_id ?? "?"}: port [${badgeKey(mine)}] vs recorded [${badgeKey(player.recorded)}]`;
      recordedDiffs.set(key, [...(recordedDiffs.get(key) ?? []), file]);
    }
    for (const badge of mine) count("badge", `${badge.id}:${badge.rarity}`);
  }

  // The manual calculator (src/lib/sts2/score.ts) must accept every real run it models (no Blitz, no modifiers) as is.
  if (run.game_mode !== "blitz" && !run.modifiers?.length && run.map_point_history.length <= 3) {
    const floors = [0, 1, 2].map((act) => run.map_point_history[act]?.length ?? 0) as Sts2ScoreInput["floors"];
    const input: Sts2ScoreInput = {
      won: run.win,
      mode: run.game_mode === "dread" ? "dread" : "normal",
      ascension: run.ascension,
      players: run.players.length,
      floors,
      goldGained: run.map_point_history.flat().flatMap((p) => p.player_stats).reduce((sum, st) => sum + (st.gold_gained ?? 0), 0),
      elitesKilled: truth.elites,
      bossesSlain: truth.bosses,
    };
    const clamped = clampSts2ScoreInput(input);
    if (JSON.stringify(clamped) !== JSON.stringify(input)) {
      mismatches.push(`${file}: calculator clamps a real run ${JSON.stringify(input)} -> ${JSON.stringify(clamped)}`);
    } else if (sts2Score(input).total !== truth.score) {
      mismatches.push(`${file}: calculator total ${sts2Score(input).total} != game ${truth.score}`);
    }
    const elite = badgeKey(truth.players[0]?.computed?.filter((b) => b.id === "ELITE") ?? []);
    if (!run.was_abandoned && badgeKey(sts2BadgesFromInput(input)) !== elite) {
      mismatches.push(`${file}: calculator badges [${badgeKey(sts2BadgesFromInput(input))}] != game ELITE [${elite}]`);
    }
    count("calculator-checked", true);
  }

  const relicIds = run.players.flatMap((p) => p.relics.map((r) => r.id));
  count("game_mode", run.game_mode ?? "?");
  count("result", run.was_abandoned ? "abandoned" : run.win ? "win" : "loss");
  count("players", run.players.length);
  count("ascension", run.ascension);
  count("golden compass", relicIds.includes("RELIC.GOLDEN_COMPASS"));
  count("second boss (act with 2 boss points)", run.map_point_history.some((act) => act.filter((p) => p.map_point_type === "boss").length >= 2));
  count("custom (modifiers / is_custom_game / custom mode)", Boolean(run.modifiers?.length || run.is_custom_game || run.game_mode === "custom"));
  count("build", run.build_id ?? "?");
}

if (modelsPath) {
  const models = JSON.parse(readFileSync(modelsPath, "utf8")) as {
    cards: Record<string, { type: string; rarity: string; multiplayer: string }>;
    characters: Record<string, number>;
  };
  for (const [id, card] of Object.entries(models.cards)) {
    if (id.startsWith("MOCK_")) continue; // test-only models, never in a run
    const want = { curse: card.type === "Curse", basic: card.rarity === "Basic", multiplayerOnly: card.multiplayer === "MultiplayerOnly" };
    const facts = sts2BadgeCardFacts(id);
    if (JSON.stringify(facts) !== JSON.stringify(want)) mismatches.push(`card ${id}: port ${JSON.stringify(facts)} != game ${JSON.stringify(want)}`);
  }
  for (const [id, hp] of Object.entries(models.characters)) {
    if (sts2StartingHp(id) !== hp) mismatches.push(`character ${id}: port ${sts2StartingHp(id)} HP != game ${hp}`);
  }
  console.log(`models: ${Object.keys(models.cards).length} cards, ${Object.keys(models.characters).length} characters compared`);
}

console.log(`${files.length} run files in ${dir}`);
for (const [group, counts] of coverage) {
  const entries = [...counts].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
  console.log(`  ${group}: ${entries.map(([key, n]) => `${key}=${n}`).join("  ")}`);
}
const POOL = ["CCCCOMBO", "CURSES", "DAMAGE_LEADER", "DEBUFFER", "DOUBLE_SNECKO", "ELITE", "FAMISHED", "GLUTTON", "HEALER", "HIGHLANDER", "HONED",
  "BIG_DECK", "ILIKESHINY", "KACHING", "MONEY_MONEY", "MYSTERY_MACHINE", "PERFECT", "RESTFUL", "RESTLESS", "SPEEDY", "TABLET", "TEAM_PLAYER", "TINY_DECK"];
const seen = new Set([...(coverage.get("badge")?.keys() ?? [])].map((key) => key.split(":")[0]));
console.log(`  badges never seen: ${POOL.filter((id) => !seen.has(id)).join(", ") || "none"}`);
if (recordedDiffs.size > 0) {
  console.log(`port vs the badges recorded in the file (older builds' rules; informational):`);
  for (const [key, list] of recordedDiffs) console.log(`  ${list.length}x ${key} e.g. ${list[0]}`);
}
console.log(`mismatches: ${mismatches.length}`);
for (const mismatch of mismatches.slice(0, 50)) console.log(`  ${mismatch}`);
process.exit(mismatches.length > 0 ? 1 : 0);
