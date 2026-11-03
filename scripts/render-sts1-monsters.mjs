#!/usr/bin/env node
/**
 * Renders the still STS1 monster art into public/images/sts1/monsters.
 *
 * STS1 ships Spine 3.4 skeletons and the site's runtime reads 4.2, so each
 * skeleton is converted first. Only the first frame of the monster's opening
 * animation is kept: it is the only pose rendered, which spares a conversion of
 * the curve formats. Run `extract-sts1-compendium.py --only monsters` first; it
 * writes the art sources this script reads.
 *
 * Usage: node scripts/render-sts1-monsters.mjs [--jar path] [--only slug,slug]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/images/sts1/monsters");
const ART_SOURCES = path.join(ROOT, "data/sts1/monster-art.json");
const SPINE_BUNDLE = path.join(ROOT, "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.js");
const DEFAULT_JAR = path.join(
  homedir(),
  "Library/Application Support/Steam/steamapps/common/SlayTheSpire/SlayTheSpire.app/Contents/Resources/desktop-1.0.jar",
);
const MAX_SIDE = 640;
const PADDING = 12;
const WEBP_QUALITY = 0.85;

// HexaghostBody draws these around the core image `super(...)` takes.
const STILL_LAYERS = {
  "images/monsters/theBottom/boss/ghost/core.png": [
    "images/monsters/theBottom/boss/ghost/shadow.png",
    "images/monsters/theBottom/boss/ghost/plasma3.png",
    "images/monsters/theBottom/boss/ghost/plasma2.png",
    "images/monsters/theBottom/boss/ghost/plasma1.png",
    "images/monsters/theBottom/boss/ghost/core.png",
  ],
};

function parseArgs(argv) {
  const options = { jar: DEFAULT_JAR, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--jar") options.jar = argv[++index];
    if (argv[index] === "--only") options.only = new Set(argv[++index].split(","));
  }
  return options;
}

function readEntry(jar, entry) {
  return execFileSync("unzip", ["-p", jar, entry], { maxBuffer: 256 * 1024 * 1024 });
}

function pngDataUrl(jar, entry) {
  return `data:image/png;base64,${readEntry(jar, entry).toString("base64")}`;
}

function atStart(frames) {
  return (frames ?? []).filter((frame) => !frame.time);
}

function withoutCurve({ time, curve, ...frame }) {
  return frame;
}

function transformMode(bone) {
  const rotation = bone.inheritRotation !== false;
  const scale = bone.inheritScale !== false;
  if (rotation && scale) return "normal";
  if (!rotation && !scale) return "onlyTranslation";
  return rotation ? "noScale" : "noRotationOrReflection";
}

function convertBone({ inheritRotation, inheritScale, ...bone }) {
  return { ...bone, transform: transformMode({ inheritRotation, inheritScale }) };
}

function convertMixes({ rotateMix, translateMix, scaleMix, shearMix, ...rest }) {
  return {
    ...rest,
    ...(rotateMix === undefined ? {} : { mixRotate: rotateMix }),
    ...(translateMix === undefined ? {} : { mixX: translateMix, mixY: translateMix }),
    ...(scaleMix === undefined ? {} : { mixScaleX: scaleMix, mixScaleY: scaleMix }),
    ...(shearMix === undefined ? {} : { mixShearY: shearMix }),
  };
}

function convertBoneTimelines(bones = {}) {
  const converted = {};
  for (const [bone, timelines] of Object.entries(bones)) {
    const row = {};
    const rotate = atStart(timelines.rotate);
    if (rotate.length) row.rotate = rotate.map(({ angle }) => ({ value: angle ?? 0 }));
    for (const key of ["translate", "scale", "shear"]) {
      const frames = atStart(timelines[key]);
      if (frames.length) row[key] = frames.map(withoutCurve);
    }
    if (Object.keys(row).length) converted[bone] = row;
  }
  return converted;
}

function convertSlotTimelines(slots = {}) {
  const converted = {};
  for (const [slot, timelines] of Object.entries(slots)) {
    const row = {};
    const attachment = atStart(timelines.attachment);
    if (attachment.length) row.attachment = attachment.map(withoutCurve);
    const color = atStart(timelines.color);
    if (color.length) row.rgba = color.map(withoutCurve);
    if (Object.keys(row).length) converted[slot] = row;
  }
  return converted;
}

function convertConstraintTimelines(constraints = {}, convertFrame) {
  const converted = {};
  for (const [name, frames] of Object.entries(constraints)) {
    const kept = atStart(frames).map((frame) => convertFrame(withoutCurve(frame)));
    if (kept.length) converted[name] = kept;
  }
  return converted;
}

function convertPathTimelines(paths = {}) {
  const converted = {};
  for (const [name, timelines] of Object.entries(paths)) {
    const row = {};
    for (const key of ["position", "spacing"]) {
      const frames = atStart(timelines[key]);
      if (frames.length) row[key] = frames.map((frame) => ({ value: frame[key] ?? 0 }));
    }
    const mix = atStart(timelines.mix);
    if (mix.length) row.mix = mix.map((frame) => convertMixes(withoutCurve(frame)));
    if (Object.keys(row).length) converted[name] = row;
  }
  return converted;
}

function convertDeform(deform = {}) {
  const attachments = {};
  for (const [skin, slots] of Object.entries(deform)) {
    for (const [slot, meshes] of Object.entries(slots)) {
      for (const [mesh, frames] of Object.entries(meshes)) {
        const kept = atStart(frames).map(withoutCurve);
        if (!kept.length) continue;
        attachments[skin] ??= {};
        attachments[skin][slot] ??= {};
        attachments[skin][slot][mesh] = { deform: kept };
      }
    }
  }
  return attachments;
}

function convertAnimation(animation) {
  const drawOrder = atStart(animation.drawOrder ?? animation.draworder).map(withoutCurve);
  return {
    bones: convertBoneTimelines(animation.bones),
    slots: convertSlotTimelines(animation.slots),
    ik: convertConstraintTimelines(animation.ik, (frame) => frame),
    transform: convertConstraintTimelines(animation.transform, convertMixes),
    path: convertPathTimelines(animation.paths),
    attachments: convertDeform(animation.deform),
    ...(drawOrder.length ? { drawOrder } : {}),
  };
}

/** @param {any} skeleton @param {string} animationName */
export function convertSkeleton(skeleton, animationName) {
  const animation = skeleton.animations?.[animationName];
  if (!animation) throw new Error(`Skeleton has no animation ${JSON.stringify(animationName)}`);
  // 3.4 has no `order`; its runtime always solves IK, then paths, then
  // transforms, which is what lets a hand follow the end of a path-bent arm.
  const ik = skeleton.ik ?? [];
  const paths = skeleton.path ?? [];
  const transforms = skeleton.transform ?? [];
  return {
    skeleton: { ...skeleton.skeleton, spine: "4.2.0" },
    bones: skeleton.bones.map(convertBone),
    slots: skeleton.slots,
    ik: ik.map((constraint, index) => ({ ...constraint, order: index })),
    transform: transforms.map((constraint, index) => ({
      ...convertMixes(constraint),
      order: ik.length + paths.length + index,
    })),
    path: paths.map((constraint, index) => ({ ...convertMixes(constraint), order: ik.length + index })),
    skins: Object.entries(skeleton.skins ?? {}).map(([name, attachments]) => ({ name, attachments })),
    animations: { pose: convertAnimation(animation) },
  };
}

async function renderSkeleton(page, jar, art) {
  const atlasText = readEntry(jar, art.atlas).toString("utf8");
  const skeleton = convertSkeleton(JSON.parse(readEntry(jar, art.skeleton).toString("utf8")), art.animation);
  const directory = path.posix.dirname(art.atlas);
  const pages = Object.fromEntries(
    atlasText
      .split(/\r?\n/)
      .filter((line) => /\.png$/.test(line.trim()))
      .map((name) => [name.trim(), pngDataUrl(jar, `${directory}/${name.trim()}`)]),
  );
  return page.evaluate(async ({ atlasText, skeleton, pages, maxSide, padding, quality }) => {
    const { spine } = window;
    const images = Object.fromEntries(await Promise.all(Object.entries(pages).map(async ([name, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [name, image];
    })));

    const canvas = document.createElement("canvas");
    const context = new spine.ManagedWebGLRenderingContext(canvas, {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    const atlas = new spine.TextureAtlas(atlasText);
    for (const atlasPage of atlas.pages) {
      atlasPage.setTexture(new spine.GLTexture(context, images[atlasPage.name]));
    }
    const reader = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas));
    const data = reader.readSkeletonData(skeleton);
    const instance = new spine.Skeleton(data);
    instance.setToSetupPose();
    instance.updateWorldTransform(spine.Physics.update);
    data.findAnimation("pose").apply(instance, 0, 0, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
    instance.updateWorldTransform(spine.Physics.update);

    const offset = new spine.Vector2();
    const size = new spine.Vector2();
    instance.getBounds(offset, size, []);
    const scale = Math.min(1, maxSide / Math.max(size.x, size.y));
    canvas.width = Math.ceil(size.x * scale) + padding * 2;
    canvas.height = Math.ceil(size.y * scale) + padding * 2;

    const { gl } = context;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const renderer = new spine.SceneRenderer(canvas, context, true);
    renderer.camera.setViewport(canvas.width, canvas.height);
    renderer.camera.position.x = offset.x + size.x / 2;
    renderer.camera.position.y = offset.y + size.y / 2;
    renderer.camera.zoom = 1 / scale;
    renderer.begin();
    renderer.drawSkeleton(instance, true);
    renderer.end();

    // Skeleton bounds include slots the pose leaves transparent; trim to what shows.
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const flatContext = flat.getContext("2d", { willReadFrequently: true });
    flatContext.drawImage(canvas, 0, 0);
    const { data: pixels } = flatContext.getImageData(0, 0, flat.width, flat.height);
    let [left, top, right, bottom] = [flat.width, flat.height, -1, -1];
    for (let y = 0; y < flat.height; y += 1) {
      for (let x = 0; x < flat.width; x += 1) {
        if (pixels[(y * flat.width + x) * 4 + 3] < 8) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    const trimmed = document.createElement("canvas");
    trimmed.width = right - left + 1 + padding * 2;
    trimmed.height = bottom - top + 1 + padding * 2;
    trimmed.getContext("2d").drawImage(flat, padding - left, padding - top);
    return { dataUrl: trimmed.toDataURL("image/webp", quality), width: trimmed.width, height: trimmed.height };
  }, { atlasText, skeleton, pages, maxSide: MAX_SIDE, padding: PADDING, quality: WEBP_QUALITY });
}

async function renderStill(page, jar, art) {
  const layers = (STILL_LAYERS[art.image] ?? [art.image]).map((entry) => pngDataUrl(jar, entry));
  return page.evaluate(async ({ layers, quality }) => {
    const images = await Promise.all(layers.map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    }));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(...images.map((image) => image.width));
    canvas.height = Math.max(...images.map((image) => image.height));
    const context = canvas.getContext("2d");
    for (const image of images) {
      context.drawImage(image, (canvas.width - image.width) / 2, (canvas.height - image.height) / 2);
    }
    return { dataUrl: canvas.toDataURL("image/webp", quality), width: canvas.width, height: canvas.height };
  }, { layers, quality: WEBP_QUALITY });
}

async function main() {
  const { jar, only } = parseArgs(process.argv.slice(2));
  const sources = JSON.parse(readFileSync(ART_SOURCES, "utf8"));
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  await page.addScriptTag({ path: SPINE_BUNDLE });
  page.on("pageerror", (error) => console.error(error));

  const failed = [];
  for (const [slug, art] of Object.entries(sources)) {
    if (only && !only.has(slug)) continue;
    try {
      const result = art.image ? await renderStill(page, jar, art) : await renderSkeleton(page, jar, art);
      const base64 = result.dataUrl.split(",")[1];
      writeFileSync(path.join(OUT_DIR, `${slug}.webp`), Buffer.from(base64, "base64"));
      console.log(`${slug}: ${result.width}x${result.height}`);
    } catch (error) {
      failed.push(slug);
      console.error(`${slug}: ${error.message}`);
    }
  }
  await browser.close();
  if (failed.length) {
    throw new Error(`Failed to render ${failed.length} monster(s): ${failed.join(", ")}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
