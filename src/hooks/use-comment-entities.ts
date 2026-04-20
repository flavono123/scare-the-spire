"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";

let cachedEntities: EntityInfo[] | null = null;
let pendingEntities: Promise<EntityInfo[]> | null = null;

async function fetchSts2CommentEntities(): Promise<EntityInfo[]> {
  if (cachedEntities) return cachedEntities;
  if (!pendingEntities) {
    pendingEntities = fetch("/comment-entities/sts2")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load comment entities: ${res.status}`);
        }
        return res.json() as Promise<EntityInfo[]>;
      })
      .then((data) => {
        cachedEntities = data;
        return data;
      })
      .finally(() => {
        pendingEntities = null;
      });
  }
  return pendingEntities;
}

export function useCommentEntities(initialEntities?: EntityInfo[]) {
  const [entities, setEntities] = useState<EntityInfo[]>(() => initialEntities ?? cachedEntities ?? []);
  const [loading, setLoading] = useState(() => !initialEntities && !cachedEntities);

  useEffect(() => {
    if (initialEntities?.length) {
      cachedEntities = initialEntities;
      setEntities(initialEntities);
      setLoading(false);
      return;
    }
    if (cachedEntities) {
      setEntities(cachedEntities);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchSts2CommentEntities()
      .then((data) => {
        if (cancelled) return;
        setEntities(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialEntities]);

  return { entities, loading };
}
