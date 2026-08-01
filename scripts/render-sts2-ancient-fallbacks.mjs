#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/sts2/ancient-scene-assets.json"), "utf8"));
const spineAssets = new Map(
  JSON.parse(fs.readFileSync(path.join(repoRoot, "data/sts2/ancient-spine-assets.json"), "utf8"))
    .map((asset) => [asset.id, asset]),
);
const spinePlayerPath = path.join(repoRoot, "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js");
const requestedId = process.argv[2]?.toUpperCase();
const targets = manifest.filter((entry) => entry.spine && (!requestedId || entry.id === requestedId));
const server = await createStaticServer();
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

try {
  for (const entry of targets) {
    await renderFallback(entry, `http://127.0.0.1:${server.address().port}`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function renderFallback(entry, baseUrl) {
  const outputPath = path.join(repoRoot, "public", entry.fallback.path);
  const temporaryBase = path.join(os.tmpdir(), `sts2-ancient-${entry.id.toLowerCase()}-${Date.now()}`);
  const blackPath = `${temporaryBase}-black.png`;
  const whitePath = `${temporaryBase}-white.png`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1 });
  try {
    page.on("requestfailed", (request) => console.warn(`${entry.id} request failed: ${request.url()}`));
    page.on("response", (response) => {
      if (!response.ok()) console.warn(`${entry.id} response ${response.status()}: ${response.url()}`);
    });
    await captureMatte(page, `${baseUrl}/render/${entry.id}?bg=000000`, blackPath);
    await captureMatte(page, `${baseUrl}/render/${entry.id}?bg=ffffff`, whitePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    compositeMattes(
      blackPath,
      whitePath,
      entry.baseArt ? path.join(repoRoot, "public", entry.baseArt.path) : "",
      outputPath,
    );
    console.log(`rendered ${entry.id} fallback -> ${path.relative(repoRoot, outputPath)}`);
  } finally {
    await page.close();
    fs.rmSync(blackPath, { force: true });
    fs.rmSync(whitePath, { force: true });
  }
}

async function captureMatte(page, url, outputPath) {
  await page.goto(url);
  await page.evaluate(() => window.renderDone);
  await page.screenshot({ path: outputPath, omitBackground: false });
}

function createStaticServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/__spine/spine-player.js") {
      serveFile(response, spinePlayerPath, "application/javascript");
      return;
    }
    if (url.pathname.startsWith("/spine/") || url.pathname.startsWith("/images/")) {
      const filePath = path.join(repoRoot, "public", url.pathname);
      serveFile(response, filePath, mimeType(filePath));
      return;
    }
    const match = url.pathname.match(/^\/render\/([^/]+)$/);
    const entry = match ? manifest.find((item) => item.id === decodeURIComponent(match[1]).toUpperCase()) : null;
    const asset = entry?.spine ? spineAssets.get(entry.spine.assetId) : null;
    if (!entry?.spine || !asset) {
      response.writeHead(404).end("not found");
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(renderHtml(entry, asset, url.searchParams.get("bg") === "ffffff" ? "ffffff" : "000000"));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function renderHtml(entry, asset, background) {
  const transform = entry.spine.transform;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body,#stage{margin:0;width:1280px;height:600px;overflow:hidden;background:#${background}}
body{position:relative}
#stage{position:absolute;inset:0}
</style></head><body>
<div id="stage"></div><script src="/__spine/spine-player.js"></script><script>
const transform=${JSON.stringify(transform)};
window.renderDone=new Promise((resolve,reject)=>{
  const applyTransform=(player)=>{
    if(!player.skeleton)return;
    player.skeleton.x=transform.position.x;
    player.skeleton.y=1200-transform.position.y;
    player.skeleton.scaleX=transform.scale.x;
    player.skeleton.scaleY=transform.scale.y;
  };
  new spine.SpinePlayer(document.getElementById("stage"),{
    binaryUrl:${JSON.stringify(asset.binaryUrl)},atlasUrl:${JSON.stringify(asset.atlasUrl)},
    animation:${JSON.stringify(entry.spine.animation)},alpha:true,backgroundColor:"00000000",
    preserveDrawingBuffer:false,premultipliedAlpha:false,showControls:false,showLoading:false,
    viewport:{x:0,y:0,width:2560,height:1200,padLeft:"0%",padRight:"0%",padTop:"0%",padBottom:"0%",transitionTime:0},
    update:applyTransform,
    success:(player)=>{try{applyTransform(player);const track=player.setAnimation(${JSON.stringify(entry.spine.animation)},true);track.trackTime=0;player.pause();setTimeout(resolve,120)}catch(error){reject(error)}},
    error:(_player,message)=>reject(new Error(message))
  });
});
</script></body></html>`;
}

function compositeMattes(blackPath, whitePath, basePath, outputPath) {
  const result = spawnSync("python3", ["-c", [
    "from PIL import Image",
    "import sys",
    "black=Image.open(sys.argv[1]).convert('RGB')",
    "white=Image.open(sys.argv[2]).convert('RGB')",
    "pixels=[]",
    "for b,w in zip(black.getdata(),white.getdata()):",
    "    alpha=max(0,min(255,255-max(max(0,w[i]-b[i]) for i in range(3))))",
    "    pixels.append((0,0,0,0) if alpha==0 else tuple(max(0,min(255,round(b[i]*255/alpha))) for i in range(3))+(alpha,))",
    "body=Image.new('RGBA',black.size)",
    "body.putdata(pixels)",
    "base=Image.open(sys.argv[3]).convert('RGBA').resize(black.size,Image.Resampling.LANCZOS) if sys.argv[3] else Image.new('RGBA',black.size,(7,9,16,255))",
    "Image.alpha_composite(base,body).convert('RGB').save(sys.argv[4],'WEBP',quality=90,method=6)",
  ].join("\n"), blackPath, whitePath, basePath, outputPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "failed to encode Ancient fallback");
}

function serveFile(response, filePath, contentType) {
  if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath)) {
    response.writeHead(404).end("not found");
    return;
  }
  response.setHeader("content-type", contentType);
  fs.createReadStream(filePath).pipe(response);
}

function mimeType(filePath) {
  if (filePath.endsWith(".atlas")) return "text/plain; charset=utf-8";
  if (filePath.endsWith(".skel")) return "application/octet-stream";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
