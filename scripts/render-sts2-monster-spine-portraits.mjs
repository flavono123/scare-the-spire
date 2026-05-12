#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "public/images/sts2/monsters-render");
const monstersPath = path.join(repoRoot, "data/sts2/kor/monsters.json");
const spineAssetsPath = path.join(repoRoot, "data/sts2/monster-spine-assets.json");
const spinePlayerPath = path.join(
  repoRoot,
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);

const DEFAULT_STAGE_SIZE = 512;
const DEFAULT_PADDING = 20;
const DEFAULT_SETTLE_MS = 800;
const PLACEHOLDER_ART_MONSTER_IDS = new Set([
  "GAS_BOMB",
  "LIVING_FOG",
  "THE_FORGOTTEN",
]);

const args = parseArgs(process.argv.slice(2));
const monsters = readJson(monstersPath);
const spineAssets = readJson(spineAssetsPath);
const monstersById = new Map(monsters.map((monster) => [monster.id, monster]));
const spineAssetsById = new Map(spineAssets.map((asset) => [asset.id, asset]));
const requestedIds = resolveRequestedIds(args);

if (requestedIds.length === 0) {
  console.error("No render targets. Pass --ids ID,ID or --all.");
  process.exit(1);
}

ensurePillowAvailable();

const server = await createStaticServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-sandbox",
  ],
});

let rendered = 0;
let skipped = 0;
try {
  for (const id of requestedIds) {
    const monster = monstersById.get(id);
    const asset = spineAssetsById.get(id);
    if (!monster) {
      console.warn(`skip ${id}: no monster data`);
      skipped += 1;
      continue;
    }
    if (!asset || asset.renderStatus !== "spine") {
      console.warn(`skip ${id}: no renderable Spine asset`);
      skipped += 1;
      continue;
    }
    if (PLACEHOLDER_ART_MONSTER_IDS.has(id) && !args.includePlaceholderArt) {
      console.warn(`skip ${id}: Spine texture is marked as placeholder art`);
      skipped += 1;
      continue;
    }

    const outputSlug = monsterRenderSlug(monster);
    const outputPath = path.join(outDir, `${outputSlug}.webp`);
    if (fs.existsSync(outputPath) && args.all && !args.force) {
      skipped += 1;
      continue;
    }

    await renderMonsterPortrait({ id, outputPath, baseUrl, browser });
    rendered += 1;
    console.log(`rendered ${id} -> ${path.relative(repoRoot, outputPath)}`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`done: rendered ${rendered}, skipped ${skipped}`);

function parseArgs(argv) {
  const parsed = {
    all: false,
    force: false,
    includePlaceholderArt: false,
    ids: [],
    padding: DEFAULT_PADDING,
    settleMs: DEFAULT_SETTLE_MS,
    stageSize: DEFAULT_STAGE_SIZE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--all") parsed.all = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--include-placeholder-art") parsed.includePlaceholderArt = true;
    else if (arg === "--id") parsed.ids.push(argv[++i]);
    else if (arg.startsWith("--id=")) parsed.ids.push(arg.slice("--id=".length));
    else if (arg === "--ids") parsed.ids.push(...argv[++i].split(","));
    else if (arg.startsWith("--ids=")) parsed.ids.push(...arg.slice("--ids=".length).split(","));
    else if (arg === "--padding") parsed.padding = Number(argv[++i]);
    else if (arg.startsWith("--padding=")) parsed.padding = Number(arg.slice("--padding=".length));
    else if (arg === "--settle-ms") parsed.settleMs = Number(argv[++i]);
    else if (arg.startsWith("--settle-ms=")) parsed.settleMs = Number(arg.slice("--settle-ms=".length));
    else if (arg === "--stage-size") parsed.stageSize = Number(argv[++i]);
    else if (arg.startsWith("--stage-size=")) parsed.stageSize = Number(arg.slice("--stage-size=".length));
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (!Number.isFinite(parsed.padding) || parsed.padding < 0) parsed.padding = DEFAULT_PADDING;
  if (!Number.isFinite(parsed.settleMs) || parsed.settleMs < 0) parsed.settleMs = DEFAULT_SETTLE_MS;
  if (!Number.isFinite(parsed.stageSize) || parsed.stageSize <= 0) parsed.stageSize = DEFAULT_STAGE_SIZE;

  parsed.ids = parsed.ids.map((id) => id.trim().toUpperCase()).filter(Boolean);
  return parsed;
}

function resolveRequestedIds(parsed) {
  if (parsed.all) {
    return spineAssets
      .filter((asset) => asset.renderStatus === "spine")
      .map((asset) => asset.id)
      .sort();
  }

  return [...new Set(parsed.ids)];
}

async function renderMonsterPortrait({ id, outputPath, baseUrl, browser }) {
  const stageSize = args.stageSize;
  const tmpPng = path.join(os.tmpdir(), `sts2-monster-render-${id.toLowerCase()}-${Date.now()}.png`);
  const page = await browser.newPage({
    viewport: { width: stageSize, height: stageSize },
    deviceScaleFactor: 1,
  });

  try {
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.warn(`${id} browser error: ${message.text()}`);
      }
    });
    await page.goto(`${baseUrl}/render/${id}`);
    await page.evaluate(() => window.renderDone);
    await page.screenshot({ path: tmpPng, omitBackground: true });
    cropAndWriteWebp(tmpPng, outputPath, args.padding);
  } finally {
    await page.close();
    fs.rmSync(tmpPng, { force: true });
  }
}

function createStaticServer() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/__spine/spine-player.js") {
      serveFile(response, spinePlayerPath, "application/javascript");
      return;
    }

    if (requestUrl.pathname.startsWith("/spine/")) {
      const filePath = path.join(repoRoot, "public", requestUrl.pathname);
      serveFile(response, filePath, mimeType(filePath));
      return;
    }

    const renderMatch = requestUrl.pathname.match(/^\/render\/([^/]+)$/);
    if (renderMatch) {
      const id = decodeURIComponent(renderMatch[1]).toUpperCase();
      const asset = spineAssetsById.get(id);
      const monster = monstersById.get(id);
      if (!asset || !monster) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(renderHtml(monster, asset));
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function renderHtml(monster, asset) {
  const animation = asset.idleAnimation || asset.animations[0];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      width: ${args.stageSize}px;
      height: ${args.stageSize}px;
      overflow: hidden;
      background: transparent;
    }
    #stage {
      position: absolute;
      inset: 0;
      width: ${args.stageSize}px;
      height: ${args.stageSize}px;
    }
    #stage canvas {
      image-rendering: auto;
    }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script src="/__spine/spine-player.js"></script>
  <script>
    window.renderDone = new Promise((resolve, reject) => {
      try {
        new spine.SpinePlayer(document.getElementById("stage"), {
          binaryUrl: ${JSON.stringify(asset.binaryUrl)},
          atlasUrl: ${JSON.stringify(asset.atlasUrl)},
          animation: ${JSON.stringify(animation)},
          animations: ${JSON.stringify(asset.animations)},
          skin: ${JSON.stringify(asset.skin ?? undefined)},
          skins: ${JSON.stringify(asset.skins)},
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: true,
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          viewport: {
            padLeft: "4%",
            padRight: "4%",
            padTop: "4%",
            padBottom: "4%",
            transitionTime: 0
          },
          success: (player) => {
            try {
              player.setAnimation(${JSON.stringify(animation)}, true);
              player.play();
              window.setTimeout(resolve, ${args.settleMs});
            } catch (error) {
              reject(error);
            }
          },
          error: (_player, message) => reject(new Error(message))
        });
      } catch (error) {
        reject(error);
      }
    });
  </script>
</body>
</html>`;
}

function cropAndWriteWebp(inputPng, outputPath, padding) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
from PIL import Image
import sys

src, dst, raw_padding = sys.argv[1], sys.argv[2], sys.argv[3]
padding = int(raw_padding)
image = Image.open(src).convert("RGBA")
alpha = image.getchannel("A")
bbox = alpha.getbbox()
if bbox is None:
    raise SystemExit("rendered image is fully transparent")
left, top, right, bottom = bbox
left = max(0, left - padding)
top = max(0, top - padding)
right = min(image.width, right + padding)
bottom = min(image.height, bottom + padding)
cropped = image.crop((left, top, right, bottom))
cropped.save(dst, "WEBP", lossless=True, quality=95, method=6)
`,
      inputPng,
      outputPath,
      String(padding),
    ],
    {
      env: {
        ...process.env,
        PYTHONPATH: [process.env.PYTHONPATH, "/tmp/sts2-spine-deps"].filter(Boolean).join(":"),
      },
      stdio: "pipe",
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "failed to crop rendered portrait");
  }
}

function ensurePillowAvailable() {
  const result = spawnSync("python3", ["-c", "from PIL import Image"], {
    env: {
      ...process.env,
      PYTHONPATH: [process.env.PYTHONPATH, "/tmp/sts2-spine-deps"].filter(Boolean).join(":"),
    },
    stdio: "ignore",
  });
  if (result.status !== 0) {
    console.error("Pillow is required. Run: python3 -m pip install --target /tmp/sts2-spine-deps Pillow");
    process.exit(1);
  }
}

function monsterRenderSlug(monster) {
  const rawSlug = monster.image_url?.split("/").pop()?.replace(/\.png$/, "");
  return rawSlug || monster.id.toLowerCase();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function serveFile(response, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  response.setHeader("content-type", contentType);
  response.end(fs.readFileSync(filePath));
}

function mimeType(filePath) {
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".atlas")) return "text/plain";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
