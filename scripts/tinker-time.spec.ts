import assert from "node:assert/strict";
import {
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

console.log("tinker-time ok");
