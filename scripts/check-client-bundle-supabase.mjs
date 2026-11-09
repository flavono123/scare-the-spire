#!/usr/bin/env node
/**
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1, WP-Z): no browser asset may
 * carry the Supabase client, a Supabase host or path, or a Supabase key. The
 * browser calls only the same-origin /api.
 *
 * Usage: node scripts/check-client-bundle-supabase.mjs [asset directory ...]
 * With no argument it checks .cloudflare/assets and .patch-worker/assets, the
 * ones that exist. `cf:assets` and `patch:build` run it on their own output.
 * Every .js, .mjs and .html file under a directory is read.
 *
 * A hit prints the file, what matched and how often, never the text around it:
 * a matched key must not land in a build log.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_DIRECTORIES = [".cloudflare/assets", ".patch-worker/assets"];
const CHECKED_EXTENSIONS = new Set([".js", ".mjs", ".html"]);

/** [label, needle]: literal substrings, matched case-sensitively. */
const NEEDLES = [
  ["supabase-js auth client", "GoTrueClient"],
  ["supabase-js client", "SupabaseClient"],
  ["a @supabase/ package", "@supabase/"],
  ["supabase realtime-js", "realtime-js"],
  ["a Supabase host", "supabase.co"],
  ["the PostgREST path", "/rest/v1"],
  ["the Supabase Auth path", "/auth/v1"],
  // A publishable key (sb_publishable_...), and a legacy anon JWT, whose payload
  // starts {"iss":"supabase" (base64url).
  ["a Supabase publishable key", "sb_publishable_"],
  ["a legacy Supabase anon key", "eyJpc3MiOiJzdXBhYmFzZSI"],
];

/**
 * The key this checkout or CI step would have inlined, when it is in the
 * environment: its first characters are enough to find it, and are not printed.
 */
const configuredKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
if (configuredKey.length >= 16) NEEDLES.push(["the configured anon key", configuredKey.slice(0, 16)]);

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && CHECKED_EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

function count(haystack, needle) {
  let total = 0;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + needle.length)) total += 1;
  return total;
}

function isDirectory(directory) {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

const named = process.argv.slice(2);
const directories = named.length > 0 ? named : DEFAULT_DIRECTORIES.filter(isDirectory);
if (directories.length === 0) {
  console.error(`check-client-bundle-supabase: none of ${DEFAULT_DIRECTORIES.join(", ")} exists; build first.`);
  process.exit(1);
}

let failed = false;
for (const directory of directories) {
  if (!isDirectory(directory)) {
    console.error(`check-client-bundle-supabase: ${directory} is not a directory.`);
    failed = true;
    continue;
  }
  let files = 0;
  const hits = [];
  for (const file of walk(directory)) {
    files += 1;
    const text = readFileSync(file, "utf8");
    for (const [label, needle] of NEEDLES) {
      const found = count(text, needle);
      if (found > 0) hits.push(`${path.relative(directory, file)}: ${label} (${found}x)`);
    }
  }
  if (files === 0) {
    console.error(`check-client-bundle-supabase: ${directory} has no .js or .html file.`);
    failed = true;
  } else if (hits.length > 0) {
    console.error(`check-client-bundle-supabase: ${directory}: ${hits.length} Supabase trace(s) in browser assets:`);
    for (const hit of hits.slice(0, 50)) console.error(`  ${hit}`);
    if (hits.length > 50) console.error(`  ... and ${hits.length - 50} more`);
    failed = true;
  } else {
    console.log(`check-client-bundle-supabase: ${directory}: ${files} files, no Supabase client, host, path or key.`);
  }
}

process.exit(failed ? 1 : 0);
