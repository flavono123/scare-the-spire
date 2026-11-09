"use client";

import { useEffect, useState } from "react";
import {
  parseNicknamePoolRows,
  type ProfileNicknamePools,
} from "@/lib/profile-character-nicknames";
import { apiFetch, requireApiVersion } from "@/lib/api-client";

/**
 * The nickname pools from the Worker (docs/supabase-exit/STEP1_DESIGN.md 9.4).
 * Null on any failure, as before; step 6 (docs/supabase-exit/STEP6_PLAN.md WP-D)
 * has no direct Supabase read, so a former legacy signal is null too.
 */
export async function fetchProfileCharacterNicknamePools(): Promise<ProfileNicknamePools | null> {
  try {
    const body = await apiFetch<{ v?: number; rows?: unknown[] | null }>("profile", "/api/read/profile/nicknames");
    requireApiVersion("profile", body);
    // v1 with no rows: the pools table is not deployed.
    if (!body.rows) return null;
    return parseNicknamePoolRows(body.rows as Parameters<typeof parseNicknamePoolRows>[0]);
  } catch {
    return null;
  }
}

export function useProfileCharacterNicknamePools(): ProfileNicknamePools | null {
  const [pools, setPools] = useState<ProfileNicknamePools | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfileCharacterNicknamePools().then((next) => {
      if (!cancelled) setPools(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return pools;
}
