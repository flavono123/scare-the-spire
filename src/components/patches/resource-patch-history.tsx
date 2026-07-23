"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  buildEntityLookup,
  PatchNoteInlineText,
} from "@/components/patch-note-renderer";
import { PatchArtThumbnail } from "@/components/patches/patch-art";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { localizeHref, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { patchLineMarkdownForService } from "@/lib/patch-line-display";
import { patchLineHref } from "@/lib/patch-line-links";
import {
  findResourcePatchIndexResource,
  RESOURCE_PATCH_INDEX_ASSET,
  resourcePatchLines,
  type ResourcePatchIndexData,
} from "@/lib/resource-patch-index";
import { getPatchVersionLabel } from "@/lib/sts2-patch-labels";
import { resolvePatchArt, type ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { STS2Patch, STS2PatchLine, StoryEntityType } from "@/lib/types";
import { serviceMessages } from "@/messages/service";

let resourcePatchIndexPromise: Promise<ResourcePatchIndexData> | null = null;

const FALLBACK_PATCH_ART: ResolvedPatchArt = {
  imageUrl: "/images/sts2/nav/patch_notes_icon.png",
  alt: "Patch notes",
  objectPosition: "center",
};

export function loadResourcePatchIndex(): Promise<ResourcePatchIndexData> {
  if (!resourcePatchIndexPromise) {
    resourcePatchIndexPromise = fetch(RESOURCE_PATCH_INDEX_ASSET)
      .then((response) => {
        if (!response.ok) throw new Error(`Resource patch index failed: ${response.status}`);
        return response.json() as Promise<ResourcePatchIndexData>;
      })
      .catch((error) => {
        resourcePatchIndexPromise = null;
        throw error;
      });
  }
  return resourcePatchIndexPromise;
}

function findPatch(patches: readonly STS2Patch[], line: STS2PatchLine): STS2Patch | undefined {
  return patches.find((patch) =>
    patch.id === line.patch
    || patch.version === line.version
    || `v${patch.version}` === line.patch,
  );
}

function dateLabel(date: string, serviceLocale: ServiceLocale): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return serviceLocale === "ko" ? `${year}.${month}.${day}` : `${year}-${month}-${day}`;
}

export function PatchMetaReferenceLink({
  patchLine,
  patches,
  serviceLocale,
  entitiesByKey,
}: {
  patchLine: STS2PatchLine;
  patches: readonly STS2Patch[];
  serviceLocale: ServiceLocale;
  entitiesByKey: Map<string, EntityInfo>;
}) {
  const patch = findPatch(patches, patchLine);
  const version = patch ? getPatchVersionLabel(patch, serviceLocale) : patchLine.patch;
  const originalTitle = patch?.title ?? serviceMessages[serviceLocale].patchChanges.tabs.notes;
  const patchType = patch
    ? serviceMessages[serviceLocale].patchChanges.types[patch.type]
    : null;
  const art = patch
    ? resolvePatchArt(patch, entitiesByKey, serviceLocale)
    : FALLBACK_PATCH_ART;

  return (
    <span className="group/patch-meta relative inline-flex shrink-0">
      <Link
        href={localizeHref(patchLineHref(patchLine), serviceLocale)}
        prefetch={false}
        className="game-inspect-cursor whitespace-nowrap font-game-text text-sm leading-relaxed spire-gold transition-colors hover:text-yellow-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/50"
      >
        {dateLabel(patchLine.date, serviceLocale)} {version}
      </Link>
      <span className="pointer-events-none absolute bottom-full right-0 z-50 hidden pb-2 group-hover/patch-meta:block group-focus-within/patch-meta:block">
        <span className="flex w-max max-w-[calc(100vw-1.5rem)] items-start gap-2.5">
          <PatchArtThumbnail
            art={art}
            className="h-12 w-[6.875rem] border-white/10 shadow-lg"
          />
          <GameHoverTip
            title={version}
            style={{ width: 230, maxWidth: "min(230px, calc(100vw - 140px))" }}
          >
            <span className="block text-[13px] leading-snug text-[#fff6e2]">
              {originalTitle}
            </span>
            <span className="mt-1.5 block whitespace-nowrap text-[12px] text-[#c9bdac]">
              {dateLabel(patchLine.date, serviceLocale)}
              {patchType && ` · ${patchType}`}
            </span>
          </GameHoverTip>
        </span>
      </span>
    </span>
  );
}

export function ResourcePatchChangeList({
  lines,
  patches,
  serviceLocale,
  gameLocale,
  trailingAction,
}: {
  lines: STS2PatchLine[];
  patches: readonly STS2Patch[];
  serviceLocale: ServiceLocale;
  gameLocale?: GameLocale;
  trailingAction?: (line: STS2PatchLine) => ReactNode;
}) {
  const { entities } = useCommentEntities();
  const entityLookup = useMemo(() => buildEntityLookup(entities), [entities]);
  const entitiesByKey = useMemo(
    () => new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity])),
    [entities],
  );

  return (
    <ul className="space-y-1">
      {lines.map((line) => (
        <li
          key={line.id}
          data-resource-patch-line={line.id}
          className="group/change ml-4 list-outside list-disc py-1 text-sm text-muted-foreground"
        >
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <span className="min-w-0 flex-1 font-game-text text-sm leading-relaxed text-gray-300">
              <PatchNoteInlineText
                markdown={patchLineMarkdownForService(line, serviceLocale)}
                lookup={entityLookup}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
              />
            </span>
            <span className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-start">
              <PatchMetaReferenceLink
                patchLine={line}
                patches={patches}
                serviceLocale={serviceLocale}
                entitiesByKey={entitiesByKey}
              />
              {trailingAction?.(line)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ResourcePatchHistory({
  serviceLocale,
  entityType,
  entityId,
  emptyLabel,
}: {
  serviceLocale: ServiceLocale;
  entityType: StoryEntityType;
  entityId: string;
  emptyLabel: string;
}) {
  const [data, setData] = useState<ResourcePatchIndexData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadResourcePatchIndex()
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = useMemo(() => {
    if (!data) return [];
    const resource = findResourcePatchIndexResource(data, entityType, entityId);
    return resource ? resourcePatchLines(data, resource) : [];
  }, [data, entityId, entityType]);

  if (!data && !failed) {
    return <p className="font-game-text text-sm text-gray-500">…</p>;
  }
  if (lines.length === 0 || !data) {
    return <p className="font-game-text text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <ResourcePatchChangeList
      lines={lines}
      patches={data.patches}
      serviceLocale={serviceLocale}
    />
  );
}
