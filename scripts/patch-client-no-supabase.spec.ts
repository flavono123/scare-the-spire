/**
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1, WP-P): the patch pages' static
 * comments client (copied unbundled to /_patches/patch-comments.js) calls only the
 * same-origin /api with the cookie identity. A static check of the source, since
 * the file is shipped as is: no Supabase host, REST or Auth path, key or bearer
 * header, and none of the legacy signals it used to read.
 * Usage: tsx scripts/patch-client-no-supabase.spec.ts [file]
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// An optional path checks another copy (for example the built /_patches/patch-comments.js).
const FILE = process.argv[2] ?? "src/components/patches/patch-comments-client.js";
const source = readFileSync(FILE, "utf8");

for (const [needle, why] of [
  ["supabase.co", "a Supabase host"],
  ["/rest/v1", "PostgREST"],
  ["/auth/v1", "Supabase Auth"],
  ["Authorization", "a bearer header"],
  ["Bearer", "a bearer token"],
  ["apikey", "the Supabase key header"],
  ["supabaseUrl", "the Supabase URL from the page config"],
  ["supabaseAnonKey", "the Supabase key from the page config"],
  ["slseoun_rf", "the path flag cookie (every call is on the api path)"],
  ["slseoun_idm", "the identity mode cookie (the cookie identity only)"],
  ["apiPathDefault", "the build-time path default"],
] as const) {
  assert.equal(source.includes(needle), false, `${FILE} must not contain ${JSON.stringify(needle)} (${why})`);
}

// Every fetch goes to a same-origin /api path: string literals, or template literals starting with /api/.
const fetchTargets = Array.from(source.matchAll(/\bfetch\(\s*([^,)]+)/g), (match) => match[1].trim());
assert.ok(fetchTargets.length > 0, "the client calls fetch");
for (const target of fetchTargets) {
  assert.ok(
    /^["'`]\/api\//.test(target) || target === "path" || target === "IDENTITY_CLAIM_PATH",
    `fetch target ${target} is a same-origin /api path`,
  );
}
assert.match(source, /const IDENTITY_CLAIM_PATH = "\/api\/auth\/claim";/);
// apiRequestOnce(path, ...) is only called with /api paths.
for (const match of source.matchAll(/\bapi(?:Request|WriteAsUser)\(\s*([^,)]+)/g)) {
  const target = match[1].trim();
  if (target === "path") continue;
  assert.ok(/^["'`]\/api\//.test(target), `api call target ${target} is a /api path`);
}

console.log("patch-client-no-supabase spec passed");
