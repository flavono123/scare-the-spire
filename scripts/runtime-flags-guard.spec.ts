/**
 * Step 6 WP-W (docs/supabase-exit/STEP6_PLAN.md): the Worker env defaults of a failed flags read
 * (P9-P12) and the flags CLI guard. After step 6 the browser has no legacy path and sends no bearer
 * token, so path.<group> legacy, identity.mode token and write.<group> rls stop what they govern;
 * scripts/runtime-flags.ts takes them only with --old-client (both Workers rolled back first).
 *
 * The CLI checks never reach wrangler: every spawned command leaves out --note, which the script
 * checks after the guard and before any `d1 execute`, and names --local.
 *
 * Run: pnpm exec tsx scripts/runtime-flags-guard.spec.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { API_SURFACE_GROUPS, pathFlagKey, readFlagKey, shadowFlagKey } from "../src/lib/api-surfaces";
import { WRITE_FLAG_GROUPS, writeFlagKey } from "../src/lib/api-write-modes";
import { IDENTITY_MODE_KEY } from "../src/lib/identity-cookies";
import { WRITE_GROUPS, WRITE_PAUSED_KEY, sourceFlagKey } from "../src/lib/write-source-flags";
import { SYNC_FLAG_KEY } from "../workers/sync/sync-env";
import { checkFlagSet, KNOWN_KEYS, type FlagSetCheck } from "./runtime-flag-keys";

let checks = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

type Target = Parameters<typeof checkFlagSet>[2];

const TESTBED_REMOTE: Target = { env: "testbed", remote: true, confirmProduction: false };
const TESTBED_LOCAL: Target = { env: "testbed", remote: false, confirmProduction: false };
const PRODUCTION_LOCAL: Target = { env: "production", remote: false, confirmProduction: false };
const PRODUCTION_CONFIRMED: Target = { env: "production", remote: true, confirmProduction: true };
const EVERY_TARGET = [TESTBED_REMOTE, TESTBED_LOCAL, PRODUCTION_LOCAL, PRODUCTION_CONFIRMED];

function message(result: FlagSetCheck): string {
  return result.ok ? "" : result.message;
}

/** The value is refused on every target without --old-client and taken with it. */
function assertOldClientOnly(key: string, value: string) {
  assert.ok(KNOWN_KEYS.get(key)?.accepts(value), `${key} ${value} is still a value the key takes`);
  for (const target of EVERY_TARGET) {
    const refused = checkFlagSet(key, value, target);
    assert.equal(refused.ok, false, `${key} ${value} is refused without --old-client (${target.env}, remote=${target.remote})`);
    assert.match(message(refused), /needs --old-client/);
    assert.match(message(refused), /pre-step-6/);
    assert.match(message(refused), /source\.<group>/, "the refusal names the storage rollback");
    assert.deepEqual(checkFlagSet(key, value, { ...target, oldClient: true }), { ok: true }, `${key} ${value} with --old-client`);
  }
  // --old-client does not replace the production confirmation.
  const unconfirmed = checkFlagSet(key, value, { env: "production", remote: true, confirmProduction: false, oldClient: true });
  assert.equal(unconfirmed.ok, false);
  assert.match(message(unconfirmed), /--confirm-production/);
}

function assertTaken(key: string, value: string) {
  for (const target of EVERY_TARGET) {
    assert.deepEqual(checkFlagSet(key, value, target), { ok: true }, `${key} ${value} needs no --old-client`);
  }
}

/** Runs the flags CLI without --note, so it exits before any wrangler call. */
function cli(args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/runtime-flags.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, WRANGLER_WRITE_LOGS: "0" },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function main() {
  check("wrangler.jsonc: P9-P12 env defaults in production and testbed", () => {
    const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
    for (const [name, vars] of [["production", config.vars], ["testbed", config.env?.testbed?.vars]] as const) {
      assert.equal(vars?.API_RUNTIME_FLAGS, "d1", `${name}: API_RUNTIME_FLAGS`);
      assert.equal(vars?.API_PATH_DEFAULT, "api", `${name}: API_PATH_DEFAULT (P9)`);
      assert.equal(vars?.API_WRITE_MODE_DEFAULT, "worker", `${name}: API_WRITE_MODE_DEFAULT (P10)`);
      assert.equal(vars?.API_WRITE_SOURCE_DEFAULT, "d1", `${name}: API_WRITE_SOURCE_DEFAULT (P11)`);
      assert.equal(vars?.API_IDENTITY_MODE_DEFAULT, "cookie", `${name}: API_IDENTITY_MODE_DEFAULT (P12)`);
    }
  });

  check("path.<group> legacy needs --old-client for every group; api does not", () => {
    for (const group of API_SURFACE_GROUPS) {
      assertOldClientOnly(pathFlagKey(group), "legacy");
      assert.match(message(checkFlagSet(pathFlagKey(group), "legacy", TESTBED_REMOTE)), new RegExp(`of ${group} answers 409`));
      assertTaken(pathFlagKey(group), "api");
    }
  });

  check("identity.mode token needs --old-client; cookie does not", () => {
    assertOldClientOnly(IDENTITY_MODE_KEY, "token");
    assert.match(message(checkFlagSet(IDENTITY_MODE_KEY, "token", TESTBED_REMOTE)), /no bearer token/);
    assertTaken(IDENTITY_MODE_KEY, "cookie");
  });

  check("write.<group> rls needs --old-client for every write group; worker does not", () => {
    for (const group of WRITE_FLAG_GROUPS) {
      assertOldClientOnly(writeFlagKey(group), "rls");
      assert.match(message(checkFlagSet(writeFlagKey(group), "rls", TESTBED_REMOTE)), new RegExp(`${group} writes`));
      assertTaken(writeFlagKey(group), "worker");
    }
  });

  check("the step 6 rollback keys and the other keys keep their rules", () => {
    for (const group of WRITE_GROUPS) {
      assertTaken(sourceFlagKey(group), "supabase");
      assertTaken(sourceFlagKey(group), "d1");
    }
    for (const group of API_SURFACE_GROUPS) {
      assertTaken(readFlagKey(group), "supabase");
      assertTaken(readFlagKey(group), "d1");
      assertTaken(shadowFlagKey(group), "0");
    }
    for (const value of ["on", "off"]) {
      assertTaken(SYNC_FLAG_KEY, value);
      assertTaken(WRITE_PAUSED_KEY, value);
    }
    // Production still needs the confirmation for every key.
    const production = checkFlagSet(pathFlagKey("nav"), "api", { env: "production", remote: true, confirmProduction: false });
    assert.equal(production.ok, false);
    assert.match(message(production), /--confirm-production/);
  });

  check("unknown keys and bad values are reported before the guard", () => {
    assert.equal(message(checkFlagSet("path.nowhere", "legacy", TESTBED_REMOTE)), "unknown key: path.nowhere");
    assert.equal(message(checkFlagSet(pathFlagKey("nav"), "bogus", TESTBED_REMOTE)), "value for path.nav must be legacy, api");
    assert.equal(message(checkFlagSet(IDENTITY_MODE_KEY, undefined, TESTBED_REMOTE)), "value for identity.mode must be token, cookie");
    assert.equal(message(checkFlagSet(writeFlagKey("comments"), "d1", { ...TESTBED_REMOTE, oldClient: true })), "value for write.comments must be rls, worker");
  });

  check("CLI: refuses the old-client values before wrangler, and takes them with --old-client", () => {
    for (const [key, value] of [
      [pathFlagKey("comments"), "legacy"],
      [IDENTITY_MODE_KEY, "token"],
      [writeFlagKey("contact"), "rls"],
    ]) {
      const refused = cli(["set", key, value, "--env", "testbed", "--local"]);
      assert.equal(refused.status, 2, `${key} ${value}: usage exit\n${refused.stderr}`);
      assert.match(refused.stderr, new RegExp(`${key.replace(/\./g, "\\.")} ${value} needs --old-client`));
      assert.doesNotMatch(refused.stderr, /--note is required/, "the guard runs before the note check");

      // With --old-client the guard passes; the missing note then stops it before any wrangler call.
      const passed = cli(["set", key, value, "--env", "testbed", "--local", "--old-client"]);
      assert.equal(passed.status, 2, `${key} ${value} --old-client: usage exit\n${passed.stderr}`);
      assert.match(passed.stderr, /--note is required/);
      assert.doesNotMatch(passed.stderr, /needs --old-client/);
    }
    const taken = cli(["set", pathFlagKey("comments"), "api", "--env", "testbed", "--local"]);
    assert.equal(taken.status, 2);
    assert.match(taken.stderr, /--note is required/, "api passes the guard without --old-client");
    const usage = cli(["set", "--env", "testbed", "--local"]);
    assert.match(usage.stderr, /--old-client: path legacy, identity\.mode token and write rls/);
  });

  console.log(`runtime-flags-guard spec passed (${checks} checks)`);
}

main();
