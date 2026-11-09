/**
 * Answer a contact inquiry, as the /dev/admin mailbox form does (scripts/admin/admin-writes.ts):
 * Supabase while source.contact is supabase, D1 and its outbox row while it is d1.
 *
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/admin/inquiry-reply.ts --env testbed|production --id <uuid> --response "text" [--status done]
 *   pnpm exec tsx scripts/admin/inquiry-reply.ts --env testbed --id <uuid> --status reviewing   (no response: clears it)
 *   options: --response-file <path> instead of --response; --dry-run (read the gate, print, write nothing);
 *            --local (the wrangler dev D1 under .wrangler/state; the Supabase path then needs --dry-run)
 *
 * --env names the D1 env that holds the inquiry: testbed for a development inquiry, production for
 * a production one. Exit 0 done, 1 refused or failed, 2 bad arguments.
 */
import { readFileSync } from "node:fs";

import { DATA_ENV_OF, isD1EnvName } from "../lib/d1-remote";
import { adminDeps } from "./admin-deps";
import { replyToContactInquiry } from "./admin-writes";
import { cliArgs, d1Mode, flag, option, runCli } from "./cli";

function usage(message: string): never {
  console.error(message);
  console.error("Usage: tsx scripts/admin/inquiry-reply.ts --env testbed|production --id <uuid> (--response <text> | --response-file <path>) [--status new|reviewing|done|spam] [--dry-run] [--local]");
  process.exit(2);
}

runCli(async () => {
  const argv = cliArgs();
  const env = option(argv, "--env");
  if (!isD1EnvName(env)) usage("--env testbed or --env production is required");
  const id = option(argv, "--id") ?? usage("--id is required");
  const file = option(argv, "--response-file");
  const response = file ? readFileSync(file, "utf8") : (option(argv, "--response") ?? "");
  const status = option(argv, "--status") ?? (response.trim() ? "done" : usage("--status is required without a response"));
  const deps = adminDeps({ mode: d1Mode(argv, usage), dryRun: flag(argv, "--dry-run"), log: (line) => console.log(line) });
  const result = await replyToContactInquiry(deps, { id, dataEnv: DATA_ENV_OF[env], response, status });
  if (result.dryRun) console.log("dry run: nothing written");
  else if (result.matched === false) console.log(`no inquiry ${id} in ${env}: nothing changed (as the Supabase update of a missing id)`);
  else console.log(`saved on ${result.store}${result.store === "d1" ? " with its outbox row (the mirror sends it to Supabase)" : ""}`);
});
