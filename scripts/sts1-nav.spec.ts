import assert from "node:assert/strict";
import { sts1NavDropdownItems, sts1NavItems } from "../src/lib/site-nav-items";

const korean = sts1NavDropdownItems("kor");
assert.equal(korean[1]?.href, "/cards");
assert.equal(korean[0]?.label, "캐릭터");
assert.equal(korean[1]?.label, "카드 모음집");
assert.equal(korean[2]?.label, "유물 모음집");
assert.equal(korean[3]?.label, "포션 연구실");
assert.equal(korean[4]?.label, "파워");
assert.equal(korean[5]?.label, "몬스터 도감");
assert.deepEqual(
  korean.slice(6).map((item) => item.label),
  ["이벤트", "키워드", "승천", "모드", "역병", "니오우", "도전 과제", "점수"],
);
assert.deepEqual(
  korean.map((item) => item.icon),
  [
    "/images/sts1/characters/ironclad.webp",
    "/images/sts2/nav/stats_cards.png",
    "/images/sts2/relics/snecko_eye.webp",
    "/images/sts2/nav/stats_potions.png",
    "/images/sts1/powers/hello.webp",
    "/images/sts1/nav/run-history-elite.webp",
    "/images/sts1/nav/run-history-event.webp",
    "/images/sts1/orbs/lightning.webp",
    "/images/sts1/ui/ascension.webp",
    "/images/sts1/run-mods/specialized.webp",
    "/images/sts1/blights/spear.webp",
    "/images/sts1/npcs/neow.webp",
    "/images/sts1/achievements/eternal_one.webp",
    "/images/sts1/ui/score.webp",
  ],
);

const english = sts1NavDropdownItems("eng");
assert.equal(english[1]?.label, "Card Library");
assert.equal(english[2]?.label, "Relic Collection");
assert.equal(english[3]?.label, "Potion Lab");
assert.deepEqual(
  english.slice(6).map((item) => item.label),
  ["Event", "Keywords", "Ascension", "Modifiers", "Blights", "Neow", "Achievements", "Score"],
);

const latam = sts1NavDropdownItems("esp");
assert.equal(latam[1]?.label, "Biblioteca de Cartas");

assert.deepEqual(
  sts1NavItems.map((item) => item.href),
  [
    "/compendium/sts1/characters",
    "/cards",
    "/relics",
    "/potions",
    "/compendium/sts1/powers",
    "/compendium/sts1/monsters",
    "/compendium/sts1/events",
    "/compendium/sts1/keywords",
    "/compendium/sts1/ascensions",
    "/compendium/sts1/modifiers",
    "/compendium/sts1/blights",
    "/compendium/sts1/neow",
    "/compendium/sts1/achievements",
    "/compendium/sts1/score-bonuses",
  ],
);

console.log("sts1-nav.spec.ts: ok");
