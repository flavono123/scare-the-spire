/**
 * Public URLs that used to be a second copy of an existing static file.
 * The thin Worker and Next redirects send them to the canonical asset so
 * Cloudflare does not have to store both.
 */
export const STATIC_ASSET_ALIAS_REDIRECTS = {
  "/api/search-index": "/generated/search-index.json",
  "/comment-entities/sts2": "/generated/comment-entities-sts2.json",
  "/apple-touch-icon.png": "/apple-icon.png",
  "/apple-touch-icon-precomposed.png": "/apple-icon.png",
  "/icon-192.png": "/apple-icon.png",
} as const;

export function staticAssetAliasRedirectPath(pathname: string): string | null {
  return STATIC_ASSET_ALIAS_REDIRECTS[pathname as keyof typeof STATIC_ASSET_ALIAS_REDIRECTS] ?? null;
}
