import assert from "node:assert/strict";

import { staticAssetAliasRedirectPath } from "../workers/static-asset-aliases";

assert.equal(staticAssetAliasRedirectPath("/api/search-index"), "/generated/search-index.json");
assert.equal(
  staticAssetAliasRedirectPath("/comment-entities/sts2"),
  "/generated/comment-entities-sts2.json",
);
assert.equal(staticAssetAliasRedirectPath("/icon-192.png"), "/apple-icon.png");
assert.equal(staticAssetAliasRedirectPath("/apple-touch-icon.png"), "/apple-icon.png");
assert.equal(staticAssetAliasRedirectPath("/apple-touch-icon-precomposed.png"), "/apple-icon.png");
assert.equal(staticAssetAliasRedirectPath("/apple-icon.png"), null);
assert.equal(staticAssetAliasRedirectPath("/generated/search-index.json"), null);
assert.equal(staticAssetAliasRedirectPath("/compendium/cards/bash"), null);

console.log("static-asset-aliases.spec.ts ok");
