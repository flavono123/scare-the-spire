#!/usr/bin/env node
import { TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } from "@esotericsoftware/spine-player";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const characterRoot = path.join(repoRoot, "public/spine/sts2/characters");
const monsterRoot = path.join(repoRoot, "public/spine/sts2/monsters");
const vfxRoot = path.join(repoRoot, "public/spine/sts2/vfx");
const charactersPath = path.join(repoRoot, "data/sts2/eng/characters.json");
const monstersPath = path.join(repoRoot, "data/sts2/eng/monsters.json");
const outCharacterPath = path.join(repoRoot, "data/sts2/character-spine-assets.json");
const outMonsterPath = path.join(repoRoot, "data/sts2/monster-spine-assets.json");
const outMonsterFallbackPath = path.join(repoRoot, "data/sts2/monster-spine-fallbacks.json");
const outVfxPath = path.join(repoRoot, "data/sts2/spine-vfx-assets.json");

const MONSTER_ALIASES = {
  BOWLBUG_EGG: { folder: "bowlbug", skin: "cocoon", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_NECTAR: { folder: "bowlbug", skin: "goop", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_ROCK: { folder: "bowlbug", skin: "rock", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_SILK: { folder: "bowlbug", skin: "web", tags: ["shared-actor", "variant-skin"] },
  CALCIFIED_CULTIST: { folder: "cultists", skin: "coral", tags: ["shared-actor", "variant-skin"] },
  CUBEX_CONSTRUCT: { folder: "cubex_construct", skin: "moss1", tags: ["variant-skin"] },
  DAMP_CULTIST: { folder: "cultists", skin: "slug", tags: ["shared-actor", "variant-skin"] },
  FLYCONID: { folder: "flying_mushrooms", tags: ["image-slug-alias"] },
  GLOBE_HEAD: { folder: "globe_head", tags: ["image-slug-alias"] },
  SCROLL_OF_BITING: { folder: "scroll_of_biting", skin: "skin1", tags: ["variant-skin"] },
  SKULKING_COLONY: { folder: "skulking_colony", tags: ["image-slug-alias"] },
  TORCH_HEAD_AMALGAM: { folder: "torch_head_amalgam", tags: ["image-slug-alias"] },
};

const VFX_ALIASES = {
  VFX_CHAIN: "vfx_chain",
  VFX_FLYING_SLASH: "vfx_flying_slash",
  VFX_GAZE: "vfx_gaze",
  VFX_KAISER_CRAB_BOSS_EXPLOSION: "vfx_kaiser_crab_boss_explosion",
  VFX_LASER: "vfx_laser",
  VFX_MECHA_KNIGHT_SHIELD: "vfx_mecha_knight_shield",
  VFX_SCRATCH: "vfx_scratch",
};

const CHARACTER_ALIASES = {
  DEFECT: { folder: "defect", attackVfx: "VFX_LASER" },
  IRONCLAD: { folder: "ironclad", attackVfx: "VFX_FLYING_SLASH" },
  NECROBINDER: { folder: "necrobinder", attackVfx: "VFX_SCRATCH" },
  REGENT: { folder: "regent", attackVfx: "VFX_SOVEREIGN_BLADE" },
  SILENT: { folder: "silent", attackVfx: "VFX_SCRATCH" },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function walkActorFolders(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function parseSkeleton({ folder, root, sharedAtlasFile = null }) {
  const dir = path.join(root, folder);
  const files = fs.readdirSync(dir);
  const atlasFile = files.find((file) => file.endsWith(".atlas"));
  const skelFile = files.find((file) => file.endsWith(".skel"));
  const pngFiles = files.filter((file) => file.endsWith(".png")).sort();
  if (!atlasFile || !skelFile) return null;

  const atlasPath = sharedAtlasFile ?? path.join(dir, atlasFile);
  const atlas = new TextureAtlas(fs.readFileSync(atlasPath, "utf8"));
  const loader = new AtlasAttachmentLoader(atlas);
  const binary = new SkeletonBinary(loader);
  const skeleton = binary.readSkeletonData(fs.readFileSync(path.join(dir, skelFile)));

  return {
    folder,
    base: skelFile.replace(/\.skel$/, ""),
    atlasFile,
    skelFile,
    pngFiles,
    version: skeleton.version,
    skins: skeleton.skins.map((skin) => skin.name),
    skinAttachmentCounts: Object.fromEntries(
      skeleton.skins.map((skin) => {
        let count = 0;
        skin.attachments.forEach(() => {
          count += 1;
        });
        return [skin.name, count];
      }),
    ),
    animations: skeleton.animations.map((animation) => ({
      name: animation.name,
      duration: Number(animation.duration.toFixed(3)),
    })),
  };
}

function buildActorMap(root) {
  const actors = new Map();
  for (const folder of walkActorFolders(root)) {
    try {
      const actor = parseSkeleton({ folder, root });
      if (actor) actors.set(folder, actor);
    } catch (error) {
      console.warn(`Skipping ${folder}: ${error.message}`);
    }
  }
  return actors;
}

function buildSharedVfxAtlas(root) {
  const folders = walkActorFolders(root);
  const atlasText = folders
    .map((folder) => {
      const dir = path.join(root, folder);
      const atlasFile = fs.readdirSync(dir).find((file) => file.endsWith(".atlas"));
      return atlasFile ? fs.readFileSync(path.join(dir, atlasFile), "utf8").trim() : "";
    })
    .filter(Boolean)
    .join("\n\n");
  if (!atlasText) return null;

  const sharedAtlasPath = path.join(root, "spine-vfx.atlas");
  fs.writeFileSync(sharedAtlasPath, `${atlasText}\n`);

  for (const folder of folders) {
    const dir = path.join(root, folder);
    for (const pngFile of fs.readdirSync(dir).filter((file) => file.endsWith(".png"))) {
      fs.copyFileSync(path.join(dir, pngFile), path.join(root, pngFile));
    }
  }
  return sharedAtlasPath;
}

function buildVfxAssets() {
  const sharedAtlasPath = buildSharedVfxAtlas(vfxRoot);
  if (!sharedAtlasPath) return [];

  const entries = [];
  for (const folder of walkActorFolders(vfxRoot)) {
    const dir = path.join(vfxRoot, folder);
    const files = fs.readdirSync(dir);
    const skelFile = files.find((file) => file.endsWith(".skel"));
    const atlasFile = files.find((file) => file.endsWith(".atlas"));
    const pngFiles = files.filter((file) => file.endsWith(".png")).sort();
    if (!skelFile || !atlasFile) continue;

    const id = Object.entries(VFX_ALIASES).find(([, aliasFolder]) => aliasFolder === folder)?.[0] ?? folder.toUpperCase();
    const base = skelFile.replace(/\.skel$/, "");
    const entry = {
      id,
      folder,
      source: `animations/vfx/${folder}/${base}`,
      atlasUrl: "/spine/sts2/vfx/spine-vfx.atlas",
      binaryUrl: `/spine/sts2/vfx/${folder}/${skelFile}`,
      textureUrls: pngFiles.map((file) => `/spine/sts2/vfx/${file}`),
      animations: [],
      idleAnimation: "",
      durationSeconds: 0.75,
      usable: true,
    };

    try {
      const parsed = parseSkeleton({ folder, root: vfxRoot, sharedAtlasFile: sharedAtlasPath });
      entry.animations = parsed.animations.map((animation) => animation.name);
      entry.idleAnimation = chooseIdleAnimation(entry.animations);
      entry.durationSeconds = parsed.animations[0]?.duration ?? entry.durationSeconds;
    } catch (error) {
      entry.usable = false;
      entry.parseError = error.message;
      entry.idleAnimation = base;
    }
    entries.push(entry);
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function slugFromImageUrl(imageUrl) {
  if (!imageUrl) return null;
  const basename = path.basename(imageUrl);
  return basename.replace(/\.(png|webp)$/i, "");
}

function chooseIdleAnimation(animations) {
  return (
    animations.find((name) => name === "idle_loop") ??
    animations.find((name) => name === "body/idle_loop") ??
    animations.find((name) => name.endsWith("/idle_loop")) ??
    animations.find((name) => name.startsWith("idle_loop")) ??
    animations.find((name) => name.endsWith("_loop")) ??
    animations[0] ??
    ""
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matchingAnimations(animations, needles) {
  const loweredNeedles = needles.map((needle) => needle.toLowerCase());
  return animations.filter((animation) => {
    const normalized = animation.toLowerCase();
    return loweredNeedles.some((needle) => normalized === needle || normalized.includes(needle));
  });
}

function matchingAnimationsByNeedlePriority(animations, needles) {
  return unique(needles.flatMap((needle) => matchingAnimations(animations, [needle])));
}

function hasValueForMove(values, moveId) {
  if (!values) return false;
  const compact = moveId.toLowerCase().replaceAll("_", "");
  return Object.keys(values).some((key) => key.toLowerCase().replaceAll("_", "") === compact);
}

function preferNonIdle(animations) {
  return animations.filter((animation) => !animation.toLowerCase().includes("idle"));
}

function moveAnimationCandidates(monster, move, animationNames, idleAnimation) {
  const moveText = `${move.id} ${move.name}`.toLowerCase();
  const direct = move.id.toLowerCase();
  const normalized = direct.replaceAll("_", "-");
  const hasDamageValue = hasValueForMove(monster.damage_values, move.id);
  const hasBlockValue = hasValueForMove(monster.block_values, move.id);
  const candidates = [
    direct,
    direct.replaceAll("_", ""),
    normalized,
    ...preferNonIdle(matchingAnimations(animationNames, [direct, normalized])),
  ];

  if (/boot|wake|spawn|hatch|unburrow|rise|respawn/.test(moveText)) {
    candidates.push(...matchingAnimations(animationNames, ["respawn", "wake_up", "spawn", "egg_hatch", "unburrow"]));
  }
  if (hasBlockValue || /block|shield|defend|protect|armor/.test(moveText)) {
    candidates.push(...matchingAnimations(animationNames, ["block_start", "block", "shield", "cast_shield", "left/block"]));
  }
  if (/buff|sharpen|charge|power|grow|regenerate|heal|summon|dance/.test(moveText)) {
    candidates.push(...matchingAnimations(animationNames, ["sharpen", "buff", "charge_up", "charge_start", "regenerate", "heal", "summon"]));
  }
  if (/spit|web|goop|debuff|dampen|weak|vulnerable|stun|poison|gaze|hex|curse|spores/.test(moveText)) {
    candidates.push(...matchingAnimations(animationNames, ["spit", "debuff", "stun", "gaze", "hex", "curse", "special"]));
  }
  if (hasDamageValue || /slam|bite|slash|claw|strike|attack|uppercut|swipe|laser|beam|zap|explode|stab|shoot|peck|throw|punch|thrash|beat|blast|bomb|ram|pounce|spit|cannon|scream/.test(moveText)) {
    candidates.push(...matchingAnimationsByNeedlePriority(animationNames, ["attack", "slash", "claw", "bite", "laser", "beam", "explode", "stab", "punch", "ram", "special"]));
  }

  if (!/nothing|dead|idle|stunned|dizzy|fade|flee/.test(moveText)) {
    const genericOrder = hasDamageValue
      ? ["attack", "special", "buff", "cast"]
      : ["buff", "cast", "special", "attack"];
    candidates.push(...matchingAnimationsByNeedlePriority(animationNames, genericOrder));
  }
  candidates.push(idleAnimation, animationNames[0]);
  return unique(candidates);
}

function moveVfxCandidates(move, usableVfxIds) {
  const text = `${move.id} ${move.name}`.toUpperCase();
  const candidates = [];
  if (/LASER|BEAM|ZAP/.test(text)) candidates.push("VFX_LASER");
  if (/SLASH/.test(text)) candidates.push("VFX_FLYING_SLASH", "VFX_SCRATCH");
  if (/SCRATCH|CLAW/.test(text)) candidates.push("VFX_SCRATCH");
  if (/CHAIN|BIND/.test(text)) candidates.push("VFX_CHAIN");
  if (/GAZE/.test(text)) candidates.push("VFX_GAZE");
  if (/SHIELD|BLOCK/.test(text)) candidates.push("VFX_MECHA_KNIGHT_SHIELD");
  if (/EXPLODE|EXPLOSION/.test(text)) candidates.push("VFX_KAISER_CRAB_BOSS_EXPLOSION");
  return unique(candidates).filter((id) => usableVfxIds.has(id));
}

function skinVariantLabel(skin) {
  if (skin === "default") return "default";
  return skin.replaceAll("_", " ");
}

function buildSkinVariants(actor, alias) {
  if (alias?.tags?.includes("shared-actor")) return [];

  const selectedSkin = alias?.skin ?? null;
  const variants = actor.skins
    .filter((skin) => {
      if (skin === "default") return true;
      if (skin === selectedSkin) return true;
      return (actor.skinAttachmentCounts[skin] ?? 0) > 0;
    })
    .map((skin) => ({
      id: skin,
      label: skinVariantLabel(skin),
      attachmentCount: actor.skinAttachmentCounts[skin] ?? 0,
    }));

  return variants.length > 1 ? variants : [];
}

function buildMonsterAsset(monster, actor, alias, vfxById) {
  const animationNames = actor.animations.map((animation) => animation.name);
  const idleAnimation = chooseIdleAnimation(animationNames);
  const bestiaryAnimations = ["revive", "hurt", "die"].filter((animation) => animationNames.includes(animation));
  const moves = monster.bestiary_moves ?? monster.moves ?? [];
  const usableVfxIds = new Set([...vfxById.keys()]);
  const skinVariants = buildSkinVariants(actor, alias);
  const moveAnimations = Object.fromEntries(
    moves.map((move) => [move.id, moveAnimationCandidates(monster, move, animationNames, idleAnimation)]),
  );
  for (const animationId of bestiaryAnimations) {
    moveAnimations[animationId] = [animationId, idleAnimation];
  }
  const moveEffects = Object.fromEntries(
    moves
      .map((move) => [move.id, moveVfxCandidates(move, usableVfxIds).map((id) => vfxById.get(id))])
      .filter(([, effects]) => effects.length > 0),
  );

  return {
    id: monster.id,
    source: `animations/monsters/${actor.folder}/${actor.base}`,
    renderStatus: alias?.renderStatus ?? "spine",
    renderTags: alias?.tags ?? [],
    atlasUrl: `/spine/sts2/monsters/${actor.folder}/${actor.atlasFile}`,
    binaryUrl: `/spine/sts2/monsters/${actor.folder}/${actor.skelFile}`,
    textureUrls: actor.pngFiles.map((file) => `/spine/sts2/monsters/${actor.folder}/${file}`),
    skin: alias?.skin ?? null,
    skins: actor.skins,
    ...(skinVariants.length > 0 ? { skinVariants } : {}),
    animations: animationNames,
    bestiaryAnimations,
    idleAnimation,
    moveAnimations,
    moveEffects,
  };
}

function characterActionCandidates(animationNames, needles, idleAnimation) {
  const matches = matchingAnimationsByNeedlePriority(animationNames, needles);
  return unique([...preferNonIdle(matches), idleAnimation, animationNames[0]]);
}

function buildCharacterAsset(character, actor, alias, vfxById) {
  const animationNames = actor.animations.map((animation) => animation.name);
  const idleAnimation = chooseIdleAnimation(animationNames);
  const attackVfx = alias.attackVfx ? vfxById.get(alias.attackVfx) : null;

  return {
    id: character.id,
    source: `animations/characters/${actor.folder}/${actor.base}`,
    renderStatus: "spine",
    renderTags: [],
    atlasUrl: `/spine/sts2/characters/${actor.folder}/${actor.atlasFile}`,
    binaryUrl: `/spine/sts2/characters/${actor.folder}/${actor.skelFile}`,
    textureUrls: actor.pngFiles.map((file) => `/spine/sts2/characters/${actor.folder}/${file}`),
    skin: null,
    skins: actor.skins,
    animations: animationNames,
    bestiaryAnimations: [],
    idleAnimation,
    moveAnimations: {
      IDLE: [idleAnimation],
      ATTACK: characterActionCandidates(animationNames, ["attack", "slash", "strike", "stab", "shoot", "cast"], idleAnimation),
      HURT: characterActionCandidates(animationNames, ["hurt", "hit", "damage"], idleAnimation),
      DIE: characterActionCandidates(animationNames, ["die", "death", "dead"], idleAnimation),
    },
    moveEffects: attackVfx ? { ATTACK: [attackVfx] } : {},
  };
}

function buildCharacterAssets(vfxById) {
  const actors = buildActorMap(characterRoot);
  const characters = readJson(charactersPath);
  const assets = [];

  for (const character of characters) {
    const alias = CHARACTER_ALIASES[character.id];
    if (!alias) continue;
    const actor = actors.get(alias.folder);
    if (!actor) continue;
    assets.push(buildCharacterAsset(character, actor, alias, vfxById));
  }

  return assets.sort((a, b) => a.id.localeCompare(b.id));
}

function main() {
  const actors = buildActorMap(monsterRoot);
  const vfxAssets = buildVfxAssets();
  const vfxById = new Map(vfxAssets.filter((asset) => asset.usable).map((asset) => [asset.id, asset]));
  const characterAssets = buildCharacterAssets(vfxById);
  const monsters = readJson(monstersPath).filter((monster) => monster.show_in_compendium !== false);
  const assets = [];
  const missing = [];

  for (const monster of monsters) {
    const alias = MONSTER_ALIASES[monster.id];
    const folder = alias?.folder ?? slugFromImageUrl(monster.image_url);
    const actor = folder ? actors.get(folder) : null;
    if (!actor) {
      missing.push({
        id: monster.id,
        imageSlug: slugFromImageUrl(monster.image_url),
        renderStatus: "static-only",
        renderTags: ["no-renderable-spine-actor"],
        fallbackImageUrl: monster.image_url,
        reason: "No renderable animations/monsters Spine actor was found in the PCK.",
      });
      continue;
    }
    assets.push(buildMonsterAsset(monster, actor, alias, vfxById));
  }

  writeJson(outVfxPath, vfxAssets);
  writeJson(outCharacterPath, characterAssets);
  writeJson(outMonsterPath, assets);
  writeJson(outMonsterFallbackPath, missing);
  console.log(`indexed ${characterAssets.length} character Spine assets`);
  console.log(`indexed ${assets.length} monster Spine assets (${missing.length} static fallbacks)`);
  console.log(`indexed ${vfxAssets.length} Spine VFX assets (${vfxAssets.filter((asset) => asset.usable).length} usable)`);
  if (missing.length > 0) console.log(`static fallback monsters: ${missing.map((entry) => entry.id).join(", ")}`);
}

main();
