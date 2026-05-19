"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_CHANGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
  normalizeUserProfile,
  parseStoredUserProfile,
  readStoredUserProfile,
  rowToUserProfile,
  userProfileToRow,
  writeStoredUserProfile,
  type UserProfile,
  type UserProfileRow,
} from "@/lib/user-profile";

const EMPTY_PROFILE_MAP = new Map<string, UserProfile>();

interface UseUserProfileReturn {
  profile: UserProfile;
  loading: boolean;
  unavailable: boolean;
  saveProfile: (profile: UserProfile) => Promise<void>;
}

function subscribeStoredUserProfile(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === USER_PROFILE_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(USER_PROFILE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(USER_PROFILE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredUserProfileSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(USER_PROFILE_STORAGE_KEY) ?? "";
}

function getStoredUserProfileServerSnapshot() {
  return "";
}

export function useStoredUserProfile(fallback = DEFAULT_USER_PROFILE): UserProfile {
  const snapshot = useSyncExternalStore(
    subscribeStoredUserProfile,
    getStoredUserProfileSnapshot,
    getStoredUserProfileServerSnapshot,
  );

  return useMemo(() => parseStoredUserProfile(snapshot, fallback), [fallback, snapshot]);
}

export function useUserProfile(
  userId: string | null,
  fallback = DEFAULT_USER_PROFILE,
): UseUserProfileReturn {
  const [profile, setProfile] = useState(() => readStoredUserProfile(fallback));
  const [unavailable, setUnavailable] = useState(false);
  const [loadedRemoteKey, setLoadedRemoteKey] = useState<string | null>(null);
  const remoteKey = supabaseEnabled && userId ? `${supabaseEnv}:${userId}` : null;

  useEffect(() => {
    const stored = readStoredUserProfile(fallback);

    if (!remoteKey || !userId) return;

    let cancelled = false;

    withSupabaseTimeout(
      "user_profiles.select",
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;

        const nextProfile = data
          ? rowToUserProfile(data as UserProfileRow, fallback)
          : stored;
        setProfile(nextProfile);
        writeStoredUserProfile(nextProfile);
        setUnavailable(false);
        setLoadedRemoteKey(remoteKey);
      })
      .catch(() => {
        if (!cancelled) {
          setUnavailable(true);
          setLoadedRemoteKey(remoteKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallback, remoteKey, userId]);

  const saveProfile = useCallback(
    async (next: UserProfile) => {
      const normalized = normalizeUserProfile(next, fallback);
      setProfile(normalized);
      writeStoredUserProfile(normalized);

      if (!supabaseEnabled || !userId) return;

      const { error } = await withSupabaseTimeout(
        "user_profiles.upsert",
        supabase
          .from("user_profiles")
          .upsert(userProfileToRow(normalized, userId, supabaseEnv), {
            onConflict: "user_id,env",
          }),
      ).catch(() => ({ error: new Error("timeout") }));

      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }

      setUnavailable(false);
    },
    [fallback, userId],
  );

  return {
    profile,
    loading: remoteKey !== null && loadedRemoteKey !== remoteKey,
    unavailable,
    saveProfile,
  };
}

export function usePublicUserProfiles(userIds: readonly string[]): Map<string, UserProfile> {
  const uniqueIdsKey = useMemo(() => {
    return Array.from(new Set(userIds.filter(Boolean))).sort().join(",");
  }, [userIds]);
  const [profileState, setProfileState] = useState<{
    key: string;
    profiles: Map<string, UserProfile>;
  }>({ key: "", profiles: EMPTY_PROFILE_MAP });

  useEffect(() => {
    const userIdsForQuery = uniqueIdsKey ? uniqueIdsKey.split(",") : [];
    if (!supabaseEnabled || userIdsForQuery.length === 0) return;

    let cancelled = false;

    withSupabaseTimeout(
      "user_profiles.public_select",
      supabase
        .from("user_profiles")
        .select("*")
        .eq("env", supabaseEnv)
        .in("user_id", userIdsForQuery),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setProfileState({
          key: uniqueIdsKey,
          profiles: new Map((data ?? []).map((row) => {
            const profileRow = row as UserProfileRow;
            return [profileRow.user_id, rowToUserProfile(profileRow)] as const;
          })),
        });
      })
      .catch(() => {
        if (!cancelled) setProfileState({ key: uniqueIdsKey, profiles: EMPTY_PROFILE_MAP });
      });

    return () => {
      cancelled = true;
    };
  }, [uniqueIdsKey]);

  if (!uniqueIdsKey || profileState.key !== uniqueIdsKey) return EMPTY_PROFILE_MAP;
  return profileState.profiles;
}
