#!/usr/bin/env node
/**
 * Exports STS1 monster skeletons for the site's Spine player and renders the
 * still each one shows before the player loads.
 *
 * STS1 ships Spine 3.4 skeletons and the site's runtime reads 4.2, so every
 * skeleton is converted, animations included: 3.4 bezier curves are
 * normalized while 4.2 stores absolute ones, 3.4 rotations take the shortest
 * way between keys, and several timelines were renamed. Run
 * `extract-sts1-compendium.py --only monsters` first; it writes the art
 * sources this script reads.
 *
 * Outputs:
 * - public/images/sts1/monsters/<slug>.webp: the still (first idle frame, trimmed)
 * - public/spine/sts1/monsters/<slug>/: skeleton.json (4.2), skeleton.atlas, pages
 * - data/sts1/monster-spine.json: idle clip, clips, the viewport every clip fits
 *   in, and where the still sits inside it
 *
 * Usage: node scripts/render-sts1-monsters.mjs [--jar path] [--only slug,slug]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/images/sts1/monsters");
const SPINE_DIR = path.join(ROOT, "public/spine/sts1/monsters");
const ART_SOURCES = path.join(ROOT, "data/sts1/monster-art.json");
const MONSTERS = path.join(ROOT, "data/sts1/monsters.json");
const SPINE_META = path.join(ROOT, "data/sts1/monster-spine.json");
const SPINE_BUNDLE = path.join(ROOT, "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.js");
const DEFAULT_JAR = path.join(
  homedir(),
  "Library/Application Support/Steam/steamapps/common/SlayTheSpire/SlayTheSpire.app/Contents/Resources/desktop-1.0.jar",
);
const MAX_SIDE = 640;
const PADDING = 12;
const WEBP_QUALITY = 0.85;
/** Samples per second when measuring how far each clip reaches. */
const BOUNDS_FPS = 15;
const BOUNDS_MAX_SIDE = 768;

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

function atlasPages(atlasText) {
  return atlasText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\.png$/.test(line));
}

// -- 3.4 -> 4.2 ----------------------------------------------------------------

function capitalize(value) {
  return typeof value === "string" && value ? value[0].toUpperCase() + value.slice(1) : value;
}

function inheritMode(bone) {
  const rotation = bone.inheritRotation !== false;
  const scale = bone.inheritScale !== false;
  if (rotation && scale) return "Normal";
  if (!rotation && !scale) return "OnlyTranslation";
  return rotation ? "NoScale" : "NoRotationOrReflection";
}

function convertBone({ inheritRotation, inheritScale, ...bone }) {
  return { ...bone, inherit: inheritMode({ inheritRotation, inheritScale }) };
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

function convertPathConstraint(constraint) {
  const converted = convertMixes(constraint);
  for (const key of ["positionMode", "spacingMode", "rotateMode"]) {
    if (converted[key]) converted[key] = capitalize(converted[key]);
  }
  return converted;
}

/**
 * Rebuilds a timeline's frames: `values` reads each frame's channels, `write`
 * builds the 4.2 frame. A 3.4 curve [cx1, cy1, cx2, cy2] is in 0..1 of the
 * segment; 4.2 wants absolute time and value per channel.
 */
function convertFrames(frames, values, write) {
  const channels = frames.map(values);
  return frames.map((frame, index) => {
    const out = write(frame, channels[index]);
    out.time = frame.time ?? 0;
    const next = frames[index + 1];
    if (!next || frame.curve === undefined) return out;
    if (frame.curve === "stepped") {
      out.curve = "stepped";
      return out;
    }
    const [cx1, cy1, cx2, cy2] = frame.curve;
    const t1 = frame.time ?? 0;
    const t2 = next.time ?? 0;
    out.curve = channels[index].flatMap((v1, channel) => {
      const v2 = channels[index + 1][channel];
      return [t1 + cx1 * (t2 - t1), v1 + cy1 * (v2 - v1), t1 + cx2 * (t2 - t1), v1 + cy2 * (v2 - v1)];
    });
    return out;
  });
}

/** 3.4 turns the short way between keys; 4.2 interpolates the raw values. */
function unwrapRotations(frames) {
  let previous = null;
  return frames.map((frame) => {
    let angle = frame.angle ?? 0;
    if (previous !== null) {
      let delta = angle - previous.raw;
      delta -= (16384 - Math.trunc(16384.499999999996 - delta / 360)) * 360;
      angle = previous.unwrapped + delta;
    }
    previous = { raw: frame.angle ?? 0, unwrapped: angle };
    return { ...frame, angle };
  });
}

function colorChannels(hex) {
  const value = (hex ?? "ffffffff").padEnd(8, "f");
  return [0, 2, 4, 6].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function convertBoneTimelines(bones = {}) {
  const converted = {};
  for (const [bone, timelines] of Object.entries(bones)) {
    const row = {};
    if (timelines.rotate) {
      row.rotate = convertFrames(unwrapRotations(timelines.rotate), (frame) => [frame.angle], (_frame, [value]) => ({ value }));
    }
    for (const key of ["translate", "scale", "shear"]) {
      if (!timelines[key]) continue;
      row[key] = convertFrames(timelines[key], (frame) => [frame.x ?? 0, frame.y ?? 0], (_frame, [x, y]) => ({ x, y }));
    }
    converted[bone] = row;
  }
  return converted;
}

function convertSlotTimelines(slots = {}) {
  const converted = {};
  for (const [slot, timelines] of Object.entries(slots)) {
    const row = {};
    if (timelines.attachment) {
      row.attachment = timelines.attachment.map(({ time, name }) => ({ time: time ?? 0, name }));
    }
    if (timelines.color) {
      row.rgba = convertFrames(timelines.color, (frame) => colorChannels(frame.color), (frame) => ({ color: frame.color ?? "ffffffff" }));
    }
    converted[slot] = row;
  }
  return converted;
}

function convertIkTimelines(ik = {}) {
  const converted = {};
  for (const [name, frames] of Object.entries(ik)) {
    converted[name] = convertFrames(
      frames,
      (frame) => [frame.mix ?? 1, 0],
      (frame, [mix]) => ({ mix, softness: 0, bendPositive: frame.bendPositive ?? true }),
    );
  }
  return converted;
}

function convertTransformTimelines(transforms = {}) {
  const converted = {};
  for (const [name, frames] of Object.entries(transforms)) {
    converted[name] = convertFrames(
      frames,
      (frame) => {
        const rotate = frame.rotateMix ?? 1;
        const translate = frame.translateMix ?? 1;
        const scale = frame.scaleMix ?? 1;
        return [rotate, translate, translate, scale, scale, frame.shearMix ?? 1];
      },
      (_frame, [mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY]) => ({ mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY }),
    );
  }
  return converted;
}

function convertPathTimelines(paths = {}) {
  const converted = {};
  for (const [name, timelines] of Object.entries(paths)) {
    const row = {};
    for (const key of ["position", "spacing"]) {
      if (!timelines[key]) continue;
      row[key] = convertFrames(timelines[key], (frame) => [frame[key] ?? 0], (_frame, [value]) => ({ value }));
    }
    if (timelines.mix) {
      row.mix = convertFrames(
        timelines.mix,
        (frame) => [frame.rotateMix ?? 1, frame.translateMix ?? 1, frame.translateMix ?? 1],
        (_frame, [mixRotate, mixX, mixY]) => ({ mixRotate, mixX, mixY }),
      );
    }
    converted[name] = row;
  }
  return converted;
}

/** 3.4 `deform[skin][slot][attachment]` becomes 4.2 `attachments[...].deform`, a 0..1 curve. */
function convertDeform(deform = {}) {
  const converted = {};
  for (const [skin, slots] of Object.entries(deform)) {
    converted[skin] = {};
    for (const [slot, meshes] of Object.entries(slots)) {
      converted[skin][slot] = {};
      for (const [mesh, frames] of Object.entries(meshes)) {
        converted[skin][slot][mesh] = {
          deform: convertFrames(
            frames,
            () => [0],
            ({ offset, vertices }) => ({ ...(offset === undefined ? {} : { offset }), ...(vertices ? { vertices } : {}) }),
          ).map((frame, index, all) => {
            // Deform weights run 0 -> 1 within each segment.
            if (Array.isArray(frame.curve)) {
              const source = frames[index].curve;
              const next = all[index + 1];
              const t1 = frame.time;
              const t2 = next ? next.time : t1;
              frame.curve = [t1 + source[0] * (t2 - t1), source[1], t1 + source[2] * (t2 - t1), source[3]];
            }
            return frame;
          }),
        };
      }
    }
  }
  return converted;
}

function convertAnimation(animation) {
  const drawOrder = animation.drawOrder ?? animation.draworder;
  return {
    bones: convertBoneTimelines(animation.bones),
    slots: convertSlotTimelines(animation.slots),
    ik: convertIkTimelines(animation.ik),
    transform: convertTransformTimelines(animation.transform),
    path: convertPathTimelines(animation.paths),
    attachments: convertDeform(animation.deform ?? animation.ffd),
    ...(drawOrder ? { drawOrder: drawOrder.map(({ time, offsets }) => ({ time: time ?? 0, ...(offsets ? { offsets } : {}) })) } : {}),
  };
}

/** @param {any} skeleton A Spine 3.4 skeleton JSON object. */
export function convertSkeleton(skeleton) {
  // 3.4 has no `order`; its runtime always solves IK, then paths, then
  // transforms, which is what lets a hand follow the end of a path-bent arm.
  const ik = skeleton.ik ?? [];
  const paths = skeleton.path ?? [];
  const transforms = skeleton.transform ?? [];
  return {
    skeleton: { ...skeleton.skeleton, spine: "4.2.0" },
    bones: skeleton.bones.map(convertBone),
    slots: (skeleton.slots ?? []).map((slot) => (slot.blend ? { ...slot, blend: capitalize(slot.blend) } : slot)),
    ik: ik.map((constraint, index) => ({ ...constraint, order: index })),
    transform: transforms.map((constraint, index) => ({
      ...convertMixes(constraint),
      order: ik.length + paths.length + index,
    })),
    path: paths.map((constraint, index) => ({ ...convertPathConstraint(constraint), order: ik.length + index })),
    skins: Object.entries(skeleton.skins ?? {}).map(([name, attachments]) => ({ name, attachments })),
    animations: Object.fromEntries(
      Object.entries(skeleton.animations ?? {}).map(([name, animation]) => [name, convertAnimation(animation)]),
    ),
  };
}

// -- rendering -------------------------------------------------------------------

/** The idle clip and every clip a move plays: what the stage must fit. */
function stagedAnimations(monster, idle) {
  const names = new Set([idle]);
  for (const move of monster?.moves ?? []) {
    for (const trigger of move.triggers) if (trigger.type === "spine") names.add(trigger.name);
  }
  return [...names];
}

async function renderSkeleton(page, art, skeleton, atlasText, pages, staged) {
  return page.evaluate(async ({ atlasText, skeleton, pages, idle, staged, maxSide, boundsMaxSide, padding, quality, fps }) => {
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
    const renderer = new spine.SceneRenderer(canvas, context, true);
    const { gl } = context;

    function pose(animation, time) {
      instance.setToSetupPose();
      instance.updateWorldTransform(spine.Physics.update);
      animation?.apply(instance, time, time, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
      instance.updateWorldTransform(spine.Physics.update);
    }

    function attachmentBounds() {
      const offset = new spine.Vector2();
      const size = new spine.Vector2();
      instance.getBounds(offset, size, []);
      return { x: offset.x, y: offset.y, width: size.x, height: size.y };
    }

    /** Draws the current pose centered on `rect` at `scale`; returns the visible pixels' world rect. */
    function draw(rect, scale) {
      canvas.width = Math.ceil(rect.width * scale) + padding * 2;
      canvas.height = Math.ceil(rect.height * scale) + padding * 2;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.camera.setViewport(canvas.width, canvas.height);
      renderer.camera.position.x = rect.x + rect.width / 2;
      renderer.camera.position.y = rect.y + rect.height / 2;
      renderer.camera.zoom = 1 / scale;
      renderer.begin();
      renderer.drawSkeleton(instance, true);
      renderer.end();
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let [left, bottom, right, top] = [canvas.width, canvas.height, -1, -1];
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] < 8) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          bottom = Math.min(bottom, y);
          top = Math.max(top, y);
        }
      }
      if (right < 0) return null;
      // readPixels rows run bottom-up, like world y.
      const toWorldX = (px) => renderer.camera.position.x + (px - canvas.width / 2) / scale;
      const toWorldY = (py) => renderer.camera.position.y + (py - canvas.height / 2) / scale;
      return {
        world: { x: toWorldX(left), y: toWorldY(bottom), width: (right + 1 - left) / scale, height: (top + 1 - bottom) / scale },
        pixels: { left, right, top: canvas.height - 1 - top, bottom: canvas.height - 1 - bottom },
      };
    }

    function union(a, b) {
      if (!a) return b;
      if (!b) return a;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      return {
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y,
      };
    }

    const samples = [];
    for (const animation of data.animations.filter((row) => staged.includes(row.name))) {
      const steps = Math.max(1, Math.ceil(animation.duration * fps));
      for (let step = 0; step <= steps; step += 1) samples.push([animation, (animation.duration * step) / steps]);
    }
    let reach = null;
    for (const [animation, time] of samples) {
      pose(animation, time);
      reach = union(reach, attachmentBounds());
    }

    // Measure what actually shows in every sampled frame.
    const boundsScale = Math.min(1, boundsMaxSide / Math.max(reach.width, reach.height));
    let viewport = null;
    for (const [animation, time] of samples) {
      pose(animation, time);
      viewport = union(viewport, draw(reach, boundsScale)?.world ?? null);
    }

    // The still: the idle clip's first frame, trimmed to what shows.
    const idleAnimation = data.findAnimation(idle);
    pose(idleAnimation, 0);
    const frame = attachmentBounds();
    const scale = Math.min(1, maxSide / Math.max(frame.width, frame.height));
    const shown = draw(frame, scale);
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    flat.getContext("2d").drawImage(canvas, 0, 0);
    const { left, right, top, bottom } = shown.pixels;
    const trimmed = document.createElement("canvas");
    trimmed.width = right - left + 1 + padding * 2;
    trimmed.height = bottom - top + 1 + padding * 2;
    trimmed.getContext("2d").drawImage(flat, padding - left, padding - top);
    const margin = padding / scale;
    const still = {
      x: shown.world.x - margin,
      y: shown.world.y - margin,
      width: shown.world.width + margin * 2,
      height: shown.world.height + margin * 2,
    };
    return {
      dataUrl: trimmed.toDataURL("image/webp", quality),
      width: trimmed.width,
      height: trimmed.height,
      viewport: union(viewport, still),
      still,
      animations: data.animations.map((animation) => animation.name),
    };
  }, {
    atlasText,
    skeleton,
    pages,
    idle: art.animation,
    staged,
    maxSide: MAX_SIDE,
    boundsMaxSide: BOUNDS_MAX_SIDE,
    padding: PADDING,
    quality: WEBP_QUALITY,
    fps: BOUNDS_FPS,
  });
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

function round(rect) {
  return Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}

function exportSkeleton(jar, slug, art, skeleton, atlasText) {
  const dir = path.join(SPINE_DIR, slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "skeleton.json"), JSON.stringify(skeleton));
  writeFileSync(path.join(dir, "skeleton.atlas"), atlasText);
  const source = path.posix.dirname(art.atlas);
  for (const name of atlasPages(atlasText)) {
    writeFileSync(path.join(dir, name), readEntry(jar, `${source}/${name}`));
  }
}

async function main() {
  const { jar, only } = parseArgs(process.argv.slice(2));
  const sources = JSON.parse(readFileSync(ART_SOURCES, "utf8"));
  const monsters = new Map(JSON.parse(readFileSync(MONSTERS, "utf8")).map((row) => [row.slug, row]));
  let meta = {};
  try {
    meta = JSON.parse(readFileSync(SPINE_META, "utf8"));
  } catch {
    meta = {};
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  await page.addScriptTag({ path: SPINE_BUNDLE });
  page.on("pageerror", (error) => console.error(error));

  const failed = [];
  for (const [slug, art] of Object.entries(sources)) {
    if (only && !only.has(slug)) continue;
    try {
      let result;
      if (art.image) {
        result = await renderStill(page, jar, art);
        delete meta[slug];
      } else {
        const atlasText = readEntry(jar, art.atlas).toString("utf8");
        const skeleton = convertSkeleton(JSON.parse(readEntry(jar, art.skeleton).toString("utf8")));
        const directory = path.posix.dirname(art.atlas);
        const pages = Object.fromEntries(atlasPages(atlasText).map((name) => [name, pngDataUrl(jar, `${directory}/${name}`)]));
        result = await renderSkeleton(page, art, skeleton, atlasText, pages, stagedAnimations(monsters.get(slug), art.animation));
        exportSkeleton(jar, slug, art, skeleton, atlasText);
        meta[slug] = {
          idle: art.animation,
          animations: result.animations,
          viewport: round(result.viewport),
          still: round(result.still),
        };
      }
      const base64 = result.dataUrl.split(",")[1];
      writeFileSync(path.join(OUT_DIR, `${slug}.webp`), Buffer.from(base64, "base64"));
      console.log(`${slug}: ${result.width}x${result.height}`);
    } catch (error) {
      failed.push(slug);
      console.error(`${slug}: ${error.stack ?? error.message}`);
    }
  }
  await browser.close();
  const sorted = Object.fromEntries(Object.keys(sources).filter((slug) => meta[slug]).map((slug) => [slug, meta[slug]]));
  writeFileSync(SPINE_META, `${JSON.stringify(sorted, null, 2)}\n`);
  if (failed.length) {
    throw new Error(`Failed to render ${failed.length} monster(s): ${failed.join(", ")}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
