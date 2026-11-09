/**
 * Seeds the builtin 이아저? 월드컵 tournaments (pnpm worldcup:seed) for each env, through
 * scripts/admin/admin-writes.ts: while an env's source.toybox-feed is supabase, the same SQL as
 * before on the linked project (`supabase db query --linked`); while it is d1, that env's D1 rows
 * and outbox rows, which the step 5 mirror sends to Supabase.
 *
 *   set -a && source .env.local && set +a
 *   pnpm worldcup:seed [--env=production|development] [--dry-run] [--local]
 *
 * --dry-run lists the presets, reads each env's write gate and prints what would run. --local uses
 * the wrangler dev D1 (the Supabase path then needs --dry-run).
 */
import { adminDeps } from "./admin/admin-deps";
import { seedBuiltinTournaments, type BuiltinTournamentRow } from "./admin/admin-writes";
import { runCli } from "./admin/cli";
import { getDecisionsDecisionsGameCopy } from "../src/lib/borrowed-game-copy";
import { decisionsPresetLabel } from "../src/lib/decisions-preset-label";
import {
  buildFavoriteTournamentBuiltinSeeds,
  FAVORITE_TOURNAMENT_BUILTIN_NICKNAME,
  FAVORITE_TOURNAMENT_GAME_VERSION,
} from "../src/lib/favorite-tournament";
import { loadCompactThisOrThatEntities } from "../src/lib/this-or-that-data";
import { serviceMessages } from "../src/messages/service";

const dryRun = process.argv.includes("--dry-run");
const envFlag = process.argv.find((arg) => arg.startsWith("--env="));
// Local `.env.local` uses `development`; production Workers use `production`.
const DEFAULT_ENVS = ["production", "development"] as const;
const envs = envFlag
  ? [envFlag.slice("--env=".length)]
  : [...new Set([
    ...DEFAULT_ENVS,
    process.env.NEXT_PUBLIC_SUPABASE_ENV,
  ].filter((value): value is string => Boolean(value)))];

function ancientNamesFromEntities(
  entities: Awaited<ReturnType<typeof loadCompactThisOrThatEntities>>,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const entity of entities) {
    if (entity.type === "ancient") names.set(entity.id, entity.nameKo);
  }
  return names;
}

async function main() {
  const [entities, decisionsCopy] = await Promise.all([
    loadCompactThisOrThatEntities({ gameLocale: "kor" }),
    getDecisionsDecisionsGameCopy("kor"),
  ]);
  const copy = serviceMessages.ko.decisionsDecisions;
  const monsterTypes = serviceMessages.ko.codex.monstersView.monsterTypes;
  const ancientNames = ancientNamesFromEntities(entities);
  const seeds = buildFavoriteTournamentBuiltinSeeds(entities, (def) => (
    decisionsPresetLabel(
      def,
      decisionsCopy.presetLabels,
      copy,
      ancientNames,
      monsterTypes,
    )
  ));
  if (seeds.length === 0) {
    throw new Error("No builtin worldcup seeds (pools too small or catalog empty).");
  }

  const rows: BuiltinTournamentRow[] = envs.flatMap((env) => seeds.map((seed, index) => ({
    nickname: FAVORITE_TOURNAMENT_BUILTIN_NICKNAME,
    title: seed.title,
    note: seed.note,
    preset_key: seed.presetKey,
    game_version: FAVORITE_TOURNAMENT_GAME_VERSION,
    pool: seed.pool,
    env,
    created_at: new Date(Date.UTC(2026, 7, 28, 0, 0, index)).toISOString(),
  })));

  console.log(`Builtin worldcups: ${seeds.length} presets × ${envs.join(", ")}`);
  for (const seed of seeds) {
    console.log(`  ${seed.presetKey}  ${seed.title}  (${seed.pool.length})`);
  }

  const deps = adminDeps({
    mode: process.argv.includes("--local") ? "local" : "remote",
    dryRun,
    cli: true,
    log: (line) => console.log(line),
  });
  const tag = `ft${Date.now().toString(36)}`;
  const result = await seedBuiltinTournaments(deps, rows, tag);
  if (result.dryRun) console.log("dry run: nothing written");
}

runCli(main);
