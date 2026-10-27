import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  publicAssetExcludeReason,
  UNUSED_PUBLIC_SOURCES,
} from "./cloudflare-asset-excludes.mjs";
import {
  findReferencedExcludedAssets,
  findUnreachableNextStatic,
} from "./prune-cf-unreferenced-assets.mjs";

function write(root: string, relativePath: string, content = "") {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const root = mkdtempSync(path.join(tmpdir(), "prune-cf-assets-"));
try {
  const assets = path.join(root, "assets");
  const publicDir = path.join(root, "public");

  // Runtime: split chunk by full path, async chunk by id + content hash.
  write(
    assets,
    "_next/static/chunks/webpack-1111111111111111.js",
    'b.u=e=>1234===e?"static/chunks/1234-2222222222222222.js":"static/chunks/"+e+"."+({77:"3333333333333333"})[e]+".js";'
      + 'b.miniCssF=e=>"static/css/4444444444444444.css"',
  );
  write(assets, "_next/static/chunks/main-app-5555555555555555.js");
  write(assets, "_next/static/chunks/1234-2222222222222222.js");
  write(assets, "_next/static/chunks/77.3333333333333333.js");
  write(assets, "_next/static/css/4444444444444444.css", "a{background:url(/_next/static/media/font.6666666666666666.woff2)}");
  write(assets, "_next/static/media/font.6666666666666666.woff2");
  write(assets, "_next/static/chunks/app/[gameLocale]/page-7777777777777777.js");
  // Only the unserved dev page and route handlers reference these.
  write(assets, "_next/static/chunks/9999-8888888888888888.js");
  write(assets, "_next/static/chunks/app/(main)/dev/admin/page-a8781ab197d0fd93.js");
  write(assets, "_next/static/chunks/app/api/link-preview/route-a8781ab197d0fd93.js");
  write(assets, "_next/static/chunks/framework-9999999999999999.js");
  write(assets, "_next/static/build-id/_buildManifest.js");

  write(
    assets,
    "_cf_static_pages/index.html",
    '<script src="/_next/static/chunks/webpack-1111111111111111.js"></script>'
      + '<script src="/_next/static/chunks/main-app-5555555555555555.js"></script>'
      + '<script src="/_next/static/chunks/app/%5BgameLocale%5D/page-7777777777777777.js"></script>'
      + '<img src="/images/live.webp">',
  );
  write(assets, "_cf_static_pages/index.rsc", '1:I["static/chunks/1234-2222222222222222.js"]');

  const result = findUnreachableNextStatic(assets);
  assert.deepEqual(result.unreachable, [
    "_next/static/build-id/_buildManifest.js",
    "_next/static/chunks/9999-8888888888888888.js",
    "_next/static/chunks/app/(main)/dev/admin/page-a8781ab197d0fd93.js",
    "_next/static/chunks/app/api/link-preview/route-a8781ab197d0fd93.js",
    "_next/static/chunks/framework-9999999999999999.js",
  ]);
  assert.ok(result.reachable.includes("_next/static/chunks/77.3333333333333333.js"), "async chunk via hash map");
  assert.ok(result.reachable.includes("_next/static/media/font.6666666666666666.woff2"), "CSS url()");
  assert.ok(
    result.reachable.includes("_next/static/chunks/app/[gameLocale]/page-7777777777777777.js"),
    "URL-encoded page chunk path",
  );

  // Without served pages nothing reaches the runtime, so pruning refuses to run.
  const empty = path.join(root, "empty");
  write(empty, "_next/static/chunks/webpack-1111111111111111.js");
  write(empty, "_next/static/chunks/main-app-5555555555555555.js");
  assert.throws(() => findUnreachableNextStatic(empty), /refusing to prune/);

  // Exclude rules.
  write(publicDir, "spine/sts2/vfx/spine-vfx.atlas", "laser.png\n");
  write(publicDir, "spine/sts2/vfx/laser.png");
  write(publicDir, "spine/sts2/vfx/vfx_laser/laser.png");
  write(publicDir, "spine/sts2/vfx/vfx_laser/laser.atlas");
  write(publicDir, "spine/sts2/vfx/vfx_laser/laser.skel");
  write(publicDir, "spine/sts2/vfx/vfx_new/new.png");
  write(publicDir, "images/game-assets/materials/card_frame_red_mat.tres");
  write(publicDir, "images/live.webp");
  write(publicDir, "fonts/GyeonggiCheonnyeonBatangBold.ttf");
  write(publicDir, "images/.DS_Store");

  assert.ok(publicAssetExcludeReason("spine/sts2/vfx/vfx_laser/laser.png", publicDir));
  assert.ok(publicAssetExcludeReason("spine/sts2/vfx/vfx_laser/laser.atlas", publicDir));
  assert.equal(publicAssetExcludeReason("spine/sts2/vfx/vfx_laser/laser.skel", publicDir), null);
  assert.equal(publicAssetExcludeReason("spine/sts2/vfx/laser.png", publicDir), null);
  assert.equal(publicAssetExcludeReason("spine/sts2/vfx/spine-vfx.atlas", publicDir), null);
  assert.equal(
    publicAssetExcludeReason("spine/sts2/vfx/vfx_new/new.png", publicDir),
    null,
    "A VFX page with no root copy stays uploaded",
  );
  assert.ok(publicAssetExcludeReason("images/game-assets/materials/card_frame_red_mat.tres", publicDir));
  assert.ok(publicAssetExcludeReason("images/.DS_Store", publicDir));
  assert.ok(publicAssetExcludeReason("fonts/GyeonggiCheonnyeonBatangBold.ttf", publicDir));
  assert.equal(publicAssetExcludeReason("fonts/GyeonggiCheonnyeonBatangBold.woff2", publicDir), null);
  assert.equal(publicAssetExcludeReason("images/live.webp", publicDir), null);
  for (const relativePath of UNUSED_PUBLIC_SOURCES.keys()) {
    assert.ok(publicAssetExcludeReason(relativePath, publicDir), relativePath);
  }

  const clean = findReferencedExcludedAssets(assets, publicDir);
  assert.equal(clean.referenced.length, 0);
  assert.equal(clean.excluded.length, 5);

  write(assets, "_next/static/chunks/main-app-5555555555555555.js", 'src:"/fonts/GyeonggiCheonnyeonBatangBold.ttf"');
  const referenced = findReferencedExcludedAssets(assets, publicDir);
  assert.deepEqual(referenced.referenced, [
    {
      asset: "/fonts/GyeonggiCheonnyeonBatangBold.ttf",
      from: "_next/static/chunks/main-app-5555555555555555.js",
    },
  ]);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("prune-cf-unreferenced-assets spec passed");
