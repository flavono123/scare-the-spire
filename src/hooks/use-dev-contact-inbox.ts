"use client";

import { useEffect, useState } from "react";
import { devToolsEnabled } from "@/lib/dev-tools";

const CACHE_KEY = "sts-dev-contact-inbox";
const CACHE_MS = 30_000;

function readCache(): boolean | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; unchecked?: boolean };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_MS) return null;
    return parsed.unchecked === true;
  } catch {
    return null;
  }
}

function writeCache(unchecked: boolean): void {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), unchecked }));
  } catch {
    // Private browsing can reject sessionStorage writes.
  }
}

/**
 * Dev only: whether any inquiry is still in the "new" (접수) state. Answering
 * or moving it to another status on /dev/admin clears it on the next page.
 */
export function useDevContactInbox(pathname: string): boolean {
  const [unchecked, setUnchecked] = useState(false);

  useEffect(() => {
    if (!devToolsEnabled()) return;
    const cached = readCache();
    if (cached !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reuse the recent count without refetching
      setUnchecked(cached);
      return;
    }
    let cancelled = false;
    void fetch("/api/dev/contact-inbox", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<{ unchecked?: number }> : null))
      .then((body) => {
        if (cancelled || !body) return;
        const next = (body.unchecked ?? 0) > 0;
        writeCache(next);
        setUnchecked(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return unchecked;
}
