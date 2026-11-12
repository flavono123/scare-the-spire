import assert from "node:assert/strict";
import { renderCardDescription } from "../src/lib/codex-card-description";
import { getCodexCards } from "../src/lib/codex-data";
import type { CodexCard } from "../src/lib/codex-types";

const damageAt = (card: CodexCard, upgradeLevel: number) =>
  Number(renderCardDescription(card, { upgradeLevel }).match(/\d+/)?.[0]);

async function main() {
  // DingyDagger.cs: 7 damage, each upgrade adds 3 + level; title/art change at 3 and 6.
  const cards = await getCodexCards({ gameLocale: "eng" });
  const dagger = cards.find((card) => card.id === "DINGY_DAGGER");
  assert(dagger, "DINGY_DAGGER exists");
  assert.equal(dagger.name, "Dingy Dagger");
  assert.deepEqual(
    dagger.specialUpgrade?.titles?.map((title) => title.name),
    ["Dingy Dagger", "Fine Dagger", "Pristine Dagger"],
  );
  assert.deepEqual([0, 1, 2, 3, 6].map((level) => damageAt(dagger, level)), [7, 11, 16, 22, 46]);

  const wither = cards.find((card) => card.id === "WITHER");
  assert(wither, "WITHER exists");
  assert.deepEqual([0, 1, 2].map((level) => damageAt(wither, level)), [3, 6, 9]);

  const kor = await getCodexCards({ gameLocale: "kor" });
  assert.equal(kor.find((card) => card.id === "DINGY_DAGGER")?.name, "초라한 단검");
  const jpn = await getCodexCards({ gameLocale: "jpn" });
  assert.notEqual(jpn.find((card) => card.id === "DINGY_DAGGER")?.name, "Dingy Dagger");
  console.log("staged-card-upgrade.selfcheck: ok");
}

void main();
