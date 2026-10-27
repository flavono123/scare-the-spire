import type { PostBlock } from "@/lib/chemical-types";
import type { ComboResourceRef } from "@/lib/combo-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { asComboResources, asPostBlocks } from "@/lib/toybox-post-og";

/**
 * Supabase-backed OG field loaders for Toy Box detail pages. Kept apart from
 * the pure helpers in `toybox-post-og.ts` so the main Worker's detail-shell OG
 * enrichment does not bundle supabase-js.
 */

async function selectToyBoxOgRow<T>(
  operation: string,
  table: string,
  id: string,
  columns: string,
): Promise<T | null> {
  if (!supabaseEnabled || !id) return null;
  const result = await withSupabaseTimeout(
    operation,
    supabase
      .from(table)
      .select(columns)
      .eq("id", id)
      .eq("env", supabaseEnv)
      .maybeSingle(),
  ).catch(() => ({ data: null, error: true }));
  if ("error" in result && result.error) return null;
  if (!result.data) return null;
  return result.data as T;
}

export async function getTransfigurePostOgFields(id: string): Promise<{
  title: string | null;
  transformedName: string | null;
  resourceType: string;
  resourceId: string;
} | null> {
  const row = await selectToyBoxOgRow<{
    title: string | null;
    transformed_name: string | null;
    resource_type: string;
    resource_id: string;
  }>(
    "transfigure_posts.select.og-fields",
    "transfigure_posts",
    id,
    "title, transformed_name, resource_type, resource_id",
  );
  if (!row?.resource_type || !row.resource_id) return null;
  return {
    title: row.title,
    transformedName: row.transformed_name,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
  };
}

export async function getComboPostOgFields(id: string): Promise<{
  contentText: string;
  content: PostBlock[];
  resources: ComboResourceRef[];
} | null> {
  const row = await selectToyBoxOgRow<{
    content_text: string | null;
    content: unknown;
    resources: unknown;
  }>(
    "combo_posts.select.og-fields",
    "combo_posts",
    id,
    "content_text, content, resources",
  );
  if (!row) return null;
  return {
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: asPostBlocks(row.content),
    resources: asComboResources(row.resources),
  };
}

export async function getThisOrThatPostOgFields(id: string): Promise<{
  reason: string;
  leftType: string;
  leftId: string;
} | null> {
  const row = await selectToyBoxOgRow<{
    reason: string | null;
    left_type: string;
    left_id: string;
  }>(
    "this_or_that_posts.select.og-fields",
    "this_or_that_posts",
    id,
    "reason, left_type, left_id",
  );
  if (!row?.left_type || !row.left_id) return null;
  return {
    reason: typeof row.reason === "string" ? row.reason : "",
    leftType: row.left_type,
    leftId: row.left_id,
  };
}

export async function getPagestormPostOgFields(id: string): Promise<{
  title: string;
  contentText: string;
  content: unknown;
} | null> {
  const row = await selectToyBoxOgRow<{
    title: string | null;
    content_text: string | null;
    content: unknown;
  }>(
    "pagestorm_posts.select.og-fields",
    "pagestorm_posts",
    id,
    "title, content_text, content",
  );
  if (!row) return null;
  return {
    title: typeof row.title === "string" ? row.title : "",
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: row.content,
  };
}

export async function getDefragmentPostOgFields(id: string): Promise<{
  title: string;
  contentText: string;
  content: PostBlock[];
} | null> {
  const row = await selectToyBoxOgRow<{
    title: string | null;
    content_text: string | null;
    content: unknown;
  }>(
    "defragment_posts.select.og-fields",
    "defragment_posts",
    id,
    "title, content_text, content",
  );
  if (!row) return null;
  return {
    title: typeof row.title === "string" ? row.title : "",
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: asPostBlocks(row.content),
  };
}

export async function getChemicalPostOgFields(id: string): Promise<{
  contentText: string;
  content: PostBlock[];
} | null> {
  const row = await selectToyBoxOgRow<{
    content_text: string | null;
    content: unknown;
  }>(
    "chemical_posts.select.og-fields",
    "chemical_posts",
    id,
    "content_text, content",
  );
  if (!row) return null;
  return {
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: asPostBlocks(row.content),
  };
}
