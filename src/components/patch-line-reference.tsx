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
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        <PatchArtThumbnail art={art} className={compact ? "h-9 w-12" : undefined} />
        <div className="min-w-0">
          <p className={cn("font-medium text-yellow-500", compact ? "text-xs" : "text-sm")}>
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
      <p className={cn("mt-2 leading-relaxed text-foreground", compact ? "text-xs" : "text-sm")}>
        <PatchLineReferenceText patchLine={patchLine} serviceLocale={serviceLocale} />
      </p>
    </>
  );
  const blockClassName = cn(
    "block rounded-md border border-yellow-500/25 bg-yellow-500/5 px-3 py-2 text-left",
    href && "transition-colors hover:border-yellow-500/45 hover:bg-yellow-500/10",
    trailingAction && "pr-10",
    className,
  );

  return (
    <div className="relative">
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className={blockClassName}
          data-patch-line-reference
          data-patch-line-id={patchLine.id}
        >
          {body}
        </Link>
      ) : (
        <div
          className={blockClassName}
          data-patch-line-reference
          data-patch-line-id={patchLine.id}
        >
          {body}
        </div>
      )}
      {trailingAction}
    </div>
  );
}
