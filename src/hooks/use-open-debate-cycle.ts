"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEBATE_CYCLES_TABLE,
  DEBATE_SCHEDULE_WEEKS,
  debateSubjectFromRow,
  debateWeekStart,
  isMissingDebateCyclesTable,
  type DebateSubject,
} from "@/lib/debate-cycle";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

const SELECT_COLUMNS = "id, resource_type, resource_id, name_ko, name_en, image_url, href, game_version, opened_at, week_start, pool";

export function useOpenDebateCycle() {
  const [subject, setSubject] = useState<DebateSubject | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) {
      setSubject(null);
      setLoading(false);
      setUnavailable(false);
      setMissing(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    withSupabaseTimeout(
      "debate_cycles.open",
      supabase
        .from(DEBATE_CYCLES_TABLE)
        .select(SELECT_COLUMNS)
        .eq("env", supabaseEnv)
        .eq("week_start", debateWeekStart())
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (isMissingDebateCyclesTable(error)) {
            setSubject(null);
            setMissing(true);
            setUnavailable(false);
          } else {
            setMissing(false);
            setUnavailable(true);
          }
          setLoading(false);
          return;
        }
        setSubject(data ? debateSubjectFromRow(data) : null);
        setMissing(false);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { subject, loading, unavailable, missing, reload };
}

export function useDebateSchedule() {
  const [subjects, setSubjects] = useState<DebateSubject[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) {
      setSubjects([]);
      setLoading(false);
      setUnavailable(false);
      setMissing(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    withSupabaseTimeout(
      "debate_cycles.schedule",
      supabase
        .from(DEBATE_CYCLES_TABLE)
        .select(SELECT_COLUMNS)
        .eq("env", supabaseEnv)
        .gte("week_start", debateWeekStart())
        .order("week_start", { ascending: true })
        .limit(DEBATE_SCHEDULE_WEEKS),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (isMissingDebateCyclesTable(error)) {
            setSubjects([]);
            setMissing(true);
            setUnavailable(false);
          } else {
            setMissing(false);
            setUnavailable(true);
          }
          setLoading(false);
          return;
        }
        setSubjects((data ?? []).flatMap((row) => {
          const subject = debateSubjectFromRow(row);
          return subject ? [subject] : [];
        }));
        setMissing(false);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { subjects, loading, unavailable, missing, reload };
}
