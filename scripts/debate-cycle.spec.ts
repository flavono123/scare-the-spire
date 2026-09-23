import assert from "node:assert/strict";
import { debateSubjectFromRow, debateSubjectHref } from "../src/lib/debate-cycle";

assert.equal(debateSubjectHref("card", "STRIKE_IRONCLAD"), "/compendium/cards/strike_ironclad");
assert.equal(debateSubjectHref("keyword", "VULNERABLE"), null);

const subject = debateSubjectFromRow({
  id: "11111111-1111-1111-1111-111111111111",
  resource_type: "card",
  resource_id: "STRIKE_IRONCLAD",
  name_ko: "타격",
  name_en: "Strike",
  image_url: "/images/sts2/cards/strike.webp",
  href: "/compendium/cards/strike_ironclad",
  game_version: "0.111.0",
  opened_at: "2026-09-23T00:00:00.000Z",
});
assert.equal(subject?.nameKo, "타격");
assert.equal(debateSubjectFromRow({
  id: "11111111-1111-1111-1111-111111111111",
  resource_type: "keyword",
  resource_id: "VULNERABLE",
  name_ko: "취약",
  name_en: "Vulnerable",
  href: "/compendium/keywords/vulnerable",
  game_version: "0.111.0",
  opened_at: "2026-09-23T00:00:00.000Z",
}), null);

console.log("debate cycle ok");
