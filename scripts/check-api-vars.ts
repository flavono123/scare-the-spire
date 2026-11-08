/**
 * Fails before a deploy when the Worker API vars are missing or malformed
 * (docs/supabase-exit/STEP1_DESIGN.md 2.1, 10). `--keep-vars` keeps old values,
 * so a bad value would otherwise persist silently across deploys.
 *
 * Usage: API_SUPABASE_URL=… API_SUPABASE_KEY=… API_DATA_ENV=… tsx scripts/check-api-vars.ts --expect-env production|development
 * Prints the project host and env, never the key.
 */
import { supabaseApiConfig } from "../workers/api/supabase-rest";

const index = process.argv.indexOf("--expect-env");
const expected = index >= 0 ? process.argv[index + 1] : undefined;
if (expected !== "production" && expected !== "development") {
  console.error("usage: tsx scripts/check-api-vars.ts --expect-env production|development");
  process.exit(2);
}

const config = supabaseApiConfig({
  API_SUPABASE_URL: process.env.API_SUPABASE_URL,
  API_SUPABASE_KEY: process.env.API_SUPABASE_KEY,
  API_DATA_ENV: process.env.API_DATA_ENV,
});
if (!config) {
  console.error(
    "API_SUPABASE_URL must be https://<20-char ref>.supabase.co, API_SUPABASE_KEY a sb_publishable_ key, "
      + "and API_DATA_ENV production or development.",
  );
  process.exit(1);
}
if (config.dataEnv !== expected) {
  console.error(`API_DATA_ENV is ${config.dataEnv}, expected ${expected}.`);
  process.exit(1);
}
console.log(`API vars ok: ${new URL(config.url).host}, env ${config.dataEnv}`);
