"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { SUPABASE_AUTH_TIMEOUT_MS, withSupabaseTimeout } from "@/lib/supabase-timeout";

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

        setUserId(null);
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
        setUserId(session?.user.id ?? null);
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
