import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import type { CodexModifier, MonsterSpineAsset } from "../src/lib/codex-types";
import {
  compactIdleSpineAsset,
  compactThisOrThatEntity,
} from "../src/lib/this-or-that-data";

const spine: MonsterSpineAsset = {
  id: "IRONCLAD",
  source: "animations/characters/ironclad/ironclad",
  renderStatus: "spine",
  renderTags: [],
  atlasUrl: "/spine/sts2/characters/ironclad/ironclad.atlas",
  binaryUrl: "/spine/sts2/characters/ironclad/ironclad.skel",
  textureUrls: ["/spine/sts2/characters/ironclad/ironclad.png"],
  skin: null,
  skins: ["default"],
  animations: ["idle_loop", "attack", "low_health_loop"],
  bestiaryAnimations: [],
  idleAnimation: "idle_loop",
  moveAnimations: {
    IDLE: ["idle_loop"],
    ATTACK: ["attack"],
    LOW_HP_IDLE: ["low_health_loop"],
  },
  moveEffects: {
    ATTACK: [{
      id: "VFX_SLASH",
      source: "animations/vfx/slash",
      atlasUrl: "/spine/sts2/vfx/spine-vfx.atlas",
      binaryUrl: "/spine/sts2/vfx/slash.skel",
      textureUrls: ["/spine/sts2/vfx/slash.png"],
      animations: ["animation"],
      idleAnimation: "animation",
      durationSeconds: 0.3,
      usable: true,
    }],
  },
};

const idle = compactIdleSpineAsset(spine, { includeIdleVfx: true });
assert.ok(idle);
assert.deepEqual(idle.animations, ["idle_loop"]);
assert.deepEqual(idle.moveAnimations, { IDLE: ["idle_loop"] });
assert.deepEqual(idle.moveEffects, {});
assert.equal(idle.atlasUrl, spine.atlasUrl);

const modifier: CodexModifier = {
  id: "DRAFT",
  name: "드래프트",
  nameEn: "Draft",
  description: "모드 설명",
  descriptionEn: "Modifier description",
  polarity: "good",
  source: "run",
  characterId: null,
  imageUrl: "/images/sts2/modifiers/draft.webp",
  sortOrder: 0,
};

const compactModifier = compactThisOrThatEntity({
  id: "DRAFT",
  nameEn: "Draft",
  nameKo: "드래프트",
  imageUrl: modifier.imageUrl,
  color: "#7fff00",
  type: "modifier",
  modifierData: modifier,
});

assert.equal(compactModifier.modifierData?.name, "드래프트");
assert.equal(compactModifier.modifierData?.description, "모드 설명");
assert.equal(compactModifier.modifierData?.polarity, "good");

const compactCharacter = compactThisOrThatEntity({
  id: "IRONCLAD",
  nameEn: "Ironclad",
  nameKo: "아이언클래드",
  imageUrl: "/images/sts2/characters/ironclad.webp",
  color: "#ff0000",
  type: "character",
  characterData: {
    name: "아이언클래드",
    description: "desc",
    imageUrl: "/images/sts2/characters/ironclad.webp",
    selectImageUrl: "/images/sts2/characters/ironclad_select.webp",
    combatImageUrl: "/images/sts2/characters/combat_ironclad.webp",
    spineAsset: spine,
  } as EntityInfo["characterData"],
});

assert.equal(compactCharacter.characterData?.combatImageUrl, "/images/sts2/characters/combat_ironclad.webp");
assert.equal(compactCharacter.characterData?.spineAsset?.idleAnimation, "idle_loop");
assert.ok(!compactCharacter.characterData?.spineAsset?.animations.includes("low_health_loop"));
assert.ok(!compactCharacter.characterData?.spineAsset?.moveEffects.ATTACK);

const compactMonster = compactThisOrThatEntity({
  id: "CULTIST",
  nameEn: "Cultist",
  nameKo: "광신도",
  imageUrl: "/images/sts2/monsters/cultist.webp",
  color: "#fff",
  type: "monster",
  monsterData: {
    type: "Normal",
    minHp: 40,
    maxHp: 50,
    imageUrl: "/images/sts2/monsters/cultist.webp",
    bossImageUrl: null,
    bestiaryMoves: [{ id: "ATTACK", name: "공격" }],
    spineAsset: spine,
  } as EntityInfo["monsterData"],
});

assert.equal(compactMonster.monsterData?.spineAsset?.idleAnimation, "idle_loop");
assert.deepEqual(compactMonster.monsterData?.spineAsset?.moveEffects, {});

console.log("this-or-that-compact.spec.ts: ok");
