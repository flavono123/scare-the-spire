import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import { buildEntityLookupMap, findEntityByRef } from "../src/lib/all-entities";
import type { CodexCard } from "../src/lib/codex-types";
import { comboFilterKey, comboPostMatchesAnyGameElement } from "../src/lib/combo-types";
import {
  getMadScienceVariantCardId,
  getMadScienceVariantFromId,
  getMadScienceVariantFromText,
  getMadScienceVariantHref,
  MAD_SCIENCE_DEFAULT_VARIANT,
  parseMadScienceVariantParam,
} from "../src/lib/tinker-time";

// Patch lines pick the variant from the Tinker Time option they name.
assert.deepEqual(
  getMadScienceVariantFromText("폭력 선택지로 만들어진 [gold:card]괴짜 과학[/gold]의 3회 타격"),
  { cardType: "ATTACK", riderId: "VIOLENCE" },
);
assert.deepEqual(
  getMadScienceVariantFromText("Fixed Vigor ... when it was created with the Violence option."),
  { cardType: "ATTACK", riderId: "VIOLENCE" },
);
assert.deepEqual(
  getMadScienceVariantFromText("[gold]괴짜 과학[/gold] 스킬 혼돈 옵션이 이제"),
  { cardType: "SKILL", riderId: "CHAOS" },
);
// "개선했습니다" is not the Improvement option.
assert.deepEqual(getMadScienceVariantFromText("괴짜 과학 성능을 개선했습니다"), MAD_SCIENCE_DEFAULT_VARIANT);

// Old per-type ids and the variant param resolve to a full variant.
assert.deepEqual(getMadScienceVariantFromId("mad_science_attack"), { cardType: "ATTACK", riderId: "VIOLENCE" });
assert.deepEqual(getMadScienceVariantFromId("CARD.MAD_SCIENCE_POWER_CURIOUS"), { cardType: "POWER", riderId: "CURIOUS" });
assert.equal(getMadScienceVariantFromId("DUALCAST"), null);
assert.deepEqual(parseMadScienceVariantParam("skill_wisdom"), { cardType: "SKILL", riderId: "WISDOM" });
assert.equal(parseMadScienceVariantParam("attack_wisdom"), null); // Wisdom is a Skill option.
assert.deepEqual(parseMadScienceVariantParam("power"), { cardType: "POWER", riderId: "EXPERTISE" });
assert.equal(parseMadScienceVariantParam("nonsense"), null);
assert.equal(parseMadScienceVariantParam(""), null);

assert.equal(getMadScienceVariantHref("/compendium/cards/mad_science", MAD_SCIENCE_DEFAULT_VARIANT), "/compendium/cards/mad_science");
assert.equal(
  getMadScienceVariantHref("/compendium/cards?card=mad_science", { cardType: "ATTACK", riderId: "SAPPING" }),
  "/compendium/cards?card=mad_science&variant=attack_sapping",
);

// Toybox posts store a variant as its card id; the default keeps the plain id.
assert.equal(getMadScienceVariantCardId(MAD_SCIENCE_DEFAULT_VARIANT), "MAD_SCIENCE");
assert.equal(getMadScienceVariantCardId({ cardType: "ATTACK", riderId: "VIOLENCE" }), "MAD_SCIENCE_ATTACK_VIOLENCE");

const madScienceCard = {
  id: "MAD_SCIENCE",
  name: "괴짜 과학",
  nameEn: "Mad Science",
  description: "",
  descriptionRaw: "",
  madScienceBaseDescriptionRaw: "",
  vars: {},
  imageUrl: null,
} as unknown as CodexCard;
const base: EntityInfo = {
  id: "MAD_SCIENCE", nameKo: "괴짜 과학", nameEn: "Mad Science", imageUrl: null, color: "colorless", type: "card",
  cardData: madScienceCard,
};
const map = buildEntityLookupMap([base]);
const attack = map.get("card:MAD_SCIENCE_ATTACK_VIOLENCE");
assert.equal(attack?.id, "MAD_SCIENCE_ATTACK_VIOLENCE");
assert.equal(attack?.nameKo, "괴짜 과학");
assert.equal(attack?.cardData?.name, "괴짜 과학");
assert.equal(attack?.cardData?.type, "공격");
assert.equal(map.get("card:MAD_SCIENCE_POWER")?.cardData?.type, "파워"); // old per-type posts
assert.equal(map.get("card:MAD_SCIENCE_ATTACK_VIOLENCE"), attack); // stable for React memo
assert.equal(map.get("card:DUALCAST"), undefined);
assert.equal([...map.values()].length, 1); // name matching still sees one card
assert.equal(findEntityByRef([base], "card", "MAD_SCIENCE_SKILL_WISDOM")?.cardData?.type, "스킬");

assert.equal(comboFilterKey({ type: "card", id: "MAD_SCIENCE_ATTACK_VIOLENCE" }), "card:MAD_SCIENCE");
assert.ok(comboPostMatchesAnyGameElement(
  { resources: [{ type: "card", id: "MAD_SCIENCE_POWER_CURIOUS" }] },
  [{ type: "card", id: "MAD_SCIENCE" }],
));

console.log("tinker-time ok");
