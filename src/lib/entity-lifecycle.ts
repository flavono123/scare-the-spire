import { compareVersions } from "./entity-versioning";
import type { STS2Change, STS2EntityType } from "./types";

export interface EntityLifecycle {
  id: string;
  introducedInPatch?: string;
  deprecated?: boolean;
  deprecatedInPatch?: string;
}

function isAfterSelectedVersion(patchVersion: string | undefined, selectedVersion: string): boolean {
  if (!patchVersion || !selectedVersion) return false;
  return compareVersions(patchVersion, selectedVersion) > 0;
}

function isAtOrBeforeSelectedVersion(patchVersion: string | undefined, selectedVersion: string): boolean {
  if (!patchVersion || !selectedVersion) return false;
  return compareVersions(patchVersion, selectedVersion) <= 0;
}

function getChangeEntityTypes(entityType: STS2EntityType | undefined): Set<STS2EntityType> {
  if (entityType === "relic") return new Set(["relic", "blessing"]);
  if (entityType === "monster") return new Set(["monster", "enemy"]);
  return new Set(entityType ? [entityType] : []);
}

function getIntroducedInPatch(
  entity: EntityLifecycle,
  changes: readonly STS2Change[] | undefined,
  entityType: STS2EntityType | undefined,
): string | undefined {
  if (entity.introducedInPatch) return entity.introducedInPatch;
  if (!changes || !entityType) return undefined;

  const entityTypes = getChangeEntityTypes(entityType);
  return changes
    .filter((change) => (
      entityTypes.has(change.entityType) &&
      change.entityId === entity.id &&
      change.diffs.some((diff) => diff.attribute === "new")
    ))
    .map((change) => change.patch)
    .sort(compareVersions)[0];
}

export function isEntityAvailableInVersion(
  entity: EntityLifecycle,
  selectedVersion: string,
  changes?: readonly STS2Change[],
  entityType?: STS2EntityType,
): boolean {
  return !isAfterSelectedVersion(getIntroducedInPatch(entity, changes, entityType), selectedVersion);
}

export function isEntityDeprecatedInVersion(
  entity: EntityLifecycle,
  selectedVersion: string,
): boolean {
  if (!entity.deprecated) return false;
  if (!entity.deprecatedInPatch) return true;
  return isAtOrBeforeSelectedVersion(entity.deprecatedInPatch, selectedVersion);
}

export function withEntityLifecycleForVersion<T extends EntityLifecycle>(
  entities: readonly T[],
  selectedVersion: string,
  opts?: {
    changes?: readonly STS2Change[];
    entityType?: STS2EntityType;
  },
): T[] {
  return entities
    .filter((entity) => isEntityAvailableInVersion(entity, selectedVersion, opts?.changes, opts?.entityType))
    .map((entity) => ({
      ...entity,
      introducedInPatch: getIntroducedInPatch(entity, opts?.changes, opts?.entityType),
      deprecated: isEntityDeprecatedInVersion(entity, selectedVersion),
    }));
}
