import assert from "node:assert/strict";
import {
  extractMonsterThresholdAscensionLabels,
  extractNumberedAscensionLabels,
  isNumberedAscensionLabel,
} from "../src/lib/sts2-patch-ascension-refs";

assert.equal(isNumberedAscensionLabel("승천 8"), true);
assert.equal(isNumberedAscensionLabel("A9"), true);
assert.equal(isNumberedAscensionLabel("승천"), false);

assert.deepEqual(
  extractNumberedAscensionLabels("갑각충 (버프): 승천 8 체력이 24-28(25-29) → 24-28(26-30)으로 증가했습니다."),
  [
    { type: "ascension", label: "승천 8" },
    { type: "ascension", label: "Ascension 8" },
    { type: "ascension", label: "A8" },
  ],
);

assert.deepEqual(
  extractNumberedAscensionLabels("HP at A8 increased from 24-28(25-29) -> 24-28(26-30)."),
  [
    { type: "ascension", label: "승천 8" },
    { type: "ascension", label: "Ascension 8" },
    { type: "ascension", label: "A8" },
  ],
);

assert.equal(
  extractNumberedAscensionLabels("낮은 승천 9 -> 8 (높은 승천은 9 유지).").length,
  0,
);

const a8Hp = extractMonsterThresholdAscensionLabels(
  "- [gold:monster]잠행 군체[/gold] 변경:\n  - 체력이 70(75) -> 75(80)으로 증가했습니다.",
);
assert.equal(a8Hp.some((label) => label.label === "승천 8"), true);

const a9Damage = extractMonsterThresholdAscensionLabels(
  "- [gold:monster]암살 습격자[/gold]: 피해량이 11(12) -> 10(11)로 감소했습니다.",
);
assert.equal(a9Damage.some((label) => label.label === "승천 9"), true);

const cardDamage = extractMonsterThresholdAscensionLabels(
  "- [gold:card]벼락[/gold]: 피해량이 6(8) → 8(11)로 증가했습니다.",
);
assert.equal(cardDamage.length, 0);

const a8Range = extractMonsterThresholdAscensionLabels(
  "- [gold:monster]물어뜯는 두루마리[/gold]: 31(32)-38(39) -> 30(33)-37(39).",
);
assert.equal(a8Range.some((label) => label.label === "승천 8"), true);

const healHp = extractMonsterThresholdAscensionLabels(
  "- [gold:monster]폭포 거인[/gold]: 낮은 승천에서 회복하는 체력이 15 -> 10(15)로 감소했습니다.",
);
assert.equal(healHp.some((label) => label.label === "승천 8"), false);

console.log("sts2-patch-ascension-refs.spec.ts: ok");
