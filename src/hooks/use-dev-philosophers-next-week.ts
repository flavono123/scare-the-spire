"use client";

import { useEffect, useState } from "react";
import { devToolsEnabled } from "@/lib/dev-tools";

/**
 * Dev only: true when next week's production 다채로운 철학자들 reservation is missing any slot;
 * rechecked per `refreshKey`. The dev server reads the store the save writes to (/api/dev/colorful-philosophers/next-week:
 * production D1 once some group is on d1, Supabase before).
 */
export function useDevPhilosophersNextWeekOpen(enabled: boolean, refreshKey: string): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !devToolsEnabled()) return;
    let cancelled = false;
    void fetch("/api/dev/colorful-philosophers/next-week", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<{ open?: boolean }> : null))
      .then((body) => {
        if (cancelled || !body) return;
        setOpen(body.open === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  return enabled && open;
}
