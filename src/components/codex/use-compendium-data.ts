"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildAllEntities } from "@/lib/all-entities";
import {
  ALL_ENTITY_DATA_KEYS,
  loadCompendiumData,
  type CompendiumDataKey,
  type CompendiumDataResources,
} from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

/** "loading" until the chunks arrive or fail; a failure is not retried. */
export type CompendiumDataStatus = "loading" | "loaded" | "failed";

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
): { data: Pick<CompendiumDataResources, K> | null; status: CompendiumDataStatus } {
  const [loaded, setLoaded] = useState<{
    gameLocale: GameLocale;
    keys: readonly K[];
    data: Pick<CompendiumDataResources, K> | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadCompendiumData(gameLocale, keys)
      .then((data) => {
        if (active) setLoaded({ gameLocale, keys, data });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setLoaded({ gameLocale, keys, data: null });
      });
    return () => {
      active = false;
    };
  }, [gameLocale, keys]);

  const current = loaded && loaded.gameLocale === gameLocale && loaded.keys === keys ? loaded : null;
  if (!current) return { data: null, status: "loading" };
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

function loadEntities(gameLocale: GameLocale): Promise<EntityInfo[]> {
  let promise = entityPromises.get(gameLocale);
  if (!promise) {
    promise = loadCompendiumData(gameLocale, ALL_ENTITY_DATA_KEYS).then(buildAllEntities);
    promise.catch(() => entityPromises.delete(gameLocale));
    entityPromises.set(gameLocale, promise);
  }
  return promise;
}

/**
 * Hover/link entities for rich text, built on the client from the data chunks.
 * `entities` is undefined until they are built; `status` tells loading from failed.
 */
export function useCompendiumEntitiesState(
  gameLocale: GameLocale,
): { entities: EntityInfo[] | undefined; status: CompendiumDataStatus } {
  const [loaded, setLoaded] = useState<{ gameLocale: GameLocale; entities: EntityInfo[] | undefined } | null>(null);

  useEffect(() => {
    let active = true;
    loadEntities(gameLocale)
      .then((entities) => {
        if (active) setLoaded({ gameLocale, entities });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setLoaded({ gameLocale, entities: undefined });
      });
    return () => {
      active = false;
    };
  }, [gameLocale]);

  if (loaded?.gameLocale !== gameLocale) return { entities: undefined, status: "loading" };
  return loaded.entities
    ? { entities: loaded.entities, status: "loaded" }
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
