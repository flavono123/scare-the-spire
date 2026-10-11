"use client";

import { useEffect, useState } from "react";
import type { SitePathIndex } from "@/lib/site-paths";

let cachedIndex: SitePathIndex | null = null;
let pendingIndex: Promise<SitePathIndex> | null = null;

function fetchIndex(): Promise<SitePathIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (!pendingIndex) {
    pendingIndex = fetch("/generated/site-path-index.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load site paths: ${response.status}`);
        return response.json() as Promise<SitePathIndex>;
      })
      .then((index) => {
        cachedIndex = index;
        return index;
      })
      .finally(() => {
        pendingIndex = null;
      });
  }
  return pendingIndex;
}

export function useSitePathIndex() {
  const [index, setIndex] = useState<SitePathIndex | null>(() => cachedIndex);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (index) return;
    let cancelled = false;
    fetchIndex()
      .then((next) => {
        if (!cancelled) setIndex(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [index]);

  return { index, failed };
}
