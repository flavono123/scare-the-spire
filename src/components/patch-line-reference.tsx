"use client";

import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { RichText } from "@/components/rich-text";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PatchArtThumbnail } from "@/components/patches/patch-art";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { patchLineHref } from "@/lib/patch-line-links";
import { patchLineRichText } from "@/lib/patch-line-display";
import { getPatchVersionLabel } from "@/lib/sts2-patch-labels";
import { resolvePatchArt, type ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { STS2Patch, STS2PatchLine } from "@/lib/types";
import { cn } from "@/lib/utils";

const FALLBACK_PATCH_ART: ResolvedPatchArt = {
  imageUrl: "/images/sts2/nav/patch_notes_icon.png",
  alt: "Patch notes",
  objectPosition: "center",
};

function findPatch(patches: STS2Patch[] | undefined, patchLine: STS2PatchLine): STS2Patch | undefined {
  return patches?.find((patch) =>
    patch.id === patchLine.patch
    || patch.version === patchLine.version
    || `v${patch.version}` === patchLine.patch,
  );
}

export function PatchLineReferenceText({
  patchLine,
  serviceLocale,
  className,
}: {
  patchLine: STS2PatchLine;
  serviceLocale: ServiceLocale;
  className?: string;
}) {
  return (
    <RichText
      text={patchLineRichText(patchLine, serviceLocale)}
      className={className}
    />
  );
}

export function PatchLineReferenceBlock({
  patchLine,
  serviceLocale,
  patches,
  entities,
  compact = false,
  clickable = true,
  className,
  trailingAction,
}: {
  patchLine: STS2PatchLine;
  serviceLocale: ServiceLocale;
  patches?: STS2Patch[];
  entities?: EntityInfo[];
  compact?: boolean;
  clickable?: boolean;
  className?: string;
  trailingAction?: ReactNode;
}) {
  const patch = findPatch(patches, patchLine);
  const art = useMemo(() => {
    if (!patch) return FALLBACK_PATCH_ART;
    const entitiesByKey = new Map((entities ?? []).map((entity) => [`${entity.type}:${entity.id}`, entity]));
    return resolvePatchArt(patch, entitiesByKey, serviceLocale);
  }, [entities, patch, serviceLocale]);
  const versionLabel = patch ? getPatchVersionLabel(patch, serviceLocale) : patchLine.patch;
  const title = patch ? (serviceLocale === "ko" ? patch.titleKo : patch.title) : null;
  const href = clickable ? localizeHref(patchLineHref(patchLine), serviceLocale) : null;
  const header = (
    <div className="flex min-w-0 items-start gap-2.5">
      <PatchArtThumbnail art={art} className={compact ? "h-9 w-12" : undefined} />
      <div className="min-w-0">
        <p className={cn("font-medium text-yellow-500/90", compact ? "text-xs" : "text-sm")}>
          <span>{versionLabel}</span>
          {title && (
            <span className="ml-1.5 text-muted-foreground">
              {title}
            </span>
          )}
        </p>
        {patchLine.section.length > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/75">
            {patchLine.section.join(" / ")}
          </p>
        )}
      </div>
    </div>
  );
  const lineClassName = cn(
    "block rounded px-2 py-1.5 text-left leading-relaxed text-muted-foreground",
    "transition-colors hover:bg-white/[0.035] hover:text-foreground",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-500/30",
    compact ? "text-xs" : "text-sm",
  );
  const line = (
    <span className={lineClassName}>
      <PatchLineReferenceText patchLine={patchLine} serviceLocale={serviceLocale} />
    </span>
  );
  const rootClassName = cn(
    "relative space-y-1.5",
    trailingAction && "pr-8",
    className,
  );

  return (
    <div className={rootClassName}>
      {header}
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="block"
          data-patch-line-reference
          data-patch-line-id={patchLine.id}
        >
          {line}
        </Link>
      ) : (
        <div
          data-patch-line-reference
          data-patch-line-id={patchLine.id}
        >
          {line}
        </div>
      )}
      {trailingAction}
    </div>
  );
}
