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
  const hasInitialEntities = !!initialEntities?.length;
  const [entities, setEntities] = useState<EntityInfo[]>(() => cachedEntities ?? []);
  const [loading, setLoading] = useState(() => !hasInitialEntities && !cachedEntities);

  useEffect(() => {
    if (hasInitialEntities) {
      cachedEntities = initialEntities ?? cachedEntities;
      return;
    }
    if (cachedEntities) {
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
  }, [hasInitialEntities, initialEntities]);

  return {
    entities: hasInitialEntities ? (initialEntities ?? []) : entities,
    loading: hasInitialEntities ? false : loading,
  };
}
