/**
 * Upsert one 다채로운 철학자들 weekly post, as /dev/colorful-philosophers does (scripts/admin/admin-writes.ts):
 * Supabase while every write group of the env is on supabase, D1 and its outbox row once one is d1.
 *
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/admin/philosopher-post.ts --env testbed|production --week 2026-11-16 --slot topic|card|relic \
 *     --type card --id ABRASIVE --body "화두"
 *   options: --body-file <path> instead of --body; --dry-run; --local (the wrangler dev D1)
 *
 * --type/--id name a codex element (the page's search result); the names, image and game version come
 * from the codex as on the page. Exit 0 done, 1 refused or failed, 2 bad arguments.
 */
import { readFileSync } from "node:fs";

import { DATA_ENV_OF, isD1EnvName } from "../lib/d1-remote";
import { adminDeps } from "./admin-deps";
import { saveColorfulPhilosopherPostRow } from "./admin-writes";
import { cliArgs, d1Mode, flag, option, runCli } from "./cli";
import { philosopherPostRow } from "./philosopher-post-row";

function usage(message: string): never {
  console.error(message);
  console.error("Usage: tsx scripts/admin/philosopher-post.ts --env testbed|production --week YYYY-MM-DD --slot topic|card|relic --type <type> --id <id> (--body <text> | --body-file <path>) [--dry-run] [--local]");
  process.exit(2);
}

runCli(async () => {
  const argv = cliArgs();
  const env = option(argv, "--env");
  if (!isD1EnvName(env)) usage("--env testbed or --env production is required");
  const file = option(argv, "--body-file");
  const prepared = await philosopherPostRow({
    env: DATA_ENV_OF[env],
    weekStart: option(argv, "--week") ?? usage("--week is required"),
    slot: option(argv, "--slot") ?? usage("--slot is required"),
    resourceType: option(argv, "--type") ?? usage("--type is required"),
    resourceId: option(argv, "--id") ?? usage("--id is required"),
    body: file ? readFileSync(file, "utf8") : (option(argv, "--body") ?? ""),
  });
  if (!prepared.ok) usage(prepared.error);
  const deps = adminDeps({ mode: d1Mode(argv, usage), dryRun: flag(argv, "--dry-run"), log: (line) => console.log(line) });
  const result = await saveColorfulPhilosopherPostRow(deps, DATA_ENV_OF[env], prepared.row);
  if (result.dryRun) console.log("dry run: nothing written");
  else console.log(`saved on ${result.store}: ${JSON.stringify(result.saved)}`);
});
