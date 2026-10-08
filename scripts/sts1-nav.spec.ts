import assert from "node:assert/strict";
import { sts1NavDropdownItems, sts1NavItems } from "../src/lib/site-nav-items";

const korean = sts1NavDropdownItems("kor");
assert.equal(korean[1]?.href, "/cards");
assert.equal(korean[0]?.label, "캐릭터");
assert.equal(korean[1]?.label, "카드 모음집");
assert.equal(korean[2]?.label, "유물 모음집");
assert.equal(korean[3]?.label, "포션 연구실");
assert.equal(korean[4]?.label, "파워");
assert.deepEqual(
  korean.map((item) => item.icon),
  [
    "/images/sts1/characters/ironclad.webp",
    "/images/sts2/nav/stats_cards.png",
    "/images/sts2/relics/snecko_eye.webp",
    "/images/sts2/nav/stats_potions.png",
    "/images/sts1/powers/strength.webp",
  ],
);

const english = sts1NavDropdownItems("eng");
assert.equal(english[1]?.label, "Card Library");
assert.equal(english[2]?.label, "Relic Collection");
assert.equal(english[3]?.label, "Potion Lab");

const latam = sts1NavDropdownItems("esp");
assert.equal(latam[1]?.label, "Biblioteca de Cartas");

assert.deepEqual(
  sts1NavItems.map((item) => item.href),
  ["/compendium/sts1/characters", "/cards", "/relics", "/potions", "/compendium/sts1/powers"],
);

console.log("sts1-nav.spec.ts: ok");
