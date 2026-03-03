"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setReady(true);
      } else {
        supabase.auth.signInAnonymously().then(({ data }) => {
          setUserId(data.session?.user.id ?? null);
          setReady(true);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return { userId, ready };
}
