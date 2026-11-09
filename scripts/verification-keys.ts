/**
 * Lists, adds and revokes the Supabase token signing keys the Worker trusts (D1
 * `api_verification_keys`, workers/api/verification-keys.ts; docs/supabase-exit/STEP1_DESIGN.md 6).
 * The compiled-in key (workers/api/supabase-jwks.ts) is the seed: it counts unless a row with its kid
 * says otherwise. Workers pick a change up within about a minute.
 *
 * Usage:
 *   tsx scripts/verification-keys.ts list --env testbed|production --remote|--local
 *   tsx scripts/verification-keys.ts add --jwk '<one key of <project>/auth/v1/.well-known/jwks.json>' --env ... --note "why"
 *   tsx scripts/verification-keys.ts revoke <kid> --env ... --note "why"
 *   tsx scripts/verification-keys.ts unrevoke <kid> --env ... --note "why"    (rollback of a revoke)
 *
 * Revoking: a revoked kid is refused even while Supabase's JWKS still lists it. Rotate in Supabase first
 * (a new key signs new sessions) and `add` the new key, then `revoke` the old one. A browser whose access
 * token was signed by the revoked key gets token_invalid on every /api/me and /api/write call (and on a
 * claim with that token). The client does not refresh on token_invalid (only on token_expired): the error
 * lasts until supabase-js refreshes the session on its own schedule, shortly before the token expires
 * (access token lifetime, 1 hour by default; the new token is signed with the new key), or until it claims
 * again with a refreshed token. Signed-cookie identities that already claimed do not depend on the key.
 * So after a planned rotation wait at least one access token lifetime before revoking; revoke at once only
 * for a leaked key, accepting up to that long of failing calls. After revoking a compiled-in key, drop it
 * from supabase-jwks.ts in the next deploy too: that list alone counts in an isolate whose first D1 read
 * failed.
 *
 * Same target rules as scripts/runtime-flags.ts: --env and --remote|--local are required (wrangler's
 * default is local), and writing to production also needs --confirm-production, only after the user
 * approves.
 */
import { spawnSync } from "node:child_process";

import { PINNED_SUPABASE_JWKS } from "../workers/api/supabase-jwks";
import {
  addStatements,
  bindLiterals,
  cleanNote,
  KEY_SQL,
  parseJwkArgument,
  revokeStatements,
  unrevokeStatements,
  validKid,
} from "./lib/verification-key-commands";

type Target = { env: "testbed" | "production"; remote: boolean };

const DATABASES = { testbed: "slseoun-testbed", production: "slseoun-prod" } as const;

function usage(message?: string): never {
  if (message) console.error(message);
  console.error([
    "Usage:",
    "  tsx scripts/verification-keys.ts list --env testbed|production --remote|--local",
    "  tsx scripts/verification-keys.ts add --jwk '<JWK JSON>' --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/verification-keys.ts revoke <kid> --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
    "  tsx scripts/verification-keys.ts unrevoke <kid> --env testbed|production --remote|--local --note \"why\" [--confirm-production]",
  ].join("\n"));
  process.exit(2);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function execute(target: Target, sql: string): unknown {
  const args = ["exec", "wrangler", "d1", "execute", "DB", target.remote ? "--remote" : "--local", "--yes", "--json", "--command", sql];
  if (target.env === "testbed") args.push("--env", "testbed");
  const result = spawnSync("pnpm", args, { encoding: "utf8", env: { ...process.env, WRANGLER_WRITE_LOGS: "0" } });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return result.stdout;
  }
}

function rows(output: unknown, index: number): Record<string, unknown>[] {
  if (!Array.isArray(output)) return [];
  const entry = output[index] as { results?: Record<string, unknown>[] } | undefined;
  return entry?.results ?? [];
}

function shown(row: Record<string, unknown>): Record<string, unknown> {
  const time = (value: unknown) => (typeof value === "number" ? new Date(value).toISOString() : value);
  return { ...row, added_at: time(row.added_at), revoked_at: time(row.revoked_at) };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const [command, ...rest] = argv;
  const env = option(rest, "--env");
  if (env !== "testbed" && env !== "production") usage("--env testbed or --env production is required");
  const remote = rest.includes("--remote");
  const local = rest.includes("--local");
  if (remote === local) usage("name the target: --remote (Cloudflare) or --local (wrangler dev)");
  const target: Target = { env, remote };
  const where = `${DATABASES[env]}${remote ? " (remote)" : " (local)"}`;
  console.log(`target: ${where}`);

  if (command === "list") {
    const stored = rows(execute(target, `${KEY_SQL.list};`), 0);
    console.log(`api_verification_keys in ${where}:`);
    console.table(stored.map(shown));
    const kids = new Set(stored.map((row) => row.kid));
    const seedOnly = PINNED_SUPABASE_JWKS.filter((key) => !kids.has(key.kid));
    if (seedOnly.length) console.log(`compiled-in keys with no row (trusted): ${seedOnly.map((key) => key.kid).join(", ")}`);
    return;
  }

  if (command !== "add" && command !== "revoke" && command !== "unrevoke") usage();
  const note = cleanNote(option(rest, "--note"));
  if (!note) usage("--note is required");
  if (env === "production" && target.remote && !rest.includes("--confirm-production")) {
    usage("changing production needs --confirm-production (after the user approves)");
  }
  const now = Date.now();
  let kid: string;
  let statements: string[];
  if (command === "add") {
    const parsed = parseJwkArgument(option(rest, "--jwk"));
    if (!parsed.ok) usage(parsed.message);
    kid = parsed.key.kid;
    statements = addStatements(parsed.key, note, now);
  } else {
    const named = rest[0];
    if (!validKid(named) || named.startsWith("--")) usage(`${command} needs a kid`);
    kid = named;
    statements = command === "revoke" ? revokeStatements(kid, note, now, PINNED_SUPABASE_JWKS) : unrevokeStatements(kid, note);
  }
  execute(target, statements.map((statement) => `${statement};`).join("\n"));
  const readBack = rows(execute(target, `${bindLiterals(KEY_SQL.one, [kid])};`), 0)[0];
  const ok = command === "add"
    ? readBack?.added_at === now && readBack.revoked_at === null
    : command === "revoke"
      ? typeof readBack?.revoked_at === "number"
      : !readBack || readBack.revoked_at === null;
  if (!ok) {
    console.error(`read-back mismatch in ${where}:`, readBack ? shown(readBack) : "(no row)");
    process.exit(1);
  }
  console.table(readBack ? [shown(readBack)] : []);
  console.log(`${command} ${kid} in ${where}. Workers pick it up within about a minute.`);
}

main();
