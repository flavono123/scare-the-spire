// Main Worker build output. build-record.mjs writes its record at this root,
// outside the uploaded assets.
export const CLOUDFLARE_BUILD_DIR = ".cloudflare";

// Directory Wrangler uploads as the main Worker's static assets
// (wrangler.jsonc `assets.directory`), built by collect-cf-assets.mjs and
// copy-cf-static-pages.mjs.
export const CLOUDFLARE_ASSETS_DIR = `${CLOUDFLARE_BUILD_DIR}/assets`;
