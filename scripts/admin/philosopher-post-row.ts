/**
 * The /dev/colorful-philosophers save checks and the codex lookup that turn the editor's input into
 * the post row (moved from src/app/(main)/dev/colorful-philosophers/actions.ts, same checks and words),
 * shared by that server action and scripts/admin/philosopher-post.ts.
 */
import {
  COLORFUL_PHILOSOPHERS_GAME_VERSION,
  colorfulPhilosophersWeekStart,
  isColorfulPhilosophersMonday,
} from "../../src/lib/colorful-philosophers";
import { loadAllEntities } from "../../src/lib/load-all-entities";
import type { PhilosopherPostRow } from "./admin-writes";

export interface PhilosopherPostInput {
  env: string;
  weekStart: string;
  slot: string;
  resourceType: string;
  resourceId: string;
  body: string;
}

type EntityLookup = Map<string, { id: string; type: string; nameKo: string; nameEn: string; imageUrl: string | null }>;

let lookupPromise: Promise<EntityLookup> | null = null;

function entityLookup(): Promise<EntityLookup> {
  lookupPromise ??= loadAllEntities({ gameLocale: "kor" }).then((entities) => {
    const map: EntityLookup = new Map();
    for (const entity of entities) {
      map.set(`${entity.type}:${entity.id.toLowerCase()}`, {
        id: entity.id,
        type: entity.type,
        nameKo: entity.nameKo,
        nameEn: entity.nameEn,
        imageUrl: entity.imageUrl,
      });
    }
    return map;
  });
  return lookupPromise;
}

/** The key check moved to the Supabase path (admin-writes.ts): a D1 save needs no Supabase key. */
export async function philosopherPostRow(
  input: PhilosopherPostInput,
): Promise<{ ok: true; row: PhilosopherPostRow } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 500) {
    return { ok: false, error: "화두는 1자 이상 500자 이하여야 합니다." };
  }
  if (!isColorfulPhilosophersMonday(input.weekStart) || input.weekStart < colorfulPhilosophersWeekStart()) {
    return { ok: false, error: "지난 주에는 예약할 수 없습니다." };
  }
  if (!(["topic", "card", "relic"] as readonly string[]).includes(input.slot)) {
    return { ok: false, error: "이 주의 토론, 카드, 유물 글만 만들 수 있습니다." };
  }
  if (input.env !== "production" && input.env !== "development") {
    return { ok: false, error: "알 수 없는 Supabase 환경입니다." };
  }

  const entity = (await entityLookup()).get(`${input.resourceType}:${input.resourceId.trim().toLowerCase()}`);
  if (input.slot !== "topic" && entity && entity.type !== input.slot) {
    return { ok: false, error: "그 칸에 맞는 요소가 아닙니다." };
  }
  if (!entity) return { ok: false, error: "백과사전에서 그 요소를 찾지 못했습니다." };

  return {
    ok: true,
    row: {
      week_start: input.weekStart,
      slot: input.slot,
      resource_type: entity.type,
      resource_id: entity.id,
      name_ko: entity.nameKo,
      name_en: entity.nameEn,
      image_url: entity.imageUrl,
      body,
      game_version: COLORFUL_PHILOSOPHERS_GAME_VERSION,
    },
  };
}
