"use server";

import { createClient } from "@supabase/supabase-js";
import {
  NAV_INDICATORS_TABLE,
  isMissingNavIndicatorsTable,
  isNavIndicatorEnv,
  isNavIndicatorTarget,
  navIndicatorFlagsFromRow,
  type NavIndicatorEnv,
  type NavIndicatorFlags,
  type NavIndicatorTarget,
} from "@/lib/nav-indicators";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

type SetNavIndicatorResult =
  | { ok: true; flags: NavIndicatorFlags }
  | { ok: false; error: string };

function createNavIndicatorAdminClient() {
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

export async function setNavIndicator(input: {
  env: NavIndicatorEnv;
  target: NavIndicatorTarget;
  enabled: boolean;
}): Promise<SetNavIndicatorResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "개발 서버에서만 바꿀 수 있습니다." };
  }
  if (!isNavIndicatorEnv(input.env) || !isNavIndicatorTarget(input.target)) {
    return { ok: false, error: "알 수 없는 인디케이터입니다." };
  }
  if (typeof input.enabled !== "boolean") {
    return { ok: false, error: "알 수 없는 인디케이터입니다." };
  }

  const admin = createNavIndicatorAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SECRET_KEY가 없습니다." };
  }

  const patch = input.target === "patch_notes"
    ? { patch_notes: input.enabled }
    : { toy_box: input.enabled };

  try {
    const { data, error } = await withSupabaseTimeout(
      "dev.nav_indicators.update",
      admin
        .from(NAV_INDICATORS_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("env", input.env)
        .select("patch_notes, toy_box")
        .maybeSingle(),
    );
    if (error) {
      if (isMissingNavIndicatorsTable(error)) {
        return { ok: false, error: "nav_indicators 마이그레이션이 필요합니다." };
      }
      return { ok: false, error: error.message };
    }
    if (!data) {
      return { ok: false, error: "nav_indicators 마이그레이션이 필요합니다." };
    }
    return { ok: true, flags: navIndicatorFlagsFromRow(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "저장에 실패했습니다.",
    };
  }
}
