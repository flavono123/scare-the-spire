// Self-check for parseDeployLog against an excerpt of a real production run log.
import assert from "node:assert/strict";

import { parseDeployLog } from "./lib/cloudflare-limits";

const p = "Deploy main to Cloudflare Workers\tUNKNOWN STEP\t2026-11-10T07:35:37.4355068Z ";
const log = [
  `${p}✨ Read 2853 files from the assets directory /home/runner/work/x/x/.patch-worker/assets`,
  `${p}✨ Success! Uploaded 48 files (1904 already uploaded) (2.76 sec)`,
  `${p}Total Upload: 2.35 KiB / gzip: 1.23 KiB`,
  `${p}Current Version ID: 9ce0b308-e5b1-4d9d-b292-4e346e90ad5f`,
  `${p}Cloudflare static assets: 18,844 used / 19,500 budget / 20,000 limit (headroom 656 to budget, 1,156 to limit)`,
  `${p}Largest Cloudflare static asset: 5.67 MiB (.cloudflare/assets/spine/sts2/a.png)`,
  `${p}Cloudflare static asset groups: {"compendium/cards":4000,"images/sts2":3000}`,
  `${p}✨ Read 19810 files from the assets directory /home/runner/work/x/x/.cloudflare/assets`,
  `${p}Total Upload: 349.26 KiB / gzip: 102.48 KiB`,
  `${p}Cloudflare Worker upload size: 349.26 KiB / gzip 102.48 KiB`,
  `${p}✨ Read 19810 files from the assets directory /home/runner/work/x/x/.cloudflare/assets`,
  `${p}✨ Success! Uploaded 12633 files (6210 already uploaded) (53.35 sec)`,
  `${p}Current Version ID: 4a643e07-dae0-41cb-b0f6-66c8fd8ba562`,
  // The patch Worker redeploys after main; the later version wins.
  `${p}✨ Read 2853 files from the assets directory /home/runner/work/x/x/.patch-worker/assets`,
  `${p}✨ Success! Uploaded 28 files (1924 already uploaded) (1.68 sec)`,
  `${p}Current Version ID: bea10b9e-d10a-48fa-b778-32f069131f4b`,
].join("\n");

const parsed = parseDeployLog(log);
assert.deepEqual(parsed.workers["scare-the-spire"], {
  assetFiles: 18_843,
  versionId: "4a643e07-dae0-41cb-b0f6-66c8fd8ba562",
  gzipKiB: 102.48,
});
assert.deepEqual(parsed.workers["scare-the-spire-patches"], {
  assetFiles: 1952,
  versionId: "bea10b9e-d10a-48fa-b778-32f069131f4b",
  gzipKiB: 1.23,
});
assert.equal(parsed.staticAssets?.used, 18_844);
assert.equal(parsed.staticAssets?.largestPath, "spine/sts2/a.png");
assert.deepEqual(parsed.staticAssets?.groups, { "compendium/cards": 4000, "images/sts2": 3000 });

// A patch-only run: no main stats, so the static check is not attributed to it.
const patchOnly = parseDeployLog(log.split("\n").slice(0, 4).join("\n"));
assert.equal(patchOnly.workers["scare-the-spire"], undefined);
assert.equal(patchOnly.staticAssets, null);

console.log("cloudflare-limits.spec.ts ok");
