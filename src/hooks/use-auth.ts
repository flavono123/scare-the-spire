"use client";

import { useCallback, useEffect, useState } from "react";
import {
  claimedUid,
  claimNewIdentity,
  IDENTITY_CHANGE_EVENT,
  isIdentityStorageKey,
  storedSupabaseIdentity,
} from "@/lib/api-identity";

/**
 * This browser's user without supabase-js (docs/supabase-exit/STEP6_PLAN.md WP-A 3).
 *
 * - `userId`: the stored Supabase session's uid, else the uid this browser claimed
 *   (the order supabase-js getSession and the cookie-mode fallback had). Read from
 *   localStorage on mount, and again whenever another tab (`storage`) or this one
 *   (IDENTITY_CHANGE_EVENT) stores a claim or a session, as onAuthStateChange did.
 * - `ensureUser`: the uid, asking the Worker for one when this browser has none: it
 *   keeps a valid cookie's uid or signs up a new user and the session is stored
 *   (api-identity.ts). A failed claim leaves `unavailable` set, as a failed
 *   anonymous sign-in did.
 */

function knownIdentity(): { uid: string | null; stored: boolean } {
  const stored = storedSupabaseIdentity()?.uid ?? null;
  return { uid: stored ?? claimedUid(), stored: stored !== null };
}

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const ensureUser = useCallback(async (): Promise<string | null> => {
    if (userId) return userId;

    const stored = storedSupabaseIdentity()?.uid ?? null;
    if (stored) {
      setUserId(stored);
      setUnavailable(false);
      return stored;
    }

    try {
      const claimed = await claimNewIdentity();
      setUserId(claimed.uid);
      setUnavailable(false);
      return claimed.uid;
    } catch {
      setUserId(null);
      setUnavailable(true);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    const sync = () => {
      const known = knownIdentity();
      setUserId(known.uid);
      if (known.stored) setUnavailable(false);
    };
    const onStorage = (event: StorageEvent) => {
      // A null key is localStorage.clear() in another tab.
      if (event.key === null || isIdentityStorageKey(event.key)) sync();
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setUserId(knownIdentity().uid);
    setUnavailable(false);
    setReady(true);
    window.addEventListener("storage", onStorage);
    window.addEventListener(IDENTITY_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(IDENTITY_CHANGE_EVENT, sync);
    };
  }, []);

  return { userId, ready, unavailable, ensureUser };
}
