/**
 * The data env this bundle reads and writes: `production` or `development`
 * (docs/supabase-exit/STEP6_PLAN.md 1.1). It names the nav storage keys, is
 * checked against the nav snapshot's `env`, and goes in write bodies as `env`,
 * where it must match the Worker's API_DATA_ENV (workers/api/d1-write/handlers/toybox.ts).
 *
 * The value and the build variable name NEXT_PUBLIC_SUPABASE_ENV stay as they
 * are until step 7: changing either would reset every reader's nav state.
 * No imports, so the patch bundle and scripts can share it.
 */
export const dataEnv = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production";
