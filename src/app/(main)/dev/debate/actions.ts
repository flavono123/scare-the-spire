"use server";

import { createClient } from "@supabase/supabase-js";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  DEBATE_CYCLES_TABLE,
  DEBATE_GAME_VERSION,
  debateSubjectFromRow,
  debateSubjectHref,
  isDebateResourceType,
  isMissingDebateCyclesTable,
  type DebateSubject,
} from "@/lib/debate-cycle";
import { supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

type OpenDebateCycleResult =
  | { ok: true; subject: DebateSubject }
  | { ok: false; error: string };

function createDebateAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let entityLookup: Promise<Map<string, {
  id: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
}>> | null = null;

function lookupKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId.toLowerCase()}`;
}

function debateEntityLookup() {
  entityLookup ??= loadAllEntities({ gameLocale: "kor" }).then((entities) => {
    const map = new Map<string, {
      id: string;
      nameKo: string;
      nameEn: string;
      imageUrl: string | null;
    }>();
    for (const entity of entities) {
      if (!isDebateResourceType(entity.type)) continue;
      map.set(lookupKey(entity.type, entity.id), {
        id: entity.id,
        nameKo: entity.nameKo,
        nameEn: entity.nameEn,
        imageUrl: entity.imageUrl,
      });
    }
    return map;
  });
  return entityLookup;
}

export async function openDebateCycle(input: {
  resourceType: string;
  resourceId: string;
}): Promise<OpenDebateCycleResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "개발 서버에서만 지목할 수 있습니다." };
  }
  if (!isDebateResourceType(input.resourceType)) {
    return { ok: false, error: "이 종류의 백과사전 요소는 지목할 수 없습니다." };
  }

  const resourceId = input.resourceId.trim();
  if (!resourceId) {
    return { ok: false, error: "백과사전 주소를 만들 수 없습니다." };
  }

  const admin = createDebateAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SECRET_KEY가 없습니다." };
  }
  if (supabaseEnv !== "production" && supabaseEnv !== "development") {
    return { ok: false, error: "알 수 없는 Supabase 환경입니다." };
  }

  const entity = (await debateEntityLookup()).get(lookupKey(input.resourceType, resourceId));
  const href = entity ? debateSubjectHref(input.resourceType, entity.id) : null;
  if (!entity?.nameKo || !entity.nameEn || !href) {
    return { ok: false, error: "백과사전에서 그 요소를 찾지 못했습니다." };
  }

  const openedAt = new Date().toISOString();
  try {
    const closed = await withSupabaseTimeout(
      "dev.debate_cycles.close",
      admin
        .from(DEBATE_CYCLES_TABLE)
        .update({ closed_at: openedAt })
        .eq("env", supabaseEnv)
        .is("closed_at", null),
    );
    if (closed.error) {
      if (isMissingDebateCyclesTable(closed.error)) {
        return { ok: false, error: "debate_cycles 마이그레이션이 필요합니다." };
      }
      return { ok: false, error: closed.error.message };
    }

    const inserted = await withSupabaseTimeout(
      "dev.debate_cycles.insert",
      admin
        .from(DEBATE_CYCLES_TABLE)
        .insert({
          env: supabaseEnv,
          resource_type: input.resourceType,
          resource_id: entity.id,
          name_ko: entity.nameKo,
          name_en: entity.nameEn,
          image_url: entity.imageUrl,
          href,
          game_version: DEBATE_GAME_VERSION,
        })
        .select("id, resource_type, resource_id, name_ko, name_en, image_url, href, game_version, opened_at")
        .single(),
    );
    if (inserted.error) {
      if (isMissingDebateCyclesTable(inserted.error)) {
        return { ok: false, error: "debate_cycles 마이그레이션이 필요합니다." };
      }
      return { ok: false, error: inserted.error.message };
    }

    const subject = debateSubjectFromRow(inserted.data);
    if (!subject) return { ok: false, error: "지목한 대상을 읽지 못했습니다." };
    return { ok: true, subject };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "지목에 실패했습니다.",
    };
  }
}
