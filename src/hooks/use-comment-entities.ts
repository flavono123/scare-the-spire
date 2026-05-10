"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";

let cachedEntities: EntityInfo[] | null = null;
let pendingEntities: Promise<EntityInfo[]> | null = null;

function uniqueAliases(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(trimmed);
  }
  return aliases;
}

function mergeEntityAliases(primary: EntityInfo, fallback: EntityInfo): EntityInfo {
  return {
    ...primary,
    aliasesKo: uniqueAliases([
      ...(primary.aliasesKo ?? []),
      fallback.nameKo,
      ...(fallback.aliasesKo ?? []),
    ]),
    aliasesEn: uniqueAliases([
      ...(primary.aliasesEn ?? []),
      fallback.nameEn,
      ...(fallback.aliasesEn ?? []),
    ]),
  };
}

function mergeCommentEntities(primary: EntityInfo[], fallback: EntityInfo[]): EntityInfo[] {
  if (!fallback.length) return primary;

  const merged = new Map<string, EntityInfo>();
  for (const entity of fallback) {
    merged.set(`${entity.type}:${entity.id}`, entity);
  }
  for (const entity of primary) {
    const key = `${entity.type}:${entity.id}`;
    const fallbackEntity = merged.get(key);
    merged.set(key, fallbackEntity ? mergeEntityAliases(entity, fallbackEntity) : entity);
  }
  return Array.from(merged.values());
}

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
  const [entities, setEntities] = useState<EntityInfo[]>(() =>
    mergeCommentEntities(initialEntities ?? [], cachedEntities ?? []),
  );
  const [loading, setLoading] = useState(() => !hasInitialEntities && !cachedEntities);

  useEffect(() => {
    const primaryEntities = initialEntities ?? [];
    if (cachedEntities) {
      setEntities(mergeCommentEntities(primaryEntities, cachedEntities));
      setLoading(false);
      return;
    }
    setEntities(primaryEntities);

    let cancelled = false;
    fetchSts2CommentEntities()
      .then((data) => {
        if (cancelled) return;
        setEntities(mergeCommentEntities(primaryEntities, data));
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
