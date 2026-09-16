/**
 * versioned-entity-api.ts
 *
 * Dedicated API transform layer for querying STS2 game entities at specific patch versions.
 * Supports backward version reconstruction, lifecycle checks (availability and deprecation),
 * and provides typed responses.
 */

import { compareVersions, reconstructEntityAtVersion } from "./entity-versioning";
import { isEntityAvailableInVersion, isEntityDeprecatedInVersion } from "./entity-lifecycle";
import type {
  EntityVersionDiff,
  STS2Change,
  STS2Patch,
  VersionedEntityType,
} from "./types";
import type { GameLocale } from "./i18n";
import {
  getCodexCards,
  getCodexRelics,
  getCodexPotions,
  getCodexEvents,
  getCodexPowers,
  getCodexMonsters,
  getCodexEncounters,
  getCodexEnchantments,
  getCodexAfflictions,
  getCodexAncients,
  getCodexEpochs,
} from "./codex-data";
import {
  getCodexMeta,
  getSTS2Patches,
  getSTS2Changes,
  getEntityVersionDiffs,
} from "./data";

export interface VersionedEntityResult<T = Record<string, unknown>> {
  version: string;
  entityType: VersionedEntityType;
  entityId: string;
  isAvailable: boolean;
  isDeprecated: boolean;
  introducedInPatch?: string;
  deprecatedInPatch?: string;
  entity: T | null;
  appliedPatches: string[];
}

export interface ResolveVersionedEntityOptions<T extends { id: string }> {
  entity: T;
  entityType: VersionedEntityType;
  targetVersion: string;
  currentVersion: string;
  versionDiffs: EntityVersionDiff[];
  patches: STS2Patch[];
  changes?: STS2Change[];
}

export interface GetVersionedEntityQuery {
  entityType: VersionedEntityType;
  entityId: string;
  version: string;
  locale?: GameLocale;
}

export interface GetVersionedEntitiesQuery {
  entityType: VersionedEntityType;
  version: string;
  locale?: GameLocale;
  includeUnavailable?: boolean;
}

function normalizeVersion(v: string): string {
  return v.startsWith("v") ? v : `v${v}`;
}

/**
 * Pure, in-memory resolution of an entity at a target version.
 * Safe for execution in client components, Workers, and scripts without disk access.
 */
export function resolveVersionedEntity<T extends { id: string }>(
  opts: ResolveVersionedEntityOptions<T>,
): VersionedEntityResult<T> {
  const target = normalizeVersion(opts.targetVersion);
  const current = normalizeVersion(opts.currentVersion);

  const isAvailable = isEntityAvailableInVersion(
    opts.entity,
    target,
    opts.changes,
    opts.entityType,
  );

  const isDeprecated = isEntityDeprecatedInVersion(
    opts.entity,
    target,
  );

  const introducedInPatch = opts.changes
    ?.filter(
      (c) =>
        c.entityType === opts.entityType &&
        c.entityId === opts.entity.id &&
        c.diffs.some((d) => d.attribute === "new"),
    )
    .map((c) => c.patch)
    .sort(compareVersions)[0];

  const deprecatedInPatch =
    ("deprecatedInPatch" in opts.entity && typeof opts.entity.deprecatedInPatch === "string"
      ? opts.entity.deprecatedInPatch
      : undefined) ??
    opts.changes
      ?.filter(
        (c) =>
          c.entityType === opts.entityType &&
          c.entityId === opts.entity.id &&
          c.diffs.some((d) => d.attribute === "deprecated" || d.attribute === "removed"),
      )
      .map((c) => c.patch)
      .sort(compareVersions)[0];

  const appliedPatches = opts.patches
    .filter((p) => {
      const pv = normalizeVersion(p.version);
      return compareVersions(pv, target) <= 0;
    })
    .map((p) => normalizeVersion(p.version))
    .filter((patchVer) =>
      opts.versionDiffs.some(
        (d) =>
          d.entityType === opts.entityType &&
          d.entityId === opts.entity.id &&
          d.patch === patchVer,
      ),
    );

  if (!isAvailable) {
    return {
      version: target,
      entityType: opts.entityType,
      entityId: opts.entity.id,
      isAvailable: false,
      isDeprecated,
      introducedInPatch,
      deprecatedInPatch,
      entity: null,
      appliedPatches,
    };
  }

  const reconstructed = reconstructEntityAtVersion(
    opts.entity,
    opts.entityType,
    target,
    current,
    opts.versionDiffs,
    opts.patches,
  );

  return {
    version: target,
    entityType: opts.entityType,
    entityId: opts.entity.id,
    isAvailable: true,
    isDeprecated,
    introducedInPatch,
    deprecatedInPatch,
    entity: reconstructed,
    appliedPatches,
  };
}

// ---------------------------------------------------------------------------
// Server / Node data loading with module memoization
// ---------------------------------------------------------------------------

let cachedPatches: STS2Patch[] | null = null;
let cachedChanges: STS2Change[] | null = null;
let cachedDiffs: EntityVersionDiff[] | null = null;
let cachedMetaVersion: string | null = null;
const cachedEntitiesByLocale = new Map<string, Record<string, unknown[]>>();

async function getSharedMeta(): Promise<{
  currentVersion: string;
  patches: STS2Patch[];
  changes: STS2Change[];
  versionDiffs: EntityVersionDiff[];
}> {
  if (!cachedPatches || !cachedChanges || !cachedDiffs || !cachedMetaVersion) {
    const [meta, patches, changes, versionDiffs] = await Promise.all([
      getCodexMeta(),
      getSTS2Patches(),
      getSTS2Changes(),
      getEntityVersionDiffs(),
    ]);
    cachedMetaVersion = meta.version;
    cachedPatches = patches;
    cachedChanges = changes;
    cachedDiffs = versionDiffs;
  }
  return {
    currentVersion: cachedMetaVersion,
    patches: cachedPatches,
    changes: cachedChanges,
    versionDiffs: cachedDiffs,
  };
}

async function loadRawEntities(
  entityType: VersionedEntityType,
  locale: GameLocale = "kor",
): Promise<{ id: string }[]> {
  const cacheKey = `${locale}:${entityType}`;
  let bucket = cachedEntitiesByLocale.get(cacheKey);
  if (bucket && bucket[entityType]) {
    return bucket[entityType] as { id: string }[];
  }

  let entities: { id: string }[] = [];
  switch (entityType) {
    case "card":
      entities = await getCodexCards({ includeDeprecated: true, gameLocale: locale });
      break;
    case "relic":
      entities = await getCodexRelics({ includeDeprecated: true, gameLocale: locale });
      break;
    case "potion":
      entities = await getCodexPotions({ gameLocale: locale });
      break;
    case "event":
      entities = await getCodexEvents({ gameLocale: locale });
      break;
    case "power":
      entities = await getCodexPowers({ includeDeprecated: true, gameLocale: locale });
      break;
    case "monster":
      entities = await getCodexMonsters({ gameLocale: locale });
      break;
    case "encounter":
      entities = await getCodexEncounters({ gameLocale: locale });
      break;
    case "enchantment":
      entities = await getCodexEnchantments({ gameLocale: locale });
      break;
    case "affliction":
      entities = await getCodexAfflictions({ gameLocale: locale });
      break;
    case "ancient":
      entities = await getCodexAncients({ gameLocale: locale });
      break;
    case "epoch":
      entities = await getCodexEpochs({ gameLocale: locale });
      break;
  }

  bucket = bucket ?? {};
  bucket[entityType] = entities;
  cachedEntitiesByLocale.set(cacheKey, bucket);

  return entities;
}

/**
 * High-level API to retrieve a single game entity at a specific version.
 */
export async function getVersionedEntity<T extends { id: string } = Record<string, unknown> & { id: string }>(
  query: GetVersionedEntityQuery,
): Promise<VersionedEntityResult<T>> {
  const { currentVersion, patches, changes, versionDiffs } = await getSharedMeta();
  const entities = await loadRawEntities(query.entityType, query.locale);
  const found = entities.find((e) => e.id.toLowerCase() === query.entityId.toLowerCase());

  if (!found) {
    return {
      version: normalizeVersion(query.version),
      entityType: query.entityType,
      entityId: query.entityId,
      isAvailable: false,
      isDeprecated: false,
      entity: null,
      appliedPatches: [],
    };
  }

  return resolveVersionedEntity<T>({
    entity: found as T,
    entityType: query.entityType,
    targetVersion: query.version,
    currentVersion,
    versionDiffs,
    patches,
    changes,
  });
}

/**
 * High-level API to retrieve all entities of a given type at a specific version.
 */
export async function getVersionedEntities<T extends { id: string } = Record<string, unknown> & { id: string }>(
  query: GetVersionedEntitiesQuery,
): Promise<VersionedEntityResult<T>[]> {
  const { currentVersion, patches, changes, versionDiffs } = await getSharedMeta();
  const entities = await loadRawEntities(query.entityType, query.locale);

  const results = entities.map((entity) =>
    resolveVersionedEntity<T>({
      entity: entity as T,
      entityType: query.entityType,
      targetVersion: query.version,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    }),
  );

  if (query.includeUnavailable) {
    return results;
  }

  return results.filter((r) => r.isAvailable);
}
