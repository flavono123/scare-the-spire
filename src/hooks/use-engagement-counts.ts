"use client";

import { useEffect, useState } from "react";
import { apiFetch, SurfaceLegacyError } from "@/lib/api-client";
import { shouldUseLegacy } from "@/lib/api-engagement";
import { demoteSurface, surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface Counts {
  likes: Record<string, number>;
  comments: Record<string, number>;
  loading: boolean;
  unavailable: boolean;
}

export function useEngagementCounts({ enabled = true }: { enabled?: boolean } = {}) {
  const [counts, setCounts] = useState<Omit<Counts, "loading">>({
    likes: {},
    comments: {},
    unavailable: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const viaApi = surfacePath("comments") === "api";
    if (!viaApi && !supabaseEnabled) return;

    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      setCounts({ likes: {}, comments: {}, unavailable: true });
      setLoaded(true);
    };

    const loadLegacy = () => {
      // Keep aggregation server-side. A client-side full-table scan is too
      // expensive when Supabase is already under Disk IO pressure.
      withSupabaseTimeout(
        "engagement_counts.rpc",
        supabase.rpc("get_engagement_counts", { p_env: supabaseEnv }),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          const likes: Record<string, number> = {};
          const comments: Record<string, number> = {};
          const rows = (data ?? []) as { story_id: string; like_count: number; comment_count: number }[];
          for (const row of rows) {
            if (row.like_count) likes[row.story_id] = row.like_count;
            if (row.comment_count) comments[row.story_id] = row.comment_count;
          }
          if (cancelled) return;
          setCounts({ likes, comments, unavailable: false });
          setLoaded(true);
        })
        .catch(fail);
    };

    if (viaApi) {
      apiFetch<{ v?: number; likes?: Record<string, number>; comments?: Record<string, number> }>(
        "comments",
        "/api/read/engagement-counts",
      )
        .then((body) => {
          if (cancelled) return;
          // A version this client does not know is a legacy signal, like the other api reads.
          if (body?.v !== 1) {
            demoteSurface("comments");
            throw new SurfaceLegacyError(200, false);
          }
          if (!body.likes || !body.comments) throw new Error("bad engagement counts");
          setCounts({ likes: body.likes, comments: body.comments, unavailable: false });
          setLoaded(true);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    ...counts,
    loading: supabaseEnabled && enabled && !loaded,
  };
}
