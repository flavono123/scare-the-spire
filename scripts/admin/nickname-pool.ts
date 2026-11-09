/**
 * Save or reset the profile character nickname pools, as the /dev/admin nickname tab does
 * (scripts/admin/admin-writes.ts): Supabase while production's source.profile is supabase, the
 * production D1 and its outbox rows while it is d1; the testbed D1 directly while its own source is d1.
 *
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/admin/nickname-pool.ts --reset                  (the built-in defaults)
 *   pnpm exec tsx scripts/admin/nickname-pool.ts --file pools.json        ({"ko": [...], "en": [...]})
 *   options: --dry-run (read the gates, print, write nothing); --local (the wrangler dev D1)
 *
 * Exit 0 done, 1 refused or failed, 2 bad arguments.
 */
import { readFileSync } from "node:fs";

import { DEFAULT_PROFILE_NICKNAMES, parseNicknameLines, type ProfileNicknamePools } from "../../src/lib/profile-character-nicknames";
import { adminDeps } from "./admin-deps";
import { saveProfileNicknamePools } from "./admin-writes";
import { cliArgs, d1Mode, flag, option, runCli } from "./cli";

function usage(message: string): never {
  console.error(message);
  console.error("Usage: tsx scripts/admin/nickname-pool.ts (--reset | --file <pools.json>) [--dry-run] [--local]");
  process.exit(2);
}

function poolsFromFile(file: string): ProfileNicknamePools {
  const value = JSON.parse(readFileSync(file, "utf8")) as { ko?: unknown; en?: unknown };
  // The dev page's own parser (trim, de-duplicate, sort, check), one nickname per line.
  const ko = Array.isArray(value.ko) ? parseNicknameLines(value.ko.join("\n"), "ko") : null;
  const en = Array.isArray(value.en) ? parseNicknameLines(value.en.join("\n"), "en") : null;
  if (!ko || !en) usage(`${file}: ko and en must be lists of 1..50 nicknames of 1..20 characters`);
  return { ko, en };
}

runCli(async () => {
  const argv = cliArgs();
  const file = option(argv, "--file");
  const reset = flag(argv, "--reset");
  if (reset === Boolean(file)) usage("name one of --reset or --file");
  const pools = file ? poolsFromFile(file) : DEFAULT_PROFILE_NICKNAMES;
  const deps = adminDeps({ mode: d1Mode(argv, usage), dryRun: flag(argv, "--dry-run"), log: (line) => console.log(line) });
  const result = await saveProfileNicknamePools(deps, pools);
  console.log(result.dryRun ? "dry run: nothing written" : `saved: ${result.plans.map((plan) => (plan.store === "d1" ? `D1 ${plan.env}` : "Supabase")).join(", ")}`);
});
