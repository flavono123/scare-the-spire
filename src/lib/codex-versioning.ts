import { reconstructEntityAtVersion } from "./entity-versioning";
import { withEntityLifecycleForVersion, type EntityLifecycle } from "./entity-lifecycle";
import type { EntityVersionDiff, STS2Change, STS2Patch, VersionedEntityType } from "./types";

const VERSIONED_ENTITY_TYPES = new Set<string>([
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
]);

export interface CodexVersionContext {
  selectedVersion?: string;
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

export function isVersionedEntityType(entityType: string): entityType is VersionedEntityType {
  return VERSIONED_ENTITY_TYPES.has(entityType);
}

export function normalizeVersionedEntityType(entityType: string): VersionedEntityType | null {
  if (entityType === "enemy") return "monster";
  if (entityType === "blessing") return "relic";
  return isVersionedEntityType(entityType) ? entityType : null;
}

export function versionCodexEntities<T extends EntityLifecycle>(
  entities: readonly T[],
  entityType: VersionedEntityType,
  context: CodexVersionContext,
): T[] {
  const selectedVersion = context.selectedVersion ?? context.currentVersion;
  const shouldReconstruct = Boolean(
    selectedVersion &&
    context.currentVersion &&
    context.versionDiffs &&
    context.patches &&
    selectedVersion !== context.currentVersion,
  );
  const reconstructed = shouldReconstruct
    ? entities.map((entity) => reconstructEntityAtVersion(
      entity,
      entityType,
      selectedVersion!,
      context.currentVersion!,
      context.versionDiffs!,
      context.patches!,
    ))
    : [...entities];

  return selectedVersion
    ? withEntityLifecycleForVersion(reconstructed, selectedVersion, {
      changes: context.changes,
      entityType,
    })
    : reconstructed;
}
