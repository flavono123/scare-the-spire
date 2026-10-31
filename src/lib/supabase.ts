import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

export const supabaseEnv = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production";

// postgrest-js retries GET and HEAD three times by default, over about seven
// seconds. Pages show their own failure notice, so a retry only delays it and
// multiplies client traffic against a Supabase project that is already down.
export const supabaseClientOptions = { db: { retry: false } };

export const supabase: SupabaseClient = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, supabaseClientOptions)
  : (null as unknown as SupabaseClient);
