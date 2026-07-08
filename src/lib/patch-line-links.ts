import type { STS2PatchLine } from "@/lib/types";

export function patchVersionPath(patch: string): string {
  return patch.replace(/^v/, "");
}

export function patchLineAnchorId(patchLineId: string): string {
  return `patch-line-${patchLineId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function patchLineHref(patchLine: STS2PatchLine): string {
  return `/patches/${patchVersionPath(patchLine.patch)}#${patchLineAnchorId(patchLine.id)}`;
}
