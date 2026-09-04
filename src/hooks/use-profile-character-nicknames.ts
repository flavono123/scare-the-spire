"use client";

import { useEffect, useState } from "react";
import {
  PROFILE_CHARACTER_NICKNAME_POOLS_TABLE,
  isMissingProfileCharacterNicknamePoolsTable,
  mergeNicknamePools,
  parseNicknamePoolRows,
  type ProfileCharacterNicknamePools,
} from "@/lib/profile-character-nicknames";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export async function fetchProfileCharacterNicknamePools(): Promise<ProfileCharacterNicknamePools | null> {
  if (!supabaseEnabled) return null;

  try {
    const { data, error } = await withSupabaseTimeout(
      "profile_character_nickname_pools.select",
      supabase
        .from(PROFILE_CHARACTER_NICKNAME_POOLS_TABLE)
        .select("character_id, locale, nicknames"),
    );
    if (error) {
      if (!isMissingProfileCharacterNicknamePoolsTable(error)) {
        console.warn("Failed to load profile character nicknames", error.message);
      }
      return null;
    }
    return mergeNicknamePools(parseNicknamePoolRows(data));
  } catch (error) {
    console.warn(
      "Failed to load profile character nicknames",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function useProfileCharacterNicknamePools(): ProfileCharacterNicknamePools | null {
  const [pools, setPools] = useState<ProfileCharacterNicknamePools | null>(null);

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
