import assert from "node:assert/strict";
import { getActiveRunBadgeCatalog } from "../src/lib/run-badge-catalog";

async function main() {
  const [korean, thai] = await Promise.all([
    getActiveRunBadgeCatalog("kor"),
    getActiveRunBadgeCatalog("tha"),
  ]);

  assert.equal(korean.length, 23);
  assert.equal(korean.find((badge) => badge.id === "CCCCOMBO")?.title, "코오오옴보");
  assert.equal(thai.find((badge) => badge.id === "CCCCOMBO")?.title, "ค-ค-ค-คอมโบ");
  assert.equal(thai.find((badge) => badge.id === "TEAM_PLAYER")?.title, "Team Player");
  assert.equal(korean.filter((badge) => badge.multiplayerOnly).length, 4);
}

void main();
