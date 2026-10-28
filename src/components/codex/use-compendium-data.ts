"use client";

import { useEffect, useState } from "react";
import { useRetryWhenRequested } from "@/components/compendium-data-retry";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildAllEntities } from "@/lib/all-entities";
import {
  ALL_ENTITY_DATA_KEYS,
  loadCompendiumData,
  type CompendiumDataKey,
  type CompendiumDataResources,
} from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

/**
 * "loading" until the chunks arrive or fail. A failure stays until
 * retryFailedCompendiumData() (compendium-data-retry) starts the load again,
 * which goes back to "loading".
 */
export type CompendiumDataStatus = "loading" | "loaded" | "failed";

/**
 * A hook called with `{ enabled: false }` reports "idle" until it is enabled.
 * Once data has arrived it stays available even if the hook is disabled again.
 */
export type CompendiumLazyDataStatus = CompendiumDataStatus | "idle";

/** Fetch only when a page needs the data (a modal opens, an editor mounts). */
export interface CompendiumLazyDataOptions {
  enabled?: boolean;
}

/**
 * Loads Compendium resources that a page does not need for its first render
 * (detail modals, hover tips, version history). `data` is null until every
 * key has arrived, so pages render their server markup first; `status` tells
 * a still-loading page from one whose chunks failed. `keys` must be a stable
 * (module-level) array.
 */
export function useCompendiumDataState<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
): { data: Pick<CompendiumDataResources, K> | null; status: CompendiumDataStatus };
export function useCompendiumDataState<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
  options: CompendiumLazyDataOptions,
): { data: Pick<CompendiumDataResources, K> | null; status: CompendiumLazyDataStatus };
export function useCompendiumDataState<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
  { enabled = true }: CompendiumLazyDataOptions = {},
): { data: Pick<CompendiumDataResources, K> | null; status: CompendiumLazyDataStatus } {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    gameLocale: GameLocale;
    keys: readonly K[];
    attempt: number;
    data: Pick<CompendiumDataResources, K> | null;
  } | null>(null);
  const current = loaded
    && loaded.gameLocale === gameLocale
    && loaded.keys === keys
    && loaded.attempt === attempt
    ? loaded
    : null;
  const failed = Boolean(current && !current.data);
  useRetryWhenRequested(failed, setAttempt);

  useEffect(() => {
    if (!enabled || failed) return;
    let active = true;
    loadCompendiumData(gameLocale, keys)
      .then((data) => {
        if (active) setLoaded({ gameLocale, keys, attempt, data });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setLoaded({ gameLocale, keys, attempt, data: null });
      });
    return () => {
      active = false;
    };
  }, [attempt, enabled, failed, gameLocale, keys]);

  if (!current) return { data: null, status: enabled ? "loading" : "idle" };
  return current.data ? { data: current.data, status: "loaded" } : { data: null, status: "failed" };
}

/** The data from useCompendiumDataState: null while loading or after a failure. */
export function useCompendiumData<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
): Pick<CompendiumDataResources, K> | null {
  return useCompendiumDataState(gameLocale, keys).data;
}

const entityPromises = new Map<GameLocale, Promise<EntityInfo[]>>();

/**
 * The full hover/link entity graph for a game locale, the same list the server
 * builds with loadAllEntities. Built once per locale from the data chunks and
 * cached for the session; a failed load is retried on the next call.
 */
export function loadAllEntityGraph(gameLocale: GameLocale): Promise<EntityInfo[]> {
  let promise = entityPromises.get(gameLocale);
  if (!promise) {
    promise = loadCompendiumData(gameLocale, ALL_ENTITY_DATA_KEYS).then(buildAllEntities);
    promise.catch(() => entityPromises.delete(gameLocale));
    entityPromises.set(gameLocale, promise);
  }
  return promise;
}

/** Starts loading the entity graph ahead of need, e.g. when a pointer reaches a write button. */
export function prefetchAllEntityGraph(gameLocale: GameLocale): void {
  loadAllEntityGraph(gameLocale).catch(() => {
    // The hook that needs the graph reports the failure.
  });
}

/**
 * Hover/link entities for rich text, built on the client from the data chunks.
 * `entities` is undefined until they are built; `status` tells loading from failed.
 * The first render is never "loaded", so it matches the server markup.
 */
export function useCompendiumEntitiesState(
  gameLocale: GameLocale,
): { entities: EntityInfo[] | undefined; status: CompendiumDataStatus };
export function useCompendiumEntitiesState(
  gameLocale: GameLocale,
  options: CompendiumLazyDataOptions,
): { entities: EntityInfo[] | undefined; status: CompendiumLazyDataStatus };
export function useCompendiumEntitiesState(
  gameLocale: GameLocale,
  { enabled = true }: CompendiumLazyDataOptions = {},
): { entities: EntityInfo[] | undefined; status: CompendiumLazyDataStatus } {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    gameLocale: GameLocale;
    attempt: number;
    entities: EntityInfo[] | undefined;
  } | null>(null);
  const current = loaded?.gameLocale === gameLocale && loaded.attempt === attempt ? loaded : null;
  const failed = Boolean(current && !current.entities);
  useRetryWhenRequested(failed, setAttempt);

  useEffect(() => {
    if (!enabled || failed) return;
    let active = true;
    loadAllEntityGraph(gameLocale)
      .then((entities) => {
        if (active) setLoaded({ gameLocale, attempt, entities });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setLoaded({ gameLocale, attempt, entities: undefined });
      });
    return () => {
      active = false;
    };
  }, [attempt, enabled, failed, gameLocale]);

  if (!current) {
    return { entities: undefined, status: enabled ? "loading" : "idle" };
  }
  return current.entities
    ? { entities: current.entities, status: "loaded" }
    : { entities: undefined, status: "failed" };
}

/** The entities from useCompendiumEntitiesState: undefined while loading or after a failure. */
export function useCompendiumEntities(gameLocale: GameLocale): EntityInfo[] | undefined {
  return useCompendiumEntitiesState(gameLocale).entities;
}

/**
 * Whether a list's detail modal can render: every chunk it reads has either
 * arrived or failed. After a failure the modal falls back to the server props.
 */
export function compendiumDetailsSettled(...statuses: CompendiumDataStatus[]): boolean {
  return statuses.every((status) => status !== "loading");
}
