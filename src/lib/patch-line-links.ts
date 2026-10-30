import { PATCH_LINE_ALIASES, resolveCanonicalPatchLineId } from "@/lib/resolve-story-patch-line";
import type { STS2PatchLine } from "@/lib/types";

// Patch ids are "v0.111.0", "build-23478716" or "backstab-2026-09-11";
// the /patches/[version] route segment is the id without that prefix.
export function patchVersionPath(patch: string): string {
  return patch.replace(/^(?:v(?=\d)|[a-z]+-)/, "");
}

export function patchLineAnchorId(patchLineId: string): string {
  const canonicalId = resolveCanonicalPatchLineId(patchLineId) ?? patchLineId;
  return `patch-line-${canonicalId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function resolveCanonicalAnchorId(rawAnchor: string): string {
  const stripped = rawAnchor.replace(/^#/, "");
  if (stripped.startsWith("patch-line-")) {
    for (const [legacyId, targetId] of Object.entries(PATCH_LINE_ALIASES)) {
      const rawLegacyAnchor = `patch-line-${legacyId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      if (stripped === rawLegacyAnchor) {
        return `patch-line-${targetId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      }
    }
  }
  return stripped;
}

export function patchLineHref(patchLine: STS2PatchLine): string {
  const canonicalId = resolveCanonicalPatchLineId(patchLine.id) ?? patchLine.id;
  return `/patches/${patchVersionPath(patchLine.patch)}#${patchLineAnchorId(canonicalId)}`;
}

