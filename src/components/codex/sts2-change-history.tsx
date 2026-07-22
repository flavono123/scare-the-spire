"use client";

import { ResourcePatchHistory } from "@/components/patches/resource-patch-history";
import type { CodexMonster } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import type {
  EntityVersionDiff,
  STS2Change,
  STS2EntityType,
  STS2Patch,
  StoryEntityType,
  VersionedEntityType,
} from "@/lib/types";

interface STS2ChangeHistoryProps {
  serviceLocale: ServiceLocale;
  entityType: STS2EntityType;
  changeEntityTypes?: STS2EntityType[];
  versionEntityType?: VersionedEntityType;
  entityId: string;
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  patches?: STS2Patch[];
  introducedInPatch?: string;
  deprecatedInPatch?: string;
  monster?: CodexMonster;
  monsters?: readonly CodexMonster[];
  emptyLabel: string;
}

function resourceType(entityType: STS2EntityType): StoryEntityType | null {
  if (entityType === "enemy") return "monster";
  if (entityType === "blessing") return null;
  return entityType;
}

export function STS2ChangeHistory({
  serviceLocale,
  entityType,
  entityId,
  emptyLabel,
}: STS2ChangeHistoryProps) {
  const type = resourceType(entityType);
  if (!type) {
    return <p className="font-game-text text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <ResourcePatchHistory
      serviceLocale={serviceLocale}
      entityType={type}
      entityId={entityId}
      emptyLabel={emptyLabel}
    />
  );
}
