import sts2Meta from "../../data/sts2/meta.json";

export const STS2_IMAGE_CACHE_BUSTER = `v${sts2Meta.version}`;

export function cacheBustSts2ImageUrl(src: string): string {
  if (!src.startsWith("/images/sts2/")) return src;

  const hashIndex = src.indexOf("#");
  const beforeHash = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);

  if (!params.has("v")) {
    params.set("v", STS2_IMAGE_CACHE_BUSTER);
  }

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}
