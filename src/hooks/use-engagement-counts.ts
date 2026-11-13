"use client";

import { useEffect, useState } from "react";
import { apiFetch, requireApiVersion } from "@/lib/api-client";

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

    let cancelled = false;
    apiFetch<{ v?: number; likes?: Record<string, number>; comments?: Record<string, number> }>(
      "comments",
      "/api/read/engagement-counts",
    )
      .then((body) => {
        if (cancelled) return;
        // A version this client does not know is an outage, like the other api reads.
        requireApiVersion("comments", body);
        if (!body.likes || !body.comments) throw new Error("bad engagement counts");
        setCounts({ likes: body.likes, comments: body.comments, unavailable: false });
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCounts({ likes: {}, comments: {}, unavailable: true });
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    ...counts,
    loading: enabled && !loaded,
  };
}
