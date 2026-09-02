import assert from "node:assert/strict";
import type { MonsterSpineAsset } from "../src/lib/codex-types";
import {
  UNSET_PALETTE_SUBJECT,
  buildPaletteSubjects,
  paletteActionIds,
  paletteActionLabel,
  paletteNicknameIconUrl,
  subjectsForKind,
  type PaletteAncientSource,
  type PaletteCharacterSource,
  type PaletteEncounterSource,
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

function monsterRef(id: string, name: string): PaletteEncounterSource["monsters"][number] {
  return { id, name, nameEn: id };
}

function bossEncounter(
  extra: Pick<PaletteEncounterSource, "id" | "name" | "monsters" | "compositions"> &
    Partial<Pick<PaletteEncounterSource, "imageUrl" | "scene">>,
): PaletteEncounterSource {
  return {
    roomType: "Boss",
    imageUrl: `/images/sts2/bosses/${extra.id.toLowerCase()}.webp`,
    scene: extra.scene ?? { backgroundSpineAsset: null },
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
    id: "TORCH_HEAD_AMALGAM",
    name: "횃불머리 융합체",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/amalgam.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("TORCH_HEAD_AMALGAM"),
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
    id: "ROCKET",
    name: "로켓",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/rocket.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("ROCKET"),
  },
  {
    id: "KIN_FOLLOWER",
    name: "혈족 추종자",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/kin_follower.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("KIN_FOLLOWER"),
  },
  {
    id: "KIN_PRIEST",
    name: "혈족 사제",
    type: "Boss",
    showInCompendium: true,
    imageUrl: "/render/kin_priest.webp",
    bossImageUrl: null,
    spineAsset: fakeSpine("KIN_PRIEST"),
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

const encounters: PaletteEncounterSource[] = [
  bossEncounter({
    id: "AEONGLASS_BOSS",
    name: "영겁의 모래시계",
    monsters: [monsterRef("AEONGLASS", "영겁의 모래시계")],
    compositions: [{
      id: "FIXED",
      weight: 1,
      slots: [[monsterRef("AEONGLASS", "영겁의 모래시계")]],
      slotNames: [null],
    }],
  }),
  bossEncounter({
    id: "KAISER_CRAB_BOSS",
    name: "황제 게",
    imageUrl: "/images/sts2/monsters-render/kaiser_crab.webp",
    monsters: [monsterRef("CRUSHER", "분쇄자"), monsterRef("ROCKET", "로켓")],
    compositions: [{
      id: "FIXED",
      weight: 1,
      slots: [
        [monsterRef("CRUSHER", "분쇄자")],
        [monsterRef("ROCKET", "로켓")],
      ],
      slotNames: ["crusher", "rocket"],
    }],
  }),
  bossEncounter({
    id: "THE_KIN_BOSS",
    name: "혈족",
    monsters: [monsterRef("KIN_FOLLOWER", "혈족 추종자"), monsterRef("KIN_PRIEST", "혈족 사제")],
    compositions: [{
      id: "FIXED",
      weight: 1,
      slots: [
        [monsterRef("KIN_FOLLOWER", "혈족 추종자")],
        [monsterRef("KIN_FOLLOWER", "혈족 추종자")],
        [monsterRef("KIN_PRIEST", "혈족 사제")],
      ],
      slotNames: ["slot1", "slot2", "leaderSlot"],
    }],
  }),
  bossEncounter({
    id: "QUEEN_BOSS",
    name: "여왕",
    monsters: [monsterRef("QUEEN", "여왕"), monsterRef("TORCH_HEAD_AMALGAM", "횃불머리 융합체")],
    compositions: [{
      id: "FIXED",
      weight: 1,
      slots: [
        [monsterRef("TORCH_HEAD_AMALGAM", "횃불머리 융합체")],
        [monsterRef("QUEEN", "여왕")],
      ],
      slotNames: ["amalgam", "queen"],
    }],
    scene: { backgroundSpineAsset: fakeSpine("QUEEN_BOSS_CAGES") },
  }),
  bossEncounter({
    id: "DOORMAKER_BOSS",
    name: "문을 만드는 자",
    monsters: [monsterRef("DOORMAKER", "문을 만드는 자")],
    compositions: null,
  }),
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

const subjects = buildPaletteSubjects({ characters, monsters, ancients, encounters });

assert.deepEqual(
  subjectsForKind(subjects, "character").map((subject) => subject.id),
  ["IRONCLAD", "DEFECT"],
);

const queen = subjects.find((subject) => subject.id === "QUEEN_BOSS");
assert.equal(queen?.kind, "boss");
assert.equal(queen?.name, "여왕");
assert.equal(queen?.tokenUrl, "/images/sts2/bosses/queen_boss.webp");
assert.equal(queen?.spinePreview, "encounter");
assert.equal(subjects.some((subject) => subject.id === "QUEEN"), false);
assert.equal(subjects.some((subject) => subject.id === "TORCH_HEAD_AMALGAM"), false);

const kaiser = subjects.find((subject) => subject.id === "KAISER_CRAB_BOSS");
assert.equal(kaiser?.kind, "boss");
assert.equal(kaiser?.name, "황제 게");
assert.equal(kaiser?.tokenUrl, "/images/sts2/bosses/kaiser_crab_boss.webp");
assert.equal(kaiser?.spinePreview, "encounter");
assert.equal(subjects.some((subject) => subject.id === "CRUSHER"), false);
assert.equal(subjects.some((subject) => subject.id === "ROCKET"), false);

const kin = subjects.find((subject) => subject.id === "THE_KIN_BOSS");
assert.equal(kin?.kind, "boss");
assert.equal(kin?.name, "혈족");
assert.equal(kin?.tokenUrl, "/images/sts2/bosses/the_kin_boss.webp");
assert.equal(kin?.spinePreview, "encounter");
assert.equal(subjects.some((subject) => subject.id === "KIN_FOLLOWER"), false);
assert.equal(subjects.some((subject) => subject.id === "KIN_PRIEST"), false);

const doormaker = subjects.find((subject) => subject.id === "DOORMAKER_BOSS");
assert.equal(doormaker?.spineAsset, null);
assert.equal(doormaker?.spinePreview, "static");
assert.equal(doormaker?.tokenUrl, "/images/sts2/bosses/doormaker_boss.webp");
assert.equal(doormaker?.staticPreviewUrl, "/images/sts2/bosses/doormaker_boss.webp");
assert.deepEqual(doormaker?.actionIds, []);
assert.equal(subjects.some((subject) => subject.id === "DOORMAKER"), false);

const elite = subjects.find((subject) => subject.id === "LAGAVULIN");
assert.equal(elite?.kind, "elite");
assert.equal(elite?.tokenUrl, null);
assert.equal(elite?.pickerImageUrl, "/render/lagavulin.webp");
assert.equal(elite ? paletteNicknameIconUrl(elite) : "missing", null);

const ironclad = subjects.find((subject) => subject.id === "IRONCLAD");
assert.equal(ironclad ? paletteNicknameIconUrl(ironclad) : "missing", "/icons/ironclad.webp");
assert.equal(queen ? paletteNicknameIconUrl(queen) : "missing", "/images/sts2/bosses/queen_boss.webp");

assert.equal(subjects.some((subject) => subject.id === "AEONGLASS_BOSS" && subject.kind === "boss"), true);
assert.equal(subjects.some((subject) => subject.id === "AEONGLASS"), false);
assert.equal(subjects.some((subject) => subject.id === "JAW_WORM"), false);
assert.equal(subjects.some((subject) => subject.id === "THE_DREAMER"), false);

const darv = subjects.find((subject) => subject.id === "DARV");
assert.equal(darv?.kind, "ancient");
assert.equal(darv?.tokenUrl, "/ancients/darv.webp");
assert.equal(darv?.spineAsset, null);
assert.equal(darv ? paletteNicknameIconUrl(darv) : "missing", "/ancients/darv.webp");
assert.equal(paletteNicknameIconUrl(UNSET_PALETTE_SUBJECT), "/images/sts2/profile/unset.webp");

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
