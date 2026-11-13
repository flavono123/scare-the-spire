// Main Worker build output. build-record.mjs writes its record at this root,
// outside the uploaded assets.
export const CLOUDFLARE_BUILD_DIR = ".cloudflare";

// Directory Wrangler uploads as the main Worker's static assets
// (wrangler.jsonc `assets.directory`), built by collect-cf-assets.mjs and
// copy-cf-static-pages.mjs.
export const CLOUDFLARE_ASSETS_DIR = `${CLOUDFLARE_BUILD_DIR}/assets`;

// Directory Wrangler uploads as the STS1 Worker's static assets
// (wrangler.sts1.jsonc `assets.directory`): STS1 Compendium detail pages and a
// copy of /_next/static, written by copy-cf-static-pages.mjs.
export const STS1_WORKER_ASSETS_DIR = ".sts1-worker/assets";
