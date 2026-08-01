import assert from "node:assert/strict";
import type { CodexPower } from "../src/lib/codex-types";
import {
  getPowerCompendiumDescription,
  getPowerDetailDescription,
} from "../src/components/codex/power-preview";

function power(overrides: Partial<CodexPower>): CodexPower {
  return {
    id: "TEST",
    name: "테스트",
    nameEn: "Test",
    description: "고정 설명",
    descriptionEn: "Static description",
    descriptionRaw: null,
    descriptionRawEn: null,
    vars: {},
    type: "Buff",
    stackType: "Counter",
    allowNegative: false,
    imageUrl: null,
    betaImageUrl: null,
    ...overrides,
  };
}

const ravenous = power({
  id: "RAVENOUS",
  description: "[gold]힘[/gold]을 [blue]1[/blue] 얻습니다.",
  descriptionRaw: "[gold]힘[/gold]을 [blue]{Amount}[/blue] 얻습니다.",
});
assert.equal(getPowerDetailDescription(ravenous), "[gold]힘[/gold]을 [blue]X[/blue] 얻습니다.");
assert.equal(getPowerCompendiumDescription(ravenous), ravenous.description);

assert.equal(
  getPowerDetailDescription(power({
    id: "DANSE_MACABRE",
    descriptionRaw: "비용이 {Energy:energyIcons()} 이상이면 [gold]방어도[/gold]를 [blue]{Amount}[/blue] 얻습니다.",
    vars: { Energy: 2 },
  })),
  "비용이 [energy:2] 이상이면 [gold]방어도[/gold]를 [blue]X[/blue] 얻습니다.",
);

assert.equal(
  getPowerDetailDescription(power({
    id: "SHRINK",
    descriptionRaw: "{Amount:cond:==1?다음 턴에 |>1?다음 [blue]{}[/blue]턴 동안 |}피해가 감소합니다.",
  })),
  "다음 [blue]X[/blue]턴 동안 피해가 감소합니다.",
);

const shriek = power({
  id: "SHRIEK",
  description: "체력이 [blue]50%[/blue] 이하로 떨어지면 [gold]기절[/gold]합니다.",
  descriptionRaw: "체력이 [blue]{Amount}[/blue] 이하로 떨어지면 [gold]기절[/gold]합니다.",
});
assert.equal(getPowerDetailDescription(shriek), shriek.description);

console.log("Power detail descriptions use contextless X values.");
