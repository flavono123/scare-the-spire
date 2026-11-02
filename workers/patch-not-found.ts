/** Not-found page of the prefixless Korean paths; the others use their path segment. */
export const PATCH_NOT_FOUND_KO_SEGMENT = "ko";

export function patchNotFoundAssetPath(segment: string): string {
  return `/_patches/not-found/${segment}/index.html`;
}
