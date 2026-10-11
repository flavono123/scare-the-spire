"use client";

import { useEffect, useState } from "react";
import type { Sts1MentionIndex } from "@/lib/sts1-mention-index";

let cachedIndex: Sts1MentionIndex | null = null;
let pendingIndex: Promise<Sts1MentionIndex> | null = null;

function fetchIndex(): Promise<Sts1MentionIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (!pendingIndex) {
    pendingIndex = fetch("/generated/sts1-mention-index.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load STS1 mentions: ${response.status}`);
        return response.json() as Promise<Sts1MentionIndex>;
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

export function useSts1MentionIndex() {
  const [index, setIndex] = useState<Sts1MentionIndex | null>(() => cachedIndex);
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

  return { index, loading: !index && !failed, failed };
}
