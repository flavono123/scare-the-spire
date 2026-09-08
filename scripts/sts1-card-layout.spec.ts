import assert from "node:assert/strict";
import {
  STS1_ATLAS_LAYER_STYLE,
  STS1_CARD_IN_ATLAS,
  STS1_ENERGY_TEXT_OFFSET,
  sts1EnergyCostBox,
} from "../src/lib/sts1/card-style";
import { STS1_IMAGE_CACHE_BUSTER } from "../src/lib/sts1/image-cache";
import { sts1CardUi512Url, sts1PotionImageUrl } from "../src/lib/sts1/paths";

assert.equal(STS1_CARD_IN_ATLAS.left, 106);
assert.equal(STS1_CARD_IN_ATLAS.top, 46);
assert.equal(STS1_CARD_IN_ATLAS.width, 300);
assert.equal(STS1_CARD_IN_ATLAS.height, 420);
assert.equal(STS1_ATLAS_LAYER_STYLE.left, `${(-106 / 300) * 100}%`);
assert.equal(STS1_ATLAS_LAYER_STYLE.top, `${(-46 / 420) * 100}%`);
assert.equal(STS1_ENERGY_TEXT_OFFSET.x, -132);
assert.equal(STS1_ENERGY_TEXT_OFFSET.y, 192);
assert.deepEqual(sts1EnergyCostBox(), {
  left: `${((150 - 132 - 36) / 300) * 100}%`,
  top: `${((210 - 192 - 35.5) / 420) * 100}%`,
  width: `${(72 / 300) * 100}%`,
  height: `${(71 / 420) * 100}%`,
});
assert.equal(sts1CardUi512Url("bg_attack_red"), `/images/sts1/card-ui-512/bg_attack_red.webp?v=${STS1_IMAGE_CACHE_BUSTER}`);
assert.equal(
  sts1PotionImageUrl({ slug: "bloodpotion" } as never),
  `/images/sts1/potions/bloodpotion.webp?v=${STS1_IMAGE_CACHE_BUSTER}`,
);

console.log("sts1-card-layout.spec.ts: ok");
