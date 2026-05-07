#!/usr/bin/env node
/* Render a Spine actor into Codex custom pet spritesheet format.
 *
 * Run from a temp Node project that has:
 *   npm install @esotericsoftware/spine-canvas @napi-rs/canvas
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { spawnSync } = require("child_process");

const runtimeRequire = createRequire(path.join(process.cwd(), "package.json"));

let createCanvas;
let loadImage;
let spine;
try {
  ({ createCanvas, loadImage } = runtimeRequire("@napi-rs/canvas"));
  spine = runtimeRequire("@esotericsoftware/spine-canvas");
} catch (error) {
  console.error("Missing render dependencies. In a temp directory, run:");
  console.error("  npm init -y");
  console.error("  npm install @esotericsoftware/spine-canvas @napi-rs/canvas");
  console.error("Then rerun this script from that directory.");
  console.error(error.message);
  process.exit(1);
}

const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const ROWS = 9;
const SHEET_W = CELL_W * COLS;
const SHEET_H = CELL_H * ROWS;

const STATE_FRAMES = {
  idle: 6,
  "running-right": 8,
  "running-left": 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
};

const STATE_ROWS = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
];

const DEFAULT_HIDE_SLOT_PATTERNS = [
  "^binder_",
  "^blender-",
  "^deathspark-",
  "^roundspark",
];

const DEFAULT_AUX_LOOPS = ["_ignore/cloth_loop", "_ignore/glow_loop"];

function usage() {
  console.log(`Usage:
  render-codex-pet.js --input DIR --pet-id ID --display-name NAME [options]

Options:
  --input DIR                  Directory containing one .atlas, .skel, and .png
  --pet-id ID                  Codex pet id / output folder name
  --display-name NAME          Display name in pet.json
  --description TEXT           Description in pet.json
  --build-root DIR             Default: ~/.codex/pet-builds
  --pets-root DIR              Default: ~/.codex/pets
  --profile FILE               JSON profile overriding row mapping and slot hiding
  --hide-slot-regex REGEX      Extra slot regex to hide. Repeatable
  --no-default-hide            Do not hide the built-in known effect slot regexes
  --aux-loop NAME              Extra auxiliary loop animation. Repeatable
  --no-default-aux             Do not apply default _ignore cloth/glow auxiliary loops
  --fit-mode MODE              strict or height. Default: strict
  --scale-multiplier NUMBER    Multiply final render scale. Default: 1
`);
}

function parseArgs(argv) {
  const args = {};
  const listKeys = new Set(["hide-slot-regex", "aux-loop"]);
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    if (key === "no-default-hide" || key === "no-default-aux") {
      args[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value == null) throw new Error(`missing value for ${token}`);
    if (listKeys.has(key)) {
      if (!args[key]) args[key] = [];
      args[key].push(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return process.env.HOME;
  if (value.startsWith("~/")) return path.join(process.env.HOME, value.slice(2));
  return value;
}

function requireArg(args, key) {
  if (!args[key]) throw new Error(`--${key} is required`);
  return args[key];
}

function findOne(inputDir, ext) {
  const files = fs.readdirSync(inputDir).filter((file) => file.endsWith(ext));
  if (files.length !== 1) {
    throw new Error(`expected exactly one ${ext} in ${inputDir}, found ${files.length}`);
  }
  return path.join(inputDir, files[0]);
}

async function loadSkeletonData(inputDir) {
  const atlasPath = findOne(inputDir, ".atlas");
  const skelPath = findOne(inputDir, ".skel");
  const atlas = new spine.TextureAtlas(fs.readFileSync(atlasPath, "utf8"));

  for (const page of atlas.pages) {
    const pagePath = path.join(inputDir, page.name);
    if (!fs.existsSync(pagePath)) {
      throw new Error(`atlas page image not found: ${pagePath}`);
    }
    const image = await loadImage(pagePath);
    page.setTexture(new spine.CanvasTexture(image));
  }

  const loader = new spine.AtlasAttachmentLoader(atlas);
  const binary = new spine.SkeletonBinary(loader);
  return binary.readSkeletonData(fs.readFileSync(skelPath));
}

function findAnimation(skeletonData, patterns) {
  const animations = skeletonData.animations;
  for (const pattern of patterns) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
    const hit = animations.find((animation) => re.test(animation.name));
    if (hit) return hit.name;
  }
  return animations[0]?.name ?? null;
}

function timesFor(animation, frames, loop, state) {
  const duration = Math.max(animation?.duration ?? 0, 0);
  if (duration <= 0) return Array(frames).fill(0);

  if (!loop) {
    const start = Math.min(0.05, duration * 0.1);
    const end = Math.max(start, duration * 0.92);
    return Array.from({ length: frames }, (_, i) => start + ((end - start) * i) / Math.max(frames - 1, 1));
  }

  let start = 0;
  let span = Math.min(duration, 2);
  if (state === "idle" && duration > 2) {
    start = Math.min(1, Math.max(0, duration - 0.5));
    span = Math.min(0.5, Math.max(0.1, duration - start));
  }
  return Array.from({ length: frames }, (_, i) => start + (span * i) / Math.max(frames - 1, 1));
}

function buildDefaultRows(skeletonData) {
  const pick = (patterns) => findAnimation(skeletonData, patterns);
  const idle = pick(["^idle_loop$", "^idle$", "idle", "^relaxed_loop$", "loop"]);
  const relaxed = pick(["^relaxed_loop$", "relaxed", "idle", "loop"]) || idle;
  const cast = pick(["^cast$", "cast", "skill", "power", "spell"]) || idle;
  const attack = pick(["^attack$", "attack", "strike", "hit"]) || cast || idle;
  const hurt = pick(["^hurt$", "hurt", "hit", "damage", "^die$"]) || idle;

  const specs = [
    { state: "idle", animation: idle, loop: true },
    { state: "running-right", animation: relaxed, loop: true },
    { state: "running-left", animation: relaxed, loop: true, mirror: true },
    { state: "waving", animation: cast, loop: false },
    { state: "jumping", animation: attack, loop: false },
    { state: "failed", animation: hurt, loop: false },
    { state: "waiting", animation: relaxed, loop: true },
    { state: "running", animation: cast || relaxed, loop: false },
    { state: "review", animation: idle, loop: true },
  ];

  return specs.map((spec, row) => {
    const frames = STATE_FRAMES[spec.state];
    const animation = skeletonData.findAnimation(spec.animation);
    return {
      row,
      frames,
      times: timesFor(animation, frames, spec.loop, spec.state),
      ...spec,
    };
  });
}

function applyProfile(baseRows, skeletonData, profilePath) {
  if (!profilePath) return baseRows;
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  if (!profile.rows) return baseRows;
  const byState = new Map(baseRows.map((row) => [row.state, row]));
  for (const override of profile.rows) {
    const base = byState.get(override.state);
    if (!base) throw new Error(`profile row has unknown state: ${override.state}`);
    const next = { ...base, ...override };
    next.frames = STATE_FRAMES[next.state];
    if (!next.times) {
      const animation = skeletonData.findAnimation(next.animation);
      next.times = timesFor(animation, next.frames, next.loop, next.state);
    }
    byState.set(next.state, next);
  }
  return STATE_ROWS.map((state, row) => ({ ...byState.get(state), row }));
}

function makePose(skeletonData, spec, time, auxLoops, hideSlotPatterns) {
  const skeleton = new spine.Skeleton(skeletonData);
  skeleton.setToSetupPose();

  const stateData = new spine.AnimationStateData(skeletonData);
  const state = new spine.AnimationState(stateData);
  const entry = state.setAnimation(0, spec.animation, spec.loop);
  entry.trackTime = time;

  auxLoops.forEach((name, index) => {
    if (!skeletonData.findAnimation(name)) return;
    const aux = state.setAnimation(index + 1, name, true);
    aux.trackTime = time;
  });

  state.apply(skeleton);
  for (const slot of skeleton.slots) {
    if (hideSlotPatterns.some((pattern) => pattern.test(slot.data.name))) {
      slot.setAttachment(null);
    }
  }
  skeleton.updateWorldTransform(spine.Physics.pose);
  return skeleton;
}

function boundsFor(skeletonData, specs, auxLoops, hideSlotPatterns) {
  const offset = new spine.Vector2();
  const size = new spine.Vector2();
  const byRow = new Map();
  const global = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  for (const spec of specs) {
    const rowBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const time of spec.times) {
      const skeleton = makePose(skeletonData, spec, time, auxLoops, hideSlotPatterns);
      skeleton.getBounds(offset, size);
      const maxX = offset.x + size.x;
      const maxY = offset.y + size.y;
      rowBounds.minX = Math.min(rowBounds.minX, offset.x);
      rowBounds.minY = Math.min(rowBounds.minY, offset.y);
      rowBounds.maxX = Math.max(rowBounds.maxX, maxX);
      rowBounds.maxY = Math.max(rowBounds.maxY, maxY);
      global.minX = Math.min(global.minX, offset.x);
      global.minY = Math.min(global.minY, offset.y);
      global.maxX = Math.max(global.maxX, maxX);
      global.maxY = Math.max(global.maxY, maxY);
    }
    byRow.set(spec.row, rowBounds);
  }
  return { global, byRow };
}

function drawPose(ctx, renderer, skeletonData, spec, time, scale, rowBounds, auxLoops, hideSlotPatterns, col, row) {
  const skeleton = makePose(skeletonData, spec, time, auxLoops, hideSlotPatterns);
  const width = rowBounds.maxX - rowBounds.minX;
  const height = rowBounds.maxY - rowBounds.minY;
  const centerX = (rowBounds.minX + rowBounds.maxX) / 2;
  const top = (CELL_H - height * scale) / 2;
  const tx = col * CELL_W + CELL_W / 2;
  const ty = row * CELL_H + top + rowBounds.maxY * scale;

  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(spec.mirror ? -scale : scale, -scale);
  ctx.translate(-centerX, 0);
  renderer.draw(skeleton);
  ctx.restore();
}

function diffMetric(aImage, bImage) {
  const a = aImage.data;
  const b = bImage.data;
  let sum = 0;
  for (let i = 3; i < a.length; i += 16) sum += Math.abs(a[i] - b[i]);
  return Number((sum / (a.length / 16)).toFixed(3));
}

function cropPreview(sheet, outPath, sx, sy, sw, sh) {
  const c = createCanvas(sw, sh);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, sw, sh);
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
  fs.writeFileSync(outPath, c.toBuffer("image/png"));
}

function runMagick(args) {
  const result = spawnSync("magick", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`magick ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const inputDir = path.resolve(expandHome(requireArg(args, "input")));
  const petId = requireArg(args, "pet-id");
  const displayName = requireArg(args, "display-name");
  const description = args.description || "STS2 Spine animation frames rendered as a Codex custom pet.";
  const buildRoot = path.resolve(expandHome(args["build-root"] || "~/.codex/pet-builds"));
  const petsRoot = path.resolve(expandHome(args["pets-root"] || "~/.codex/pets"));
  const profilePath = args.profile ? path.resolve(expandHome(args.profile)) : null;
  let profile = {};
  if (profilePath) profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

  const fitMode = args["fit-mode"] || profile.fitMode || "strict";
  if (!["strict", "height"].includes(fitMode)) {
    throw new Error("--fit-mode must be strict or height");
  }
  const scaleMultiplier = Number(args["scale-multiplier"] || profile.scaleMultiplier || 1);
  if (!Number.isFinite(scaleMultiplier) || scaleMultiplier <= 0) {
    throw new Error("--scale-multiplier must be a positive number");
  }
  const buildDir = path.join(buildRoot, petId);
  const petDir = path.join(petsRoot, petId);

  const hidePatterns = [
    ...(args["no-default-hide"] ? [] : DEFAULT_HIDE_SLOT_PATTERNS),
    ...(profile.hiddenSlotPatterns || []),
    ...(args["hide-slot-regex"] || []),
  ].map((pattern) => new RegExp(pattern));
  const auxLoops = [
    ...(args["no-default-aux"] ? [] : DEFAULT_AUX_LOOPS),
    ...(profile.auxLoops || []),
    ...(args["aux-loop"] || []),
  ];

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(petDir, { recursive: true });

  const skeletonData = await loadSkeletonData(inputDir);
  const rows = applyProfile(buildDefaultRows(skeletonData), skeletonData, profilePath);
  for (const row of rows) {
    if (!row.animation || !skeletonData.findAnimation(row.animation)) {
      throw new Error(`row ${row.state} maps to missing animation: ${row.animation}`);
    }
  }

  const { global, byRow } = boundsFor(skeletonData, rows, auxLoops, hidePatterns);
  const maxWidth = global.maxX - global.minX;
  const maxHeight = global.maxY - global.minY;
  const baseScale = fitMode === "height"
    ? (CELL_H - 14) / maxHeight
    : Math.min((CELL_W - 14) / maxWidth, (CELL_H - 14) / maxHeight);
  const scale = baseScale * scaleMultiplier;

  const sheet = createCanvas(SHEET_W, SHEET_H);
  const ctx = sheet.getContext("2d");
  ctx.clearRect(0, 0, SHEET_W, SHEET_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const renderer = new spine.SkeletonRenderer(ctx);
  renderer.triangleRendering = true;

  for (const spec of rows) {
    const rowBounds = byRow.get(spec.row);
    for (let col = 0; col < spec.frames; col += 1) {
      drawPose(ctx, renderer, skeletonData, spec, spec.times[col], scale, rowBounds, auxLoops, hidePatterns, col, spec.row);
    }
  }

  const sheetPng = path.join(buildDir, "spritesheet.png");
  const sheetWebp = path.join(buildDir, "spritesheet.webp");
  fs.writeFileSync(sheetPng, sheet.toBuffer("image/png"));
  runMagick([sheetPng, "-define", "webp:lossless=true", sheetWebp]);
  fs.copyFileSync(sheetWebp, path.join(petDir, "spritesheet.webp"));
  fs.writeFileSync(path.join(petDir, "pet.json"), `${JSON.stringify({
    id: petId,
    displayName,
    description,
    spritesheetPath: "spritesheet.webp",
  }, null, 2)}\n`);

  cropPreview(sheet, path.join(buildDir, "state-rows-preview.png"), 0, 0, SHEET_W, SHEET_H);
  cropPreview(sheet, path.join(buildDir, "idle-row-preview.png"), 0, 0, CELL_W * STATE_FRAMES.idle, CELL_H);
  cropPreview(sheet, path.join(buildDir, "action-rows-preview.png"), 0, CELL_H * 3, SHEET_W, CELL_H * 3);

  const idleFrames = [];
  const idleDiffs = [];
  for (let i = 0; i < STATE_FRAMES.idle; i += 1) {
    idleFrames.push(ctx.getImageData(i * CELL_W, 0, CELL_W, CELL_H));
  }
  for (let i = 1; i < idleFrames.length; i += 1) {
    idleDiffs.push(diffMetric(idleFrames[i - 1], idleFrames[i]));
  }

  const buildInfo = {
    sourceDir: inputDir,
    renderer: "@esotericsoftware/spine-canvas + @napi-rs/canvas",
    skeletonVersion: skeletonData.version,
    skeletonAnimations: skeletonData.animations.map((animation) => ({ name: animation.name, duration: animation.duration })),
    baseScale,
    scale,
    scaleMultiplier,
    fitMode,
    globalBounds: global,
    hiddenSlotPatterns: hidePatterns.map((pattern) => pattern.source),
    auxLoops,
    idleDiffs,
    rowMapping: rows.map((row) => ({
      row: row.row,
      state: row.state,
      animation: row.animation,
      mirror: Boolean(row.mirror),
      loop: Boolean(row.loop),
      frames: row.frames,
      times: row.times,
    })),
  };
  fs.writeFileSync(path.join(buildDir, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);

  console.log(JSON.stringify({
    petId,
    installedPetDir: petDir,
    spritesheet: path.join(petDir, "spritesheet.webp"),
    preview: path.join(buildDir, "state-rows-preview.png"),
    buildInfo: path.join(buildDir, "build-info.json"),
    idleDiffs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
