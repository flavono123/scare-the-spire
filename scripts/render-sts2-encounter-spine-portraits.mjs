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
const outDir = path.join(repoRoot, "public/images/sts2/encounters-render");
const spineRoot = path.join(repoRoot, "public/spine/sts2/monsters");
const spinePlayerPath = path.join(
  repoRoot,
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);

const DECIMILLIPEDE_ENCOUNTER_X_OFFSET = -459;
const DECIMILLIPEDE_GAME_SCREEN_HEIGHT = 1080;
const DECIMILLIPEDE_SPINE_SCALE = 0.45;
// Source: bestiary_layout_decimillipede.tscn + decimillipede_elite.tscn slots.
// Browser actors are placed by their visible Spine folder order: front, middle, back.
const DECIMILLIPEDE_VIEWPORT = {
  x: 420,
  y: 240,
  width: 1120,
  height: 620,
};

const ENCOUNTER_CONFIGS = {
  DECIMILLIPEDE_ELITE: {
    outputSlug: "decimillipede_elite",
    stageWidth: 1200,
    stageHeight: 700,
    settleMs: 1200,
    viewport: DECIMILLIPEDE_VIEWPORT,
    parts: [
      {
        folder: "decimillipede_front",
        skel: "decimillipede1.skel",
        atlas: "decimillipede_front.atlas",
        x: 1103 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET + 318,
        y: toBrowserSpineY(740 - 19),
        scale: DECIMILLIPEDE_SPINE_SCALE,
        bones: {
          link_l_1: { x: -344.445, y: 228.889 },
        },
        zIndex: 10,
      },
      {
        folder: "decimillipede_middle",
        skel: "decimillipede2.skel",
        atlas: "decimillipede_middle.atlas",
        x: 1451 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET - 54,
        y: toBrowserSpineY(740 - 43),
        scale: DECIMILLIPEDE_SPINE_SCALE,
        bones: {
          link_l_2: { x: -442.222, y: 202.222 },
          link_r_2: { x: 220, y: 228.889 },
        },
        zIndex: 20,
      },
      {
        folder: "decimillipede_back",
        skel: "decimillipede3.skel",
        atlas: "decimillipede_back.atlas",
        x: 1797 + DECIMILLIPEDE_ENCOUNTER_X_OFFSET - 344,
        y: toBrowserSpineY(740 - 28),
        scale: DECIMILLIPEDE_SPINE_SCALE,
        bones: {
          link_r_3: { x: 286.667, y: 275.556 },
        },
        zIndex: 30,
      },
    ],
  },
};

function toBrowserSpineY(godotY) {
  return DECIMILLIPEDE_GAME_SCREEN_HEIGHT - godotY;
}

const args = parseArgs(process.argv.slice(2));
const requestedIds = resolveRequestedIds(args);

if (requestedIds.length === 0) {
  console.error("No render targets. Pass --ids ID,ID or --all.");
  process.exit(1);
}

ensurePillowAvailable();
fs.mkdirSync(outDir, { recursive: true });

const server = await createStaticServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader-webgl",
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
    const config = ENCOUNTER_CONFIGS[id];
    if (!config) {
      console.warn(`skip ${id}: no encounter render config`);
      skipped += 1;
      continue;
    }

    const outputPath = path.join(outDir, `${config.outputSlug}.webp`);
    if (fs.existsSync(outputPath) && !args.force) {
      skipped += 1;
      continue;
    }

    await renderEncounter({ id, config, outputPath, baseUrl, browser });
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
    ids: [],
    padding: 20,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--all") parsed.all = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--id") parsed.ids.push(argv[++i]);
    else if (arg.startsWith("--id=")) parsed.ids.push(arg.slice("--id=".length));
    else if (arg === "--ids") parsed.ids.push(...argv[++i].split(","));
    else if (arg.startsWith("--ids=")) parsed.ids.push(...arg.slice("--ids=".length).split(","));
    else if (arg === "--padding") parsed.padding = Number(argv[++i]);
    else if (arg.startsWith("--padding=")) parsed.padding = Number(arg.slice("--padding=".length));
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (!Number.isFinite(parsed.padding) || parsed.padding < 0) parsed.padding = 20;
  parsed.ids = parsed.ids.map((id) => id.trim().toUpperCase()).filter(Boolean);
  return parsed;
}

function resolveRequestedIds(parsed) {
  if (parsed.all) return Object.keys(ENCOUNTER_CONFIGS).sort();
  return [...new Set(parsed.ids)];
}

async function renderEncounter({ id, config, outputPath, baseUrl, browser }) {
  for (const part of config.parts) {
    const folder = path.join(spineRoot, part.folder);
    for (const file of [part.skel, part.atlas]) {
      if (!fs.existsSync(path.join(folder, file))) {
        throw new Error(`${id}: missing ${path.relative(repoRoot, path.join(folder, file))}`);
      }
    }
  }

  const tmpBase = path.join(os.tmpdir(), `sts2-encounter-render-${id.toLowerCase()}-${Date.now()}`);
  const tmpPng = `${tmpBase}.png`;
  const page = await browser.newPage({
    viewport: { width: config.stageWidth, height: config.stageHeight },
    deviceScaleFactor: 1,
  });

  try {
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.warn(`${id} browser error: ${message.text()}`);
      }
    });
    await captureTransparent(page, `${baseUrl}/render/${id}`, tmpPng);
    writeCroppedWebpFromPng(tmpPng, outputPath, args.padding);
  } finally {
    await page.close();
    fs.rmSync(tmpPng, { force: true });
  }
}

async function captureTransparent(page, url, outputPath) {
  await page.goto(url);
  await page.evaluate(() => window.renderDone);
  await page.screenshot({ path: outputPath, omitBackground: true });
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
      const config = ENCOUNTER_CONFIGS[id];
      if (!config) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(renderHtml(config));
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function renderHtml(config) {
  const partNodes = config.parts.map((part, index) => (
    `<div id="part-${index}" class="part" style="z-index:${part.zIndex}"></div>`
  )).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      width: ${config.stageWidth}px;
      height: ${config.stageHeight}px;
      overflow: hidden;
      background: transparent;
    }
    #stage {
      position: relative;
      width: ${config.stageWidth}px;
      height: ${config.stageHeight}px;
      overflow: hidden;
    }
    .part {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
  </style>
</head>
<body>
  <div id="stage">${partNodes}</div>
  <script src="/__spine/spine-player.js"></script>
  <script>
    const parts = ${JSON.stringify(config.parts)};
    window.renderDone = (async () => {
      for (let i = 0; i < parts.length; i += 1) {
        await createPart(parts[i], i);
      }
      await new Promise((resolve) => window.setTimeout(resolve, ${config.settleMs}));
    })();

    function createPart(part, index) {
      return new Promise((resolve, reject) => {
        new spine.SpinePlayer(document.getElementById("part-" + index), {
          binaryUrl: "/spine/sts2/monsters/" + part.folder + "/" + part.skel,
          atlasUrl: "/spine/sts2/monsters/" + part.folder + "/" + part.atlas,
          animation: "idle_loop",
          alpha: true,
          backgroundColor: "00000000",
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          viewport: {
            x: ${config.viewport.x},
            y: ${config.viewport.y},
            width: ${config.viewport.width},
            height: ${config.viewport.height},
            padLeft: "0%",
            padRight: "0%",
            padTop: "0%",
            padBottom: "0%",
            transitionTime: 0
          },
          update: (player) => {
            player.skeleton.x = part.x;
            player.skeleton.y = part.y;
            player.skeleton.scaleX = part.scale;
            player.skeleton.scaleY = part.scale;
            for (const [boneName, target] of Object.entries(part.bones)) {
              const bone = player.skeleton.findBone(boneName);
              if (!bone) continue;
              bone.x = target.x;
              bone.y = target.y;
            }
            player.skeleton.updateWorldTransform(2);
          },
          success: (player) => {
            player.skeleton.x = part.x;
            player.skeleton.y = part.y;
            player.skeleton.scaleX = part.scale;
            player.skeleton.scaleY = part.scale;
            for (const [boneName, target] of Object.entries(part.bones)) {
              const bone = player.skeleton.findBone(boneName);
              if (!bone) continue;
              bone.x = target.x;
              bone.y = target.y;
            }
            player.skeleton.updateWorldTransform(2);
            player.setAnimation("idle_loop", true);
            player.play();
            window.setTimeout(resolve, 300);
          },
          error: (_player, message) => reject(new Error(part.folder + ": " + message))
        });
      });
    }
  </script>
</body>
</html>`;
}

function writeCroppedWebpFromPng(inputPng, outputPath, padding) {
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
bbox = image.getchannel("A").getbbox()
if bbox is None:
    raise SystemExit("rendered image is fully transparent")
left, top, right, bottom = bbox
left = max(0, left - padding)
top = max(0, top - padding)
right = min(image.width, right + padding)
bottom = min(image.height, bottom + padding)
cropped = image.crop((left, top, right, bottom))
cropped.save(dst, "WEBP", lossless=True, quality=95, method=6, exact=True)
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
  if (filePath.endsWith(".atlas")) return "text/plain";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
