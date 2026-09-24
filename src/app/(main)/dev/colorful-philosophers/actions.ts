"use server";

import { createClient } from "@supabase/supabase-js";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  COLORFUL_PHILOSOPHERS_GAME_VERSION,
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersWeekStart,
  isColorfulPhilosopherSlot,
  isColorfulPhilosophersMonday,
  isMissingColorfulPhilosopherPosts,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

type SaveResult =
  | { ok: true; post: ColorfulPhilosopherPost }
  | { ok: false; error: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let lookupPromise: Promise<Map<string, { id: string; nameKo: string; nameEn: string; imageUrl: string | null }>> | null = null;

function entityLookup() {
  lookupPromise ??= loadAllEntities({ gameLocale: "kor" }).then((entities) => {
    const map = new Map<string, { id: string; nameKo: string; nameEn: string; imageUrl: string | null }>();
    for (const entity of entities) {
      if (!isColorfulPhilosopherSlot(entity.type)) continue;
      map.set(`${entity.type}:${entity.id.toLowerCase()}`, {
        id: entity.id,
        nameKo: entity.nameKo,
        nameEn: entity.nameEn,
        imageUrl: entity.imageUrl,
      });
    }
    return map;
  });
  return lookupPromise;
}

export async function saveColorfulPhilosopherPost(input: {
  weekStart: string;
  slot: string;
  resourceId: string;
  body: string;
}): Promise<SaveResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "개발 서버에서만 글을 만들 수 있습니다." };
  }
  const body = input.body.trim();
  if (body.length < 1 || body.length > 500) {
    return { ok: false, error: "화두는 1자 이상 500자 이하여야 합니다." };
  }
  if (!isColorfulPhilosophersMonday(input.weekStart) || input.weekStart < colorfulPhilosophersWeekStart()) {
    return { ok: false, error: "지난 주에는 예약할 수 없습니다." };
  }
  if (!isColorfulPhilosopherSlot(input.slot)) {
    return { ok: false, error: "카드, 유물, 파워 글만 만들 수 있습니다." };
  }
  const admin = adminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY가 없습니다." };
  if (supabaseEnv !== "production" && supabaseEnv !== "development") {
    return { ok: false, error: "알 수 없는 Supabase 환경입니다." };
  }

  const entity = (await entityLookup()).get(`${input.slot}:${input.resourceId.trim().toLowerCase()}`);
  if (!entity) return { ok: false, error: "백과사전에서 그 요소를 찾지 못했습니다." };

  try {
    const saved = await withSupabaseTimeout(
      "dev.colorful_philosopher_posts.save",
      admin.from(COLORFUL_PHILOSOPHERS_POSTS_TABLE).upsert({
        env: supabaseEnv,
        week_start: input.weekStart,
        slot: input.slot,
        resource_type: input.slot,
        resource_id: entity.id,
        name_ko: entity.nameKo,
        name_en: entity.nameEn,
        image_url: entity.imageUrl,
        body,
        game_version: COLORFUL_PHILOSOPHERS_GAME_VERSION,
      }, { onConflict: "env,week_start,slot" }).select(
        "id, week_start, slot, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count",
      ).single(),
    );
    if (saved.error) {
      if (isMissingColorfulPhilosopherPosts(saved.error)) {
        return { ok: false, error: "colorful_philosopher_posts 마이그레이션이 필요합니다." };
      }
      return { ok: false, error: saved.error.message };
    }
    const post = colorfulPhilosopherPostFromRow(saved.data);
    if (!post) return { ok: false, error: "글을 읽지 못했습니다." };
    return { ok: true, post };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
}
