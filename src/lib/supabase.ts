import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

export const supabaseEnv = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production";

export const supabase: SupabaseClient = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient);
