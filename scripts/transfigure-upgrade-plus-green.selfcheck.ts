import assert from "node:assert/strict";
import {
  markUpgradePlusGreen,
  tokenizeTransfigureDescription,
} from "../src/lib/transfigure-upgrade-diff";

assert.deepEqual(
  tokenizeTransfigureDescription("피해를 [energy:2] 줍니다."),
  ["피해를", " ", "[energy:2]", " ", "줍니다", "."],
);
assert.deepEqual(
  tokenizeTransfigureDescription("[gold]소멸[/gold]. 카드 1장"),
  ["[gold]소멸[/gold]", ".", " ", "카드", " ", "1", "장"],
);

// Numeric plus → green only on the new number
assert.equal(
  markUpgradePlusGreen("피해를 3 줍니다.", "피해를 5 줍니다."),
  "피해를 [green]5[/green] 줍니다.",
);

// Delete-only (진끈형): no green
assert.equal(
  markUpgradePlusGreen(
    "무작위 카드 1장을 소멸시킵니다.",
    "카드 1장을 소멸시킵니다.",
  ),
  "카드 1장을 소멸시킵니다.",
);

// Added clause → green on the insert
assert.equal(
  markUpgradePlusGreen("피해를 줍니다.", "피해를 줍니다. 방어도를 얻습니다."),
  "피해를 줍니다.[green] 방어도를 얻습니다.[/green]",
);

// Gold / energy stay atomic and unwrapped when equal
assert.equal(
  markUpgradePlusGreen(
    "[gold]소멸[/gold]. [energy:1] 얻습니다.",
    "[gold]소멸[/gold]. [energy:1] 얻습니다.",
  ),
  "[gold]소멸[/gold]. [energy:1] 얻습니다.",
);

// Inserted energy icon is not green-wrapped (CardTile must still parse it)
assert.equal(
  markUpgradePlusGreen("에너지를 얻습니다.", "에너지를 [energy:1] 얻습니다."),
  "에너지를 [energy:1] 얻습니다.",
);

// Gold keyword text change with number plus still greens the number
assert.equal(
  markUpgradePlusGreen(
    "[gold]취약[/gold]을 1 부여합니다.",
    "[gold]취약[/gold]을 2 부여합니다.",
  ),
  "[gold]취약[/gold]을 [green]2[/green] 부여합니다.",
);

console.log("transfigure-upgrade-plus-green.selfcheck: ok");
