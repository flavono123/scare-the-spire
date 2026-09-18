import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { normalizeTransfigurePost, type TransfigurePost } from "@/lib/transfigure-types";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "@/lib/transfigure-builtins";

function getClient(): { client: SupabaseClient; env: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv ?? "production";

  if (url && key) {
    return { client: createClient(url, key), env };
  }
  if (supabaseEnabled && supabase) {
    return { client: supabase, env: supabaseEnv };
  }
  return null;
}

const cache = new Map<string, Promise<TransfigurePost[]>>();

export function getRecentTransfigurePosts(limit = 15): Promise<TransfigurePost[]> {
  const cacheKey = `${process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv}:${limit}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const promise = fetchRecentTransfigurePosts(limit);
  cache.set(cacheKey, promise);
  return promise;
}

async function fetchRecentTransfigurePosts(limit = 15): Promise<TransfigurePost[]> {
  const resolved = getClient();
  if (!resolved) return [...BUILTIN_SAMPLE_TRANSFIGURES];

  try {
    const { data, error } = await resolved.client
      .from("transfigure_posts")
      .select("*")
      .eq("env", resolved.env)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      if (resolved.env !== "production") {
        const { data: prodData } = await resolved.client
          .from("transfigure_posts")
          .select("*")
          .eq("env", "production")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (prodData && prodData.length > 0) {
          const norm = prodData.map(normalizeTransfigurePost);
          if (norm.length > 0) return norm;
        }
      }
      return [...BUILTIN_SAMPLE_TRANSFIGURES];
    }

    const normalized = data.map(normalizeTransfigurePost);
    return normalized.length > 0 ? normalized : [...BUILTIN_SAMPLE_TRANSFIGURES];
  } catch {
    return [...BUILTIN_SAMPLE_TRANSFIGURES];
  }
}

