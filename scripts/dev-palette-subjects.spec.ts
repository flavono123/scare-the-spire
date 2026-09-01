import assert from "node:assert/strict";
import type { MonsterSpineAsset } from "../src/lib/codex-types";
import {
  buildPaletteSubjects,
  paletteActionIds,
  paletteActionLabel,
  subjectsForKind,
  type PaletteAncientSource,
  type PaletteCharacterSource,
  type PaletteMonsterSource,
} from "../src/lib/dev-palette-subjects";

function fakeSpine(
  id: string,
  extra?: Partial<MonsterSpineAsset>,
): MonsterSpineAsset {
  return {
    id,
    source: id,
    renderStatus: "spine",
    renderTags: [],
    atlasUrl: `/spine/${id}.atlas`,
    binaryUrl: `/spine/${id}.skel`,
    textureUrls: [],
    skin: null,
    skins: ["default"],
    animations: ["idle_loop"],
    bestiaryAnimations: [],
    idleAnimation: "idle_loop",
    moveAnimations: { IDLE: ["idle_loop"] },
    moveEffects: {},
    ...extra,
  };
}

const characters: PaletteCharacterSource[] = [
  {
    id: "DEFECT",
    name: "디펙트",
    iconUrl: "/icons/defect.webp",
    combatImageUrl: "/combat/defect.webp",
    spineAsset: fakeSpine("DEFECT", {
      moveAnimations: {
        IDLE: ["idle"],
        ATTACK: ["attack"],
        HURT: ["hurt"],
      },
    }),
  },
  {
    id: "IRONCLAD",
    name: "아이언클래드",
    iconUrl: "/icons/ironclad.webp",
    combatImageUrl: "/combat/ironclad.webp",
    spineAsset: fakeSpine("IRONCLAD", {
      moveAnimations: {
        IDLE: ["idle"],
        ATTACK: ["attack"],
        HURT: ["hurt"],
      },
    }),
  },
];

const monsters: PaletteMonsterSource[] = [
  {
    id: "QUEEN",
    name: "여왕",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/queen.webp",
    bossImageUrl: "/bosses/queen_boss.webp",
    spineAsset: fakeSpine("QUEEN"),
  },
  {
    id: "CRUSHER",
    name: "분쇄자",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/crusher.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("CRUSHER"),
  },
  {
    id: "DOORMAKER",
    name: "문을 만드는 자",
    type: "Boss",
    showInCompendium: true,
    imageUrl: null,
    bossImageUrl: "/bosses/doormaker_boss.webp",
    spineAsset: null,
  },
  {
    id: "LAGAVULIN",
    name: "라가불린",
    type: "Elite",
    showInCompendium: true,
    imageUrl: "/render/lagavulin.webp",
    bossImageUrl: "/bosses/should-not-use.webp",
    spineAsset: fakeSpine("LAGAVULIN"),
  },
  {
    id: "AEONGLASS",
    name: "영겁의 모래시계",
    type: "Normal",
    showInCompendium: true,
    imageUrl: null,
    bossImageUrl: "/bosses/aeonglass_boss.webp",
    spineAsset: fakeSpine("AEONGLASS"),
  },
  {
    id: "JAW_WORM",
    name: "턱벌레",
    type: "Normal",
    showInCompendium: true,
    imageUrl: "/render/jaw_worm.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("JAW_WORM"),
  },
  {
    id: "THE_DREAMER",
    name: "꿈꾸는 자",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/dreamer.webp",
    bossImageUrl: "/bosses/dreamer_boss.webp",
    spineAsset: fakeSpine("THE_DREAMER"),
  },
];

const ancients: PaletteAncientSource[] = [
  {
    id: "DARV",
    name: "다브",
    imageUrl: "/ancients/darv.webp",
    spineAsset: null,
    sceneAsset: {
      token: "/ancients/darv.webp",
      fallback: { path: "/ancients-bg/darv_bg.webp" },
    },
  },
  {
    id: "NEOW",
    name: "니오우",
    imageUrl: "/ancients/neow.webp",
    spineAsset: fakeSpine("NEOW"),
    sceneAsset: {
      token: "/ancients/neow.webp",
      fallback: { path: "/ancients-bg/neow_fallback.webp" },
    },
  },
];

const subjects = buildPaletteSubjects({ characters, monsters, ancients });

assert.deepEqual(
  subjectsForKind(subjects, "character").map((subject) => subject.id),
  ["IRONCLAD", "DEFECT"],
);

const queen = subjects.find((subject) => subject.id === "QUEEN");
assert.equal(queen?.kind, "boss");
assert.equal(queen?.tokenUrl, "/bosses/queen_boss.webp");

const crusher = subjects.find((subject) => subject.id === "CRUSHER");
assert.equal(crusher?.kind, "boss");
assert.equal(crusher?.tokenUrl, null);
assert.equal(crusher?.pickerImageUrl, "/render/crusher.webp");

const doormaker = subjects.find((subject) => subject.id === "DOORMAKER");
assert.equal(doormaker?.spineAsset, null);
assert.equal(doormaker?.tokenUrl, "/bosses/doormaker_boss.webp");
assert.deepEqual(doormaker?.actionIds, []);

const elite = subjects.find((subject) => subject.id === "LAGAVULIN");
assert.equal(elite?.kind, "elite");
assert.equal(elite?.tokenUrl, null);
assert.equal(elite?.pickerImageUrl, "/render/lagavulin.webp");

assert.equal(subjects.some((subject) => subject.id === "AEONGLASS" && subject.kind === "boss"), true);
assert.equal(subjects.some((subject) => subject.id === "JAW_WORM"), false);
assert.equal(subjects.some((subject) => subject.id === "THE_DREAMER"), false);

const darv = subjects.find((subject) => subject.id === "DARV");
assert.equal(darv?.kind, "ancient");
assert.equal(darv?.tokenUrl, "/ancients/darv.webp");
assert.equal(darv?.spineAsset, null);

const neow = subjects.find((subject) => subject.id === "NEOW");
assert.ok(neow?.spineAsset);
assert.ok(neow?.actionIds.includes("IDLE"));

assert.deepEqual(paletteActionLabel("IDLE"), "대기");
assert.deepEqual(
  paletteActionIds("character", fakeSpine("X", {
    moveAnimations: { IDLE: ["idle"], ATTACK: ["attack"] },
  })),
  ["IDLE", "ATTACK"],
);

console.log("dev-palette-subjects.spec.ts: ok");
