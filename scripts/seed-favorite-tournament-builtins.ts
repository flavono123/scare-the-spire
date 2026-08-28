import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
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
const env = envFlag?.slice("--env=".length)
  ?? process.env.NEXT_PUBLIC_SUPABASE_ENV
  ?? "production";

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

  const rows = seeds.map((seed, index) => ({
    nickname: FAVORITE_TOURNAMENT_BUILTIN_NICKNAME,
    title: seed.title,
    note: seed.note,
    preset_key: seed.presetKey,
    game_version: FAVORITE_TOURNAMENT_GAME_VERSION,
    pool: seed.pool,
    env,
    created_at: new Date(Date.UTC(2026, 7, 28, 0, 0, index)).toISOString(),
  }));

  console.log(`Builtin worldcups: ${rows.length} for env=${env}`);
  for (const row of rows) {
    console.log(`  ${row.preset_key}  ${row.title}  (${row.pool.length})`);
  }
  if (dryRun) return;

  const tag = `ft${Date.now().toString(36)}`;
  const sql = `
insert into public.favorite_tournament_posts (
  user_id,
  nickname,
  title,
  note,
  preset_key,
  game_version,
  pool,
  env,
  created_at
)
select
  null,
  x.nickname,
  x.title,
  x.note,
  x.preset_key,
  x.game_version,
  x.pool,
  x.env,
  x.created_at
from jsonb_to_recordset($${tag}$${JSON.stringify(rows)}$${tag}$::jsonb) as x(
  nickname text,
  title text,
  note text,
  preset_key text,
  game_version text,
  pool jsonb,
  env text,
  created_at timestamptz
)
on conflict (env, preset_key) where (preset_key like 'builtin:%')
do update set
  nickname = excluded.nickname,
  title = excluded.title,
  note = excluded.note,
  pool = excluded.pool,
  game_version = excluded.game_version;
`;

  const dir = mkdtempSync(join(tmpdir(), "worldcup-seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql);
  const result = spawnSync("supabase", ["db", "query", "--linked", "-f", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`supabase db query failed with status ${result.status ?? "null"}`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
