"use client";

import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import {
  DEFRAGMENT_BODY_MAX_CHARS,
  DEFRAGMENT_BODY_MIN_CHARS,
  DEFRAGMENT_BODY_STORAGE_MAX_CHARS,
} from "@/lib/content-limits";
import type { DefragmentFederatedService } from "@/lib/defragment";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export interface DefragmentBody {
  env: string;
  source_service: DefragmentFederatedService;
  source_id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  created_at: string;
  updated_at: string;
}

export function overlayBodyForSave(blocks: PostBlock[]):
  | { blocks: PostBlock[]; contentText: string }
  | null
  | "invalid" {
  const contentText = blocksToPlainText(blocks).trim();
  if (contentText.length === 0) return null;
  if (
    contentText.length < DEFRAGMENT_BODY_MIN_CHARS
    || contentText.length > DEFRAGMENT_BODY_MAX_CHARS
  ) {
    return "invalid";
  }
  return {
    blocks,
    contentText: contentText.length > DEFRAGMENT_BODY_STORAGE_MAX_CHARS
      ? contentText.slice(0, DEFRAGMENT_BODY_STORAGE_MAX_CHARS)
      : contentText,
  };
}

function normalizeBody(row: unknown): DefragmentBody | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.source_id !== "string"
    || typeof record.source_service !== "string"
    || typeof record.user_id !== "string"
  ) {
    return null;
  }
  return {
    env: typeof record.env === "string" ? record.env : supabaseEnv,
    source_service: record.source_service as DefragmentFederatedService,
    source_id: record.source_id,
    user_id: record.user_id,
    nickname: typeof record.nickname === "string" ? record.nickname : "",
    content: Array.isArray(record.content) ? record.content as PostBlock[] : [],
    content_text: typeof record.content_text === "string" ? record.content_text : "",
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}

export function isMissingDefragmentBodiesTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /defragment_bodies/i.test(error.message ?? "");
}

export async function fetchDefragmentBody(
  service: DefragmentFederatedService,
  sourceId: string,
): Promise<DefragmentBody | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await withSupabaseTimeout(
    "defragment_bodies.detail",
    supabase
      .from("defragment_bodies")
      .select("*")
      .eq("env", supabaseEnv)
      .eq("source_service", service)
      .eq("source_id", sourceId)
      .maybeSingle(),
  );
  if (error) {
    if (isMissingDefragmentBodiesTable(error)) return null;
    throw error;
  }
  return normalizeBody(data);
}

export async function upsertDefragmentBody(input: {
  service: DefragmentFederatedService;
  sourceId: string;
  blocks: PostBlock[];
  nickname: string;
  activeUserId: string;
}): Promise<DefragmentBody | null> {
  if (!supabaseEnabled) return null;
  const parsed = overlayBodyForSave(input.blocks);
  if (parsed == null || parsed === "invalid") return null;
  const nickname = input.nickname.trim();
  if (nickname.length < 1 || nickname.length > 20) return null;

  const { data, error } = await withSupabaseTimeout(
    "defragment_bodies.upsert",
    supabase
      .from("defragment_bodies")
      .upsert({
        env: supabaseEnv,
        source_service: input.service,
        source_id: input.sourceId,
        user_id: input.activeUserId,
        nickname,
        content: parsed.blocks,
        content_text: parsed.contentText,
        updated_at: new Date().toISOString(),
      }, { onConflict: "env,source_service,source_id" })
      .select()
      .single(),
  );
  if (error) {
    if (isMissingDefragmentBodiesTable(error)) return null;
    throw error;
  }
  return normalizeBody(data);
}
