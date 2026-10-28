"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompendiumEntitiesState } from "@/components/codex/use-compendium-data";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { GameLocale } from "@/lib/i18n";

/** comment-entities-sts2.json is built from the Korean graph. */
const KOREAN_GAME_LOCALE: GameLocale = "kor";

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
    pendingEntities = fetch("/generated/comment-entities-sts2.json")
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

/**
 * Mention/link entities for comment editors and rendered comments.
 *
 * By default the Korean comment-entities file is merged into
 * `initialEntities` as aliases. With `gameLocale`, the primary list is that
 * locale's full entity graph and the Korean graph supplies the aliases (the
 * same data as the Korean file), so a page no longer has to ship the graph in
 * its props; `loading` lasts until the primary graph has arrived or failed.
 */
export function useCommentEntities(
  initialEntities?: EntityInfo[],
  options: { enabled?: boolean; gameLocale?: GameLocale } = {},
) {
  const enabled = options.enabled ?? true;
  const gameLocale = options.gameLocale;
  const fileEntities = useFileCommentEntities(initialEntities, enabled && !gameLocale);
  const graphEntities = useGraphCommentEntities(gameLocale, enabled);
  return gameLocale ? graphEntities : fileEntities;
}

function useGraphCommentEntities(gameLocale: GameLocale | undefined, enabled: boolean) {
  const graphEnabled = enabled && Boolean(gameLocale);
  const primary = useCompendiumEntitiesState(gameLocale ?? KOREAN_GAME_LOCALE, { enabled: graphEnabled });
  const fallback = useCompendiumEntitiesState(KOREAN_GAME_LOCALE, { enabled: graphEnabled });
  const primaryEntities = primary.entities;
  const fallbackEntities = fallback.entities;
  const entities = useMemo(
    () => mergeCommentEntities(primaryEntities ?? [], fallbackEntities ?? []),
    [fallbackEntities, primaryEntities],
  );
  return {
    entities,
    loading: graphEnabled && (primary.status === "loading" || primary.status === "idle"),
  };
}

function useFileCommentEntities(initialEntities: EntityInfo[] | undefined, enabled: boolean) {
  const hasInitialEntities = !!initialEntities?.length;
  const [fallbackEntities, setFallbackEntities] = useState<EntityInfo[] | null>(() => cachedEntities);
  const [loadFinished, setLoadFinished] = useState(() => Boolean(cachedEntities));
  const entities = useMemo(
    () => mergeCommentEntities(initialEntities ?? [], fallbackEntities ?? []),
    [fallbackEntities, initialEntities],
  );

  useEffect(() => {
    if (!enabled || fallbackEntities || loadFinished) return;

    let cancelled = false;
    fetchSts2CommentEntities()
      .then((data) => {
        if (cancelled) return;
        setFallbackEntities(data);
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (cancelled) return;
        setLoadFinished(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fallbackEntities, loadFinished]);

  return {
    entities,
    loading: enabled && !hasInitialEntities && !fallbackEntities && !loadFinished,
  };
}
