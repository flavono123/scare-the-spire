import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildQuerySignal, reportBuildDataFailure } from "@/lib/build-supabase-read";
import { supabase, supabaseClientOptions, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { normalizeTransfigurePost, type TransfigurePost } from "@/lib/transfigure-types";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "@/lib/transfigure-builtins";

function getClient(): { client: SupabaseClient; env: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? supabaseEnv ?? "production";

  if (url && key) {
    return { client: createClient(url, key, supabaseClientOptions), env };
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
  promise.catch(() => cache.delete(cacheKey));
  return promise;
}

function queryPosts(client: SupabaseClient, env: string, limit: number) {
  return client
    .from("transfigure_posts")
    .select("*")
    .eq("env", env)
    .order("created_at", { ascending: false })
    .limit(limit)
    .abortSignal(buildQuerySignal());
}

/** Rows of `env`; a build that is not production borrows production's when it has none. */
async function fetchNormalizedPosts(client: SupabaseClient, env: string, limit: number): Promise<TransfigurePost[]> {
  const { data, error } = await queryPosts(client, env, limit);
  if (error) throw error;
  const posts = (data ?? []).map(normalizeTransfigurePost);
  if (posts.length > 0) return posts;
  if (env === "production") throw new Error("transfigure_posts has no rows");

  const { data: productionData, error: productionError } = await queryPosts(client, "production", limit);
  if (productionError) throw productionError;
  const productionPosts = (productionData ?? []).map(normalizeTransfigurePost);
  if (productionPosts.length > 0) return productionPosts;
  throw new Error("transfigure_posts has no rows");
}

async function fetchRecentTransfigurePosts(limit = 15): Promise<TransfigurePost[]> {
  const resolved = getClient();
  if (!resolved) {
    reportBuildDataFailure("transfigure_posts", "Supabase is not configured");
    return [...BUILTIN_SAMPLE_TRANSFIGURES];
  }

  try {
    return await fetchNormalizedPosts(resolved.client, resolved.env, limit);
  } catch (cause) {
    reportBuildDataFailure("transfigure_posts", cause);
    return [...BUILTIN_SAMPLE_TRANSFIGURES];
  }
}
