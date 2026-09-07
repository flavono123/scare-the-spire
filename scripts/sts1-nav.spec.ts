import assert from "node:assert/strict";
import { sts1NavDropdownItems, sts1NavItems } from "../src/lib/site-nav-items";

const korean = sts1NavDropdownItems("kor");
assert.equal(korean[0]?.href, "/cards");
assert.equal(korean[0]?.label, "카드 모음집");
assert.equal(korean[1]?.label, "유물 모음집");
assert.equal(korean[2]?.label, "포션 연구실");
assert.equal(korean.every((item) => item.icon.startsWith("/images/sts1/")), true);

const english = sts1NavDropdownItems("eng");
assert.equal(english[0]?.label, "Card Library");
assert.equal(english[1]?.label, "Relic Collection");
assert.equal(english[2]?.label, "Potion Lab");

const latam = sts1NavDropdownItems("esp");
assert.equal(latam[0]?.label, "Biblioteca de Cartas");

assert.deepEqual(
  sts1NavItems.map((item) => item.href),
  ["/cards", "/relics", "/potions"],
);

console.log("sts1-nav.spec.ts: ok");
