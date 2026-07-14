#!/usr/bin/env node
import { TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } from "@esotericsoftware/spine-player";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const ancientRoot = path.join(repoRoot, "public/spine/sts2/ancients");
const characterSelectRoot = path.join(repoRoot, "public/spine/sts2/character-select");
const characterRoot = path.join(repoRoot, "public/spine/sts2/characters");
const monsterRoot = path.join(repoRoot, "public/spine/sts2/monsters");
const vfxRoot = path.join(repoRoot, "public/spine/sts2/vfx");
const charactersPath = path.join(repoRoot, "data/sts2/eng/characters.json");
const monstersPath = path.join(repoRoot, "data/sts2/eng/monsters.json");
const outAncientPath = path.join(repoRoot, "data/sts2/ancient-spine-assets.json");
const outCharacterSelectPath = path.join(repoRoot, "data/sts2/character-select-spine-assets.json");
const outCharacterPath = path.join(repoRoot, "data/sts2/character-spine-assets.json");
const outMonsterPath = path.join(repoRoot, "data/sts2/monster-spine-assets.json");
const outMonsterFallbackPath = path.join(repoRoot, "data/sts2/monster-spine-fallbacks.json");
const outVfxPath = path.join(repoRoot, "data/sts2/spine-vfx-assets.json");

const KAISER_CRAB_IDLE_TRACKS = [
  spineTrack(0, "body/idle_loop"),
  spineTrack(1, "left/idle_loop"),
  spineTrack(2, "right/idle_loop"),
];

const KAISER_CRAB_LEFT_IDLE = [
  spineTrack(0, "body/idle_loop"),
  spineTrack(1, "left/idle_loop"),
  spineTrack(2, "right/idle_loop"),
];

const KAISER_CRAB_RIGHT_IDLE = [
  spineTrack(0, "body/idle_loop"),
  spineTrack(1, "left/idle_loop"),
  spineTrack(2, "right/idle_loop"),
];

const CRUSHER_MOVE_ANIMATIONS = {
  THRASH: ["left/attack_heavy", "left/idle_loop", "body/idle_loop"],
  ENLARGING_STRIKE: ["left/attack_med", "left/idle_loop", "body/idle_loop"],
  BUG_STING: ["left/attack_double", "left/idle_loop", "body/idle_loop"],
  ADAPT: ["left/buff", "left/idle_loop", "body/idle_loop"],
  GUARDED_STRIKE: ["left/attack_med", "left/idle_loop", "body/idle_loop"],
  hurt: ["left/hurt", "left/idle_loop", "body/idle_loop"],
  die: ["left/die", "body/idle_loop"],
};

const ROCKET_MOVE_ANIMATIONS = {
  TARGETING_RETICLE: ["right/attack", "right/idle_loop", "body/idle_loop"],
  PRECISION_BEAM: ["right/attack_med", "right/idle_loop", "body/idle_loop"],
  CHARGE_UP: ["right/charge_up", "right/charged_loop", "body/idle_loop"],
  LASER: ["right/attack_heavy", "right/rest_loop", "body/idle_loop"],
  RECHARGE: ["right/wake_up", "right/idle_loop", "body/idle_loop"],
  hurt: ["right/hurt", "right/idle_loop", "body/idle_loop"],
  die: ["right/die", "body/idle_loop"],
};

const CRUSHER_TRACKS = {
  THRASH: kaiserCrabLeftMove("left/attack_heavy"),
  ENLARGING_STRIKE: kaiserCrabLeftMove("left/attack_med"),
  BUG_STING: kaiserCrabLeftMove("left/attack_double"),
  ADAPT: kaiserCrabLeftMove("left/buff"),
  GUARDED_STRIKE: kaiserCrabLeftMove("left/attack_med"),
  hurt: [
    ...KAISER_CRAB_LEFT_IDLE,
    spineTrack(1, "left/hurt", { loop: false, idleAnimation: "left/idle_loop" }),
    spineTrack(3, "reactions/hurt_left", { loop: false }),
  ],
  die: [
    spineTrack(0, "body/idle_loop"),
    spineTrack(2, "right/idle_loop"),
    spineTrack(1, "left/die", { loop: false }),
    spineTrack(3, "reactions/hurt_left", { loop: false }),
  ],
};

const ROCKET_TRACKS = {
  TARGETING_RETICLE: kaiserCrabRightMove("right/attack"),
  PRECISION_BEAM: kaiserCrabRightMove("right/attack_med"),
  CHARGE_UP: kaiserCrabRightMove("right/charge_up", "right/charged_loop"),
  LASER: kaiserCrabRightMove("right/attack_heavy", "right/rest_loop"),
  RECHARGE: [
    spineTrack(0, "body/idle_loop"),
    spineTrack(1, "left/idle_loop"),
    spineTrack(2, "right/wake_up", { loop: false, idleAnimation: "right/idle_loop" }),
  ],
  hurt: [
    ...KAISER_CRAB_RIGHT_IDLE,
    spineTrack(2, "right/hurt", { loop: false, idleAnimation: "right/idle_loop" }),
    spineTrack(3, "reactions/hurt_right", { loop: false }),
  ],
  die: [
    spineTrack(0, "body/idle_loop"),
    spineTrack(1, "left/idle_loop"),
    spineTrack(2, "right/die", { loop: false }),
    spineTrack(3, "reactions/hurt_right", { loop: false }),
  ],
};

const AEONGLASS_IDLE_TRACKS = [
  spineTrack(0, "idle_loop"),
  spineTrack(1, "_track1/rings_normal"),
];

const AEONGLASS_TRACKS = {
  EBB: aeonglassMove("attack_heavy", "_track1/rings_attack_heavy"),
  EYE_LASERS: aeonglassMove("attack_double", "_track1/rings_attack_double"),
  INCREASING_INTENSITY: aeonglassMove("wither", "_track1/rings_normal"),
  hurt: aeonglassMove("hurt", "_track1/rings_normal"),
  die: aeonglassMove("die", "_track1/rings_die"),
};

const MONSTER_ALIASES = {
  AEONGLASS: {
    folder: "aeonglass",
    idleTracks: AEONGLASS_IDLE_TRACKS,
    moveAnimations: {
      EBB: ["attack_heavy", "idle_loop"],
      EYE_LASERS: ["attack_double", "idle_loop"],
      INCREASING_INTENSITY: ["wither", "idle_loop"],
      hurt: ["hurt", "idle_loop"],
      die: ["die", "idle_loop"],
    },
    moveAnimationTracks: AEONGLASS_TRACKS,
  },
  BOWLBUG_EGG: { folder: "bowlbug", skin: "cocoon", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_NECTAR: { folder: "bowlbug", skin: "goop", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_ROCK: { folder: "bowlbug", skin: "rock", tags: ["shared-actor", "variant-skin"] },
  BOWLBUG_SILK: { folder: "bowlbug", skin: "web", tags: ["shared-actor", "variant-skin"] },
  CALCIFIED_CULTIST: { folder: "cultists", skin: "coral", tags: ["shared-actor", "variant-skin"] },
  CRUSHER: {
    folder: "kaiser_crab",
    tags: ["shared-actor", "kaiser-crab", "kaiser-crab-left"],
    idleAnimation: "body/idle_loop",
    idleTracks: KAISER_CRAB_IDLE_TRACKS,
    moveAnimations: CRUSHER_MOVE_ANIMATIONS,
    moveAnimationTracks: CRUSHER_TRACKS,
    bestiaryAnimations: ["hurt", "die"],
    viewport: { x: -3250, y: -1120, width: 3950, height: 2850, padLeft: "2%", padRight: "4%", padTop: "4%", padBottom: "3%" },
  },
  CUBEX_CONSTRUCT: { folder: "cubex_construct", tags: ["variant-skin"] },
  DAMP_CULTIST: { folder: "cultists", skin: "slug", tags: ["shared-actor", "variant-skin"] },
  FAKE_MERCHANT_MONSTER: {
    folder: "fake_merchant_monster",
    source: "animations/backgrounds/fake_merchant_room/top/fake_merchant_top",
    idleAnimation: "combat_idle_loop",
    tags: ["shared-event-actor"],
  },
  FLYCONID: { folder: "flying_mushrooms", tags: ["image-slug-alias"] },
  GLOBE_HEAD: { folder: "globe_head", tags: ["image-slug-alias"] },
  ROCKET: {
    folder: "kaiser_crab",
    tags: ["shared-actor", "kaiser-crab", "kaiser-crab-right"],
    idleAnimation: "body/idle_loop",
    idleTracks: KAISER_CRAB_IDLE_TRACKS,
    moveAnimations: ROCKET_MOVE_ANIMATIONS,
    moveAnimationTracks: ROCKET_TRACKS,
    bestiaryAnimations: ["hurt", "die"],
    viewport: { x: -700, y: -1120, width: 4250, height: 2850, padLeft: "4%", padRight: "2%", padTop: "4%", padBottom: "3%" },
  },
  SCROLL_OF_BITING: { folder: "scroll_of_biting", tags: ["variant-skin"] },
  SKULKING_COLONY: { folder: "skulking_colony", tags: ["image-slug-alias"] },
  TORCH_HEAD_AMALGAM: { folder: "torch_head_amalgam", tags: ["image-slug-alias"] },
};

const MONSTER_SKIN_PARTS = {
  BYRDPIP: [
    skinPart("version", "형태", "Form", [
      skinOption("version1", "형태 1", "Form 1"),
      skinOption("version2", "형태 2", "Form 2"),
      skinOption("version3", "형태 3", "Form 3"),
      skinOption("version4", "형태 4", "Form 4"),
    ]),
  ],
  CUBEX_CONSTRUCT: [
    skinPart("eye", "눈", "Eye", [
      skinOption("circleeye", "원형", "Circle", "circle"),
      skinOption("diamondeye", "마름모", "Diamond", "diamond"),
      skinOption("squareeye", "사각형", "Square", "square"),
    ]),
    skinPart("moss", "이끼", "Moss", [
      skinOption("moss1", "이끼1", "Moss 1"),
      skinOption("moss2", "이끼2", "Moss 2"),
      skinOption("moss3", "이끼3", "Moss 3"),
    ]),
  ],
  KIN_FOLLOWER: [
    skinPart("hair", "머리", "Hair", [
      skinOption("hair_1", "머리 1", "Hair 1"),
      skinOption("hair_2", "머리 2", "Hair 2"),
      skinOption("hair_3", "머리 3", "Hair 3"),
    ]),
  ],
  PAELS_LEGION: [
    skinPart("eyes", "눈", "Eyes", [
      skinOption("eyes", "눈", "Eyes"),
    ]),
    skinPart("horns", "뿔", "Horns", [
      skinOption("horns", "뿔", "Horns"),
    ]),
    skinPart("spikes", "가시", "Spikes", [
      skinOption("spikes", "가시", "Spikes"),
    ]),
    skinPart("wing", "날개", "Wing", [
      skinOption("wing", "날개", "Wing"),
    ]),
  ],
  SCROLL_OF_BITING: [
    skinPart("color", "색상", "Color", [
      skinOption("skin1", "색상 1", "Color 1"),
      skinOption("skin2", "색상 2", "Color 2"),
    ]),
  ],
  TOADPOLE: [
    skinPart("eye", "눈", "Eye", [
      skinOption("eye1", "눈 1", "Eye 1"),
      skinOption("eye2", "눈 2", "Eye 2"),
    ]),
    skinPart("pattern", "무늬", "Pattern", [
      skinOption("pattern1", "무늬 1", "Pattern 1"),
      skinOption("pattern2", "무늬 2", "Pattern 2"),
    ]),
  ],
  TOUGH_EGG: [
    skinPart("shell", "껍질", "Shell", [
      skinOption("egg1", "껍질 1", "Shell 1"),
      skinOption("egg2", "껍질 2", "Shell 2"),
    ]),
  ],
  TWO_TAILED_RAT: [
    skinPart("barnacles", "따개비", "Barnacles", [
      skinOption("barnacles1", "따개비 1", "Barnacles 1"),
      skinOption("barnacles2", "따개비 2", "Barnacles 2"),
      skinOption("barnacles3", "따개비 3", "Barnacles 3"),
    ]),
    skinPart("head", "머리", "Head", [
      skinOption("head1", "머리 1", "Head 1"),
      skinOption("head2", "머리 2", "Head 2"),
    ]),
  ],
};

const BASE_COMPOSITE_SKIN_BY_NAME = new Set(["normal"]);
const INTERNAL_SKIN_NAMES = new Set(["normal", "phobia"]);
const PHOBIA_MODE_SKINS = {
  normalSkin: "normal",
  phobiaSkin: "phobia",
};

const VFX_ALIASES = {
  VFX_CHAIN: "vfx_chain",
  VFX_FLYING_SLASH: "vfx_flying_slash",
  VFX_GAZE: "vfx_gaze",
  VFX_KAISER_CRAB_BOSS_EXPLOSION: "vfx_kaiser_crab_boss_explosion",
  VFX_LASER: "vfx_laser",
  VFX_MECHA_KNIGHT_SHIELD: "vfx_mecha_knight_shield",
  VFX_SCRATCH: "vfx_scratch",
  VFX_SOVEREIGN_BLADE: "vfx_sovereign_blade",
};

const VFX_DISABLED_REASONS = {
  VFX_SOVEREIGN_BLADE: "Animation bounds are invalid in the web Spine runtime.",
};

const CHARACTER_ALIASES = {
  DEFECT: {
    folder: "defect",
    attackVfx: "VFX_LASER",
    specialActions: {
      POWER_UP: { animations: ["process"] },
    },
  },
  IRONCLAD: {
    folder: "ironclad",
    specialActions: {
      HEAVY_ATTACK: { animations: ["attack_heavy"] },
    },
  },
  NECROBINDER: {
    folder: "necrobinder",
    attackVfx: "VFX_SCRATCH",
    specialActions: {
      CAST: { animations: ["cast_mighty", "cast"] },
    },
  },
  REGENT: {
    folder: "regent",
    specialActions: {
      SOVEREIGN_BLADE: { animations: ["attack_sovereign"], vfx: "VFX_SOVEREIGN_BLADE" },
    },
  },
  SILENT: { folder: "silent", attackVfx: "VFX_SCRATCH" },
};

const CHARACTER_SELECT_ALIASES = {
  DEFECT: { folder: "defect" },
  IRONCLAD: { folder: "ironclad" },
  NECROBINDER: { folder: "necrobinder" },
  REGENT: { folder: "regent", skin: "normal" },
  SILENT: { folder: "silent" },
};

const ANCIENT_SPINE_ALIASES = {
  NEOW: { folder: "neow_room" },
  TEZCATARA: { folder: "tezcatara" },
};

const SUPPLEMENTAL_MONSTER_ACTORS = {
  OSTY: {
    folder: "osty",
    imageUrl: "/images/sts2/monsters/osty.webp",
    moves: [
      { id: "NOTHING", name: "대기", nameEn: "Nothing", description: "", descriptionEn: "" },
    ],
  },
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
  // Copy Node's pooled Buffer into a zero-offset Uint8Array. SpineBinary reads
  // the backing ArrayBuffer directly, so a pooled byteOffset can parse data
  // from another file and make this generated index nondeterministic.
  const skeletonBytes = new Uint8Array(fs.readFileSync(path.join(dir, skelFile)));
  const skeleton = binary.readSkeletonData(skeletonBytes);

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
      const disabledReason = VFX_DISABLED_REASONS[id];
      if (disabledReason) {
        entry.usable = false;
        entry.parseError = disabledReason;
      }
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

function skinPart(id, labelKo, labelEn, options) {
  return { id, labelKo, labelEn, options };
}

function skinOption(id, labelKo, labelEn, sortKey = id) {
  return { id, labelKo, labelEn, sortKey };
}

function spineTrack(track, animation, options = {}) {
  return {
    track,
    animation,
    ...(options.loop === false ? { loop: false } : {}),
    ...(options.idleAnimation ? { idleAnimation: options.idleAnimation } : {}),
  };
}

function kaiserCrabLeftMove(animation) {
  return [
    spineTrack(0, "body/idle_loop"),
    spineTrack(2, "right/idle_loop"),
    spineTrack(1, animation, { loop: false, idleAnimation: "left/idle_loop" }),
    spineTrack(3, "reactions/attack_left", { loop: false }),
  ];
}

function kaiserCrabRightMove(animation, idleAnimation = "right/idle_loop") {
  return [
    spineTrack(0, "body/idle_loop"),
    spineTrack(1, "left/idle_loop"),
    spineTrack(2, animation, { loop: false, idleAnimation }),
    spineTrack(3, "reactions/attack_right", { loop: false }),
  ];
}

function aeonglassMove(bodyAnimation, ringAnimation) {
  return [
    spineTrack(0, bodyAnimation, { loop: false, idleAnimation: "idle_loop" }),
    spineTrack(1, ringAnimation, { loop: false, idleAnimation: "_track1/rings_normal" }),
  ];
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

function compareSkinLabels(a, b) {
  return (
    a.labelKo.localeCompare(b.labelKo, "ko") ||
    a.labelEn.localeCompare(b.labelEn, "en") ||
    a.id.localeCompare(b.id)
  );
}

function compareSkinOptions(a, b) {
  return (
    a.sortKey.localeCompare(b.sortKey, "en") ||
    compareSkinLabels(a, b)
  );
}

function skinVariantLabel(skin) {
  return skin.replaceAll("_", " ");
}

function buildSkinParts(monsterId, actor, alias) {
  if (alias?.tags?.includes("shared-actor")) return [];

  const groups = MONSTER_SKIN_PARTS[monsterId] ?? [];
  return groups
    .map((part) => ({
      id: part.id,
      labelKo: part.labelKo,
      labelEn: part.labelEn,
      options: part.options
        .filter((option) => actor.skins.includes(option.id) && (actor.skinAttachmentCounts[option.id] ?? 0) > 0)
        .sort(compareSkinOptions)
        .map((option) => ({
          id: option.id,
          labelKo: option.labelKo,
          labelEn: option.labelEn,
          attachmentCount: actor.skinAttachmentCounts[option.id] ?? 0,
        })),
    }))
    .filter((part) => part.options.length > 0)
    .sort(compareSkinLabels);
}

function buildDefaultSkinCombination(skinParts) {
  return skinParts.map((part) => part.options[0]?.id).filter(Boolean);
}

function buildBaseSkinCombination(actor, alias, skinParts) {
  if (alias?.tags?.includes("shared-actor")) return [];
  if (skinParts.length > 0) return buildDefaultSkinCombination(skinParts);

  return actor.skins
    .filter((skin) => BASE_COMPOSITE_SKIN_BY_NAME.has(skin) && (actor.skinAttachmentCounts[skin] ?? 0) > 0)
    .sort();
}

function buildPhobiaMode(actor, alias) {
  if (alias?.tags?.includes("shared-actor")) return null;

  const hasNormal = actor.skins.includes(PHOBIA_MODE_SKINS.normalSkin)
    && (actor.skinAttachmentCounts[PHOBIA_MODE_SKINS.normalSkin] ?? 0) > 0;
  const hasPhobia = actor.skins.includes(PHOBIA_MODE_SKINS.phobiaSkin)
    && (actor.skinAttachmentCounts[PHOBIA_MODE_SKINS.phobiaSkin] ?? 0) > 0;

  return hasNormal && hasPhobia ? PHOBIA_MODE_SKINS : null;
}

function buildSkinVariants(actor, alias, skinParts) {
  if (alias?.tags?.includes("shared-actor")) return [];
  if (skinParts.length > 0) {
    const variants = skinParts.flatMap((part) => part.options.map((option) => ({
      id: option.id,
      label: option.labelKo,
      attachmentCount: option.attachmentCount,
    })));
    return variants.length > 1 ? variants : [];
  }

  const selectedSkin = alias?.skin ?? null;
  const variants = actor.skins
    .filter((skin) => {
      if (skin === "default") return false;
      if (INTERNAL_SKIN_NAMES.has(skin)) return false;
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
  const idleAnimation = alias?.idleAnimation && animationNames.includes(alias.idleAnimation)
    ? alias.idleAnimation
    : chooseIdleAnimation(animationNames);
  const bestiaryAnimations = unique([
    ...["revive", "hurt", "die"].filter((animation) => animationNames.includes(animation)),
    ...(alias?.bestiaryAnimations ?? []),
  ]);
  const moves = monster.bestiary_moves ?? monster.moves ?? [];
  const usableVfxIds = new Set([...vfxById.keys()]);
  const skinParts = buildSkinParts(monster.id, actor, alias);
  const defaultSkinCombination = buildBaseSkinCombination(actor, alias, skinParts);
  const phobiaMode = buildPhobiaMode(actor, alias);
  const skinVariants = buildSkinVariants(actor, alias, skinParts);
  const moveAnimations = Object.fromEntries(
    moves.map((move) => [
      move.id,
      alias?.moveAnimations?.[move.id] ?? moveAnimationCandidates(monster, move, animationNames, idleAnimation),
    ]),
  );
  for (const animationId of bestiaryAnimations) {
    moveAnimations[animationId] = alias?.moveAnimations?.[animationId] ?? [animationId, idleAnimation];
  }
  const moveEffects = Object.fromEntries(
    moves
      .map((move) => [move.id, moveVfxCandidates(move, usableVfxIds).map((id) => vfxById.get(id))])
      .filter(([, effects]) => effects.length > 0),
  );

  return {
    id: monster.id,
    source: alias?.source ?? `animations/monsters/${actor.folder}/${actor.base}`,
    renderStatus: alias?.renderStatus ?? "spine",
    renderTags: alias?.tags ?? [],
    atlasUrl: `/spine/sts2/monsters/${actor.folder}/${actor.atlasFile}`,
    binaryUrl: `/spine/sts2/monsters/${actor.folder}/${actor.skelFile}`,
    textureUrls: actor.pngFiles.map((file) => `/spine/sts2/monsters/${actor.folder}/${file}`),
    skin: alias?.skin ?? null,
    skins: actor.skins,
    ...(skinParts.length > 0 ? { skinParts } : {}),
    ...(defaultSkinCombination.length > 0 ? { defaultSkinCombination } : {}),
    ...(phobiaMode ? { phobiaMode } : {}),
    ...(alias?.viewport ? { viewport: alias.viewport } : {}),
    ...(skinVariants.length > 0 ? { skinVariants } : {}),
    animations: animationNames,
    bestiaryAnimations,
    idleAnimation,
    ...(alias?.idleTracks ? { idleTracks: alias.idleTracks } : {}),
    moveAnimations,
    ...(alias?.moveAnimationTracks ? { moveAnimationTracks: alias.moveAnimationTracks } : {}),
    moveEffects,
  };
}

function characterActionCandidates(animationNames, needles, idleAnimation) {
  const matches = matchingAnimationsByNeedlePriority(animationNames, needles);
  return unique([...preferNonIdle(matches), idleAnimation, animationNames[0]]);
}

function configuredCharacterActionCandidates(animationNames, action, idleAnimation) {
  const exactMatches = action.animations.filter((animation) => animationNames.includes(animation));
  if (exactMatches.length === 0) return [];
  return unique([...exactMatches, idleAnimation, animationNames[0]]);
}

function buildCharacterAsset(character, actor, alias, vfxById) {
  const animationNames = actor.animations
    .map((animation) => animation.name)
    .filter((animation) => !animation.startsWith("_ignore/"));
  const idleAnimation = chooseIdleAnimation(animationNames);
  const attackVfx = alias.attackVfx ? vfxById.get(alias.attackVfx) : null;
  const moveAnimations = {
    IDLE: [idleAnimation],
    ATTACK: characterActionCandidates(animationNames, ["attack", "slash", "strike", "stab", "shoot", "cast"], idleAnimation),
    HURT: characterActionCandidates(animationNames, ["hurt", "hit", "damage"], idleAnimation),
    DIE: characterActionCandidates(animationNames, ["die", "death", "dead"], idleAnimation),
  };
  const moveEffects = attackVfx ? { ATTACK: [attackVfx] } : {};

  for (const [actionId, action] of Object.entries(alias.specialActions ?? {})) {
    const candidates = configuredCharacterActionCandidates(animationNames, action, idleAnimation);
    if (candidates.length === 0) continue;
    moveAnimations[actionId] = candidates;
    const effect = action.vfx ? vfxById.get(action.vfx) : null;
    if (effect) moveEffects[actionId] = [effect];
  }

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
    moveAnimations,
    moveEffects,
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

function buildCharacterSelectAsset(character, actor, alias) {
  const animationNames = actor.animations
    .map((animation) => animation.name)
    .filter((animation) => !animation.startsWith("_ignore/"));
  const idleAnimation = chooseIdleAnimation(animationNames);
  const skin = alias.skin ?? (actor.skins.includes("normal") ? "normal" : null);

  return {
    id: character.id,
    source: `animations/character_select/${actor.folder}/${actor.base}`,
    renderStatus: "spine",
    renderTags: ["character-select-background"],
    atlasUrl: `/spine/sts2/character-select/${actor.folder}/${actor.atlasFile}`,
    binaryUrl: `/spine/sts2/character-select/${actor.folder}/${actor.skelFile}`,
    textureUrls: actor.pngFiles.map((file) => `/spine/sts2/character-select/${actor.folder}/${file}`),
    skin,
    skins: actor.skins,
    animations: animationNames,
    bestiaryAnimations: [],
    idleAnimation,
    moveAnimations: {
      IDLE: [idleAnimation],
    },
    moveEffects: {},
  };
}

function buildCharacterSelectAssets() {
  const actors = buildActorMap(characterSelectRoot);
  const characters = readJson(charactersPath);
  const assets = [];

  for (const character of characters) {
    const alias = CHARACTER_SELECT_ALIASES[character.id];
    if (!alias) continue;
    const actor = actors.get(alias.folder);
    if (!actor) continue;
    assets.push(buildCharacterSelectAsset(character, actor, alias));
  }

  return assets.sort((a, b) => a.id.localeCompare(b.id));
}

function buildAncientAsset(id, actor) {
  const animationNames = actor.animations.map((animation) => animation.name);
  const idleAnimation = chooseIdleAnimation(animationNames);

  return {
    id,
    source: `animations/backgrounds/${actor.folder}/${actor.base}`,
    renderStatus: "spine",
    renderTags: ["ancient-background"],
    atlasUrl: `/spine/sts2/ancients/${actor.folder}/${actor.atlasFile}`,
    binaryUrl: `/spine/sts2/ancients/${actor.folder}/${actor.skelFile}`,
    textureUrls: actor.pngFiles.map((file) => `/spine/sts2/ancients/${actor.folder}/${file}`),
    skin: null,
    skins: actor.skins,
    animations: animationNames,
    bestiaryAnimations: [],
    idleAnimation,
    moveAnimations: {
      IDLE: [idleAnimation],
    },
    moveEffects: {},
  };
}

function buildAncientAssets() {
  const actors = buildActorMap(ancientRoot);
  const assets = [];

  for (const [id, alias] of Object.entries(ANCIENT_SPINE_ALIASES)) {
    const actor = actors.get(alias.folder);
    if (!actor) continue;
    assets.push(buildAncientAsset(id, actor));
  }

  return assets.sort((a, b) => a.id.localeCompare(b.id));
}

function insertSupplementalAsset(assets, asset) {
  const index = assets.findIndex((entry) => entry.id.localeCompare(asset.id) > 0);
  if (index === -1) {
    assets.push(asset);
  } else {
    assets.splice(index, 0, asset);
  }
}

function main() {
  const actors = buildActorMap(monsterRoot);
  const vfxAssets = buildVfxAssets();
  const vfxById = new Map(vfxAssets.filter((asset) => asset.usable).map((asset) => [asset.id, asset]));
  const ancientAssets = buildAncientAssets();
  const characterAssets = buildCharacterAssets(vfxById);
  const characterSelectAssets = buildCharacterSelectAssets();
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

  for (const [id, config] of Object.entries(SUPPLEMENTAL_MONSTER_ACTORS)) {
    if (assets.some((asset) => asset.id === id)) continue;
    const actor = actors.get(config.folder);
    if (!actor) continue;
    insertSupplementalAsset(
      assets,
      buildMonsterAsset(
        {
          id,
          image_url: config.imageUrl,
          moves: config.moves,
        },
        actor,
        MONSTER_ALIASES[id],
        vfxById,
      ),
    );
  }

  writeJson(outVfxPath, vfxAssets);
  writeJson(outAncientPath, ancientAssets);
  writeJson(outCharacterSelectPath, characterSelectAssets);
  writeJson(outCharacterPath, characterAssets);
  writeJson(outMonsterPath, assets);
  writeJson(outMonsterFallbackPath, missing);
  console.log(`indexed ${ancientAssets.length} Ancient Spine assets`);
  console.log(`indexed ${characterAssets.length} character Spine assets`);
  console.log(`indexed ${characterSelectAssets.length} character-select Spine assets`);
  console.log(`indexed ${assets.length} monster Spine assets (${missing.length} static fallbacks)`);
  console.log(`indexed ${vfxAssets.length} Spine VFX assets (${vfxAssets.filter((asset) => asset.usable).length} usable)`);
  if (missing.length > 0) console.log(`static fallback monsters: ${missing.map((entry) => entry.id).join(", ")}`);
}

main();
