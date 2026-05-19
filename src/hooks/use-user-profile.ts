"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_CHANGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
  parseStoredUserProfile,
  writeStoredUserProfile,
  type UserProfile,
} from "@/lib/user-profile";

interface UseUserProfileReturn {
  profile: UserProfile;
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

export function useUserProfile(fallback = DEFAULT_USER_PROFILE): UseUserProfileReturn {
  const profile = useStoredUserProfile(fallback);
  const saveProfile = useCallback(async (next: UserProfile) => {
    writeStoredUserProfile(next);
  }, []);

  return { profile, saveProfile };
}
