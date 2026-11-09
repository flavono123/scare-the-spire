import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dataEnv } from "@/lib/data-env";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

/** Moved to src/lib/data-env.ts (`dataEnv`); re-exported until step 6 drops this module (WP-Z). */
export const supabaseEnv = dataEnv;

/** Moved to src/lib/db-errors.ts; re-exported until step 6 drops this module (WP-Z). */
export { isCheckViolation } from "@/lib/db-errors";

// postgrest-js retries GET and HEAD three times by default, over about seven
// seconds. Pages show their own failure notice, so a retry only delays it and
// multiplies client traffic against a Supabase project that is already down.
export const supabaseClientOptions = { db: { retry: false } };

export const supabase: SupabaseClient = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, supabaseClientOptions)
  : (null as unknown as SupabaseClient);
