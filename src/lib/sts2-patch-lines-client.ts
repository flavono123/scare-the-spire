import type { STS2PatchLine } from "@/lib/types";

let fullPatchLinesPromise: Promise<STS2PatchLine[]> | null = null;

/**
 * The full patch line list, shared across the session once it loads. A failed
 * request is not kept, so the next caller asks again.
 */
export function loadFullSts2PatchLines(): Promise<STS2PatchLine[]> {
  if (fullPatchLinesPromise) return fullPatchLinesPromise;
  const request: Promise<STS2PatchLine[]> = fetch("/generated/sts2-patch-lines.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load STS2 patch lines: ${response.status}`);
      }
      return response.json() as Promise<STS2PatchLine[]>;
    })
    .catch((error: unknown) => {
      if (fullPatchLinesPromise === request) fullPatchLinesPromise = null;
      throw error;
    });
  fullPatchLinesPromise = request;
  return request;
}
