"use client";

import { useCallback, useEffect, useState } from "react";
import { claimNewIdentity, cookieModeFallbackUid, identityCookieMode, IdentityLegacyError } from "@/lib/api-identity";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { SUPABASE_AUTH_TIMEOUT_MS, withSupabaseTimeout } from "@/lib/supabase-timeout";

/**
 * Step 4 cookie mode (docs/SUPABASE_EXIT_PLAN.md 5.3): a browser with no
 * Supabase session asks the Worker, which signs up on Supabase for it and
 * returns that session, so both systems hold the same uid. Null when the
 * Worker says identity.mode is token: then today's anonymous sign-in runs.
 */
async function signInThroughWorker(): Promise<string | null> {
  let claimed;
  try {
    claimed = await claimNewIdentity();
  } catch (error) {
    if (error instanceof IdentityLegacyError) return null;
    throw error;
  }
  if (claimed.session) {
    // The cookie is the identity now; a failed hand-over only leaves supabase-js without it.
    await withSupabaseTimeout(
      "auth.setSession",
      supabase.auth.setSession({
        access_token: claimed.session.access_token,
        refresh_token: claimed.session.refresh_token,
      }),
      SUPABASE_AUTH_TIMEOUT_MS,
    ).catch(() => undefined);
  }
  return claimed.uid;
}

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(!supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  const ensureUser = useCallback(async (): Promise<string | null> => {
    if (!supabaseEnabled) return null;
    if (userId) return userId;

    try {
      const { data: { session }, error } = await withSupabaseTimeout(
        "auth.getSession",
        supabase.auth.getSession(),
        SUPABASE_AUTH_TIMEOUT_MS,
      );
      if (error) throw error;
      if (session?.user) {
        setUserId(session.user.id);
        setUnavailable(false);
        return session.user.id;
      }

      if (identityCookieMode()) {
        const workerUserId = await signInThroughWorker();
        if (workerUserId) {
          setUserId(workerUserId);
          setUnavailable(false);
          return workerUserId;
        }
      }

      const { data, error: signInError } = await withSupabaseTimeout(
        "auth.signInAnonymously",
        supabase.auth.signInAnonymously(),
        SUPABASE_AUTH_TIMEOUT_MS,
      );
      if (signInError) throw signInError;

      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);
      setUnavailable(!nextUserId);
      return nextUserId;
    } catch {
      setUserId(null);
      setUnavailable(true);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: { session }, error } = await withSupabaseTimeout(
          "auth.getSession",
          supabase.auth.getSession(),
          SUPABASE_AUTH_TIMEOUT_MS,
        );
        if (error) throw error;
        if (cancelled) return;
        if (session?.user) {
          setUserId(session.user.id);
          setUnavailable(false);
          return;
        }

        setUserId(cookieModeFallbackUid());
        setUnavailable(false);
      } catch {
        if (!cancelled) {
          setUserId(null);
          setUnavailable(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? cookieModeFallbackUid());
        if (session?.user) setUnavailable(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { userId, ready, unavailable, ensureUser };
}
