"use client";

import { useMemo } from "react";
import Link from "next/link";
import type {
  EntityFieldDiff,
  EntityVersionDiff,
  STS2Change,
  STS2EntityType,
  STS2Patch,
  VersionedEntityType,
} from "@/lib/types";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { DescriptionText } from "./codex-description";

interface STS2ChangeHistoryProps {
  serviceLocale: ServiceLocale;
  entityType: STS2EntityType;
  changeEntityTypes?: STS2EntityType[];
  versionEntityType?: VersionedEntityType;
  entityId: string;
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  patches?: STS2Patch[];
  emptyLabel: string;
}

interface HistoryEntry {
  patch: string;
  curatedChanges: STS2Change[];
  versionDiffs: EntityFieldDiff[];
}

const VERSIONED_ENTITY_TYPES: readonly VersionedEntityType[] = [
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "event",
];

function asVersionedEntityType(entityType: STS2EntityType): VersionedEntityType | null {
  return (VERSIONED_ENTITY_TYPES as readonly string[]).includes(entityType)
    ? entityType as VersionedEntityType
    : null;
}

function normalizePatchId(patch: string): string {
  return patch.startsWith("v") ? patch : `v${patch}`;
}

function patchHref(patch: string): string {
  return `/patches/${patch.replace(/^v/, "")}`;
}

function getPatch(
  patchVersion: string,
  patches: readonly STS2Patch[] | undefined,
): STS2Patch | undefined {
  const normalized = normalizePatchId(patchVersion);
  return patches?.find((patch) => patch.id === normalized || normalizePatchId(patch.version) === normalized);
}

function getPatchLabel(
  patchVersion: string,
  patches: readonly STS2Patch[] | undefined,
  serviceLocale: ServiceLocale,
): string {
  const patch = getPatch(patchVersion, patches);
  if (!patch) return patchVersion;
  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  return title ? `${patch.id} · ${title}` : patch.id;
}

function getPatchRank(
  patchVersion: string,
  patches: readonly STS2Patch[] | undefined,
): number {
  const normalized = normalizePatchId(patchVersion);
  const index = patches?.findIndex((patch) => patch.id === normalized || normalizePatchId(patch.version) === normalized) ?? -1;
  return index >= 0 ? index : -1;
}

function formatFieldLabel(field: string, serviceLocale: ServiceLocale): string {
  const labels: Record<string, { ko: string; en: string }> = {
    block: { ko: "방어도", en: "Block" },
    cost: { ko: "비용", en: "Cost" },
    damage: { ko: "피해", en: "Damage" },
    description: { ko: "효과", en: "Effect" },
    descriptionRaw: { ko: "효과 원문", en: "Raw effect" },
    flavor: { ko: "게임 문구", en: "Game text" },
    imageUrl: { ko: "이미지", en: "Image" },
    keywords: { ko: "키워드", en: "Keywords" },
    name: { ko: "이름", en: "Name" },
    pool: { ko: "출처", en: "Source" },
    rarity: { ko: "희귀도", en: "Rarity" },
    type: { ko: "타입", en: "Type" },
    upgrade: { ko: "강화", en: "Upgrade" },
  };
  const label = labels[field];
  if (label) return label[serviceLocale];

  if (field.startsWith("vars.")) {
    const varName = field.slice("vars.".length);
    return serviceLocale === "ko" ? `변수 ${varName}` : `Var ${varName}`;
  }
  if (field.startsWith("upgrade.")) {
    const upgradeField = formatFieldLabel(field.slice("upgrade.".length), serviceLocale);
    return serviceLocale === "ko" ? `강화 ${upgradeField}` : `Upgrade ${upgradeField}`;
  }
  return field;
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function hasLongValue(diff: EntityFieldDiff): boolean {
  const before = formatValue(diff.before);
  const after = formatValue(diff.after);
  return before.length > 32 || after.length > 32 || before.includes("\n") || after.includes("\n");
}

function DiffValue({ value }: { value: unknown }) {
  const formatted = formatValue(value);
  if (!formatted) return <span className="text-gray-600">∅</span>;
  if (typeof value === "string") {
    return <DescriptionText description={formatted} />;
  }
  return <>{formatted}</>;
}

function CuratedDiffLine({
  diff,
}: {
  diff: STS2Change["diffs"][0];
}) {
  const before = diff.beforeKo ?? diff.before;
  const after = diff.afterKo ?? diff.after;

  return (
    <div className="flex flex-wrap items-center gap-1.5 font-game-text text-xs text-gray-300">
      {diff.upgraded && (
        <span className="rounded bg-green-500/10 px-1 text-[10px] font-bold text-green-400">+</span>
      )}
      <span className="text-gray-500">{diff.displayNameKo || diff.displayName}</span>
      <span className="font-bold text-red-400">{String(before)}</span>
      <span className="text-gray-600">→</span>
      <span className="font-bold text-green-400">{String(after)}</span>
    </div>
  );
}

function VersionDiffLine({
  diff,
  serviceLocale,
}: {
  diff: EntityFieldDiff;
  serviceLocale: ServiceLocale;
}) {
  const label = formatFieldLabel(diff.field, serviceLocale);

  if (!hasLongValue(diff)) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 font-game-text text-xs text-gray-300">
        {diff.upgraded && (
          <span className="rounded bg-green-500/10 px-1 text-[10px] font-bold text-green-400">+</span>
        )}
        <span className="text-gray-500">{label}</span>
        <span className="font-bold text-red-400"><DiffValue value={diff.before} /></span>
        <span className="text-gray-600">→</span>
        <span className="font-bold text-green-400"><DiffValue value={diff.after} /></span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 font-game-text text-xs">
      <div className="mb-1 font-game-title text-[11px] text-gray-400">{label}</div>
      <div className="grid gap-1.5">
        <div className="rounded bg-red-500/5 px-2 py-1.5 text-red-200/90">
          <DiffValue value={diff.before} />
        </div>
        <div className="rounded bg-green-500/5 px-2 py-1.5 text-green-200/90">
          <DiffValue value={diff.after} />
        </div>
      </div>
    </div>
  );
}

function filterDuplicateDiffs(diffs: EntityFieldDiff[]): EntityFieldDiff[] {
  const hasDescription = diffs.some((diff) => diff.field === "description");
  return diffs.filter((diff) => !(hasDescription && diff.field === "descriptionRaw"));
}

export function STS2ChangeHistory({
  serviceLocale,
  entityType,
  changeEntityTypes,
  versionEntityType,
  entityId,
  changes,
  versionDiffs,
  patches,
  emptyLabel,
}: STS2ChangeHistoryProps) {
  const entries = useMemo<HistoryEntry[]>(() => {
    const byPatch = new Map<string, HistoryEntry>();
    const effectiveChangeTypes = new Set(changeEntityTypes ?? [entityType]);
    const effectiveVersionEntityType = versionEntityType ?? asVersionedEntityType(entityType);
    const ensureEntry = (patch: string) => {
      const normalizedPatch = normalizePatchId(patch);
      const existing = byPatch.get(normalizedPatch);
      if (existing) return existing;
      const entry: HistoryEntry = {
        patch: normalizedPatch,
        curatedChanges: [],
        versionDiffs: [],
      };
      byPatch.set(normalizedPatch, entry);
      return entry;
    };

    for (const change of changes ?? []) {
      if (!effectiveChangeTypes.has(change.entityType) || change.entityId !== entityId) continue;
      ensureEntry(change.patch).curatedChanges.push(change);
    }

    for (const versionDiff of versionDiffs ?? []) {
      if (!effectiveVersionEntityType || versionDiff.entityType !== effectiveVersionEntityType || versionDiff.entityId !== entityId) continue;
      ensureEntry(versionDiff.patch).versionDiffs.push(...versionDiff.diffs);
    }

    return [...byPatch.values()]
      .map((entry) => ({
        ...entry,
        versionDiffs: filterDuplicateDiffs(entry.versionDiffs),
      }))
      .sort((a, b) => {
        const rankDiff = getPatchRank(b.patch, patches) - getPatchRank(a.patch, patches);
        return rankDiff || b.patch.localeCompare(a.patch);
      });
  }, [changeEntityTypes, changes, entityId, entityType, patches, versionDiffs, versionEntityType]);

  if (entries.length === 0) {
    return <p className="font-game-text text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const patch = getPatch(entry.patch, patches);
        const summary = entry.curatedChanges
          .map((change) => serviceLocale === "ko" ? change.summaryKo ?? change.summary : change.summary ?? change.summaryKo)
          .filter((text): text is string => Boolean(text))
          .join(" ");
        const curatedDiffs = entry.curatedChanges.flatMap((change) => change.diffs);
        const hasVersionDiffs = entry.versionDiffs.length > 0;

        return (
          <Link
            key={entry.patch}
            href={localizeHref(patchHref(entry.patch), serviceLocale)}
            className="block rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-gray-300 transition-colors hover:border-yellow-500/40 hover:text-yellow-300"
          >
            <div className="font-game-title text-xs text-yellow-500">
              {getPatchLabel(entry.patch, patches, serviceLocale)}
            </div>
            {(patch?.date || entry.curatedChanges.some((change) => change.date)) && (
              <div className="mt-0.5 text-[10px] text-gray-500">
                {entry.curatedChanges.find((change) => change.date)?.date ?? patch?.date}
              </div>
            )}
            {summary && (
              <p className="mt-1 font-game-text text-xs leading-relaxed text-gray-400">
                {summary}
              </p>
            )}
            <div className="mt-2 space-y-1.5">
              {hasVersionDiffs
                ? entry.versionDiffs.map((diff, index) => (
                    <VersionDiffLine
                      key={`${entry.patch}-${diff.field}-${diff.upgraded ? "upgraded" : "base"}-${index}`}
                      diff={diff}
                      serviceLocale={serviceLocale}
                    />
                  ))
                : curatedDiffs.map((diff, index) => (
                    <CuratedDiffLine key={`${entry.patch}-${diff.attribute}-${index}`} diff={diff} />
                  ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
