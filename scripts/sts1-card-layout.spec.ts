import assert from "node:assert/strict";
import {
  STS1_CARD_ASPECT,
  STS1_CARD_IN_ATLAS,
  STS1_CARD_STAGE,
  STS1_CN_DESC_BOX_WIDTH,
  STS1_DESC_BOX_WIDTH,
  STS1_DESC_FONT,
  STS1_DESC_OFFSET_Y_FRAC,
  STS1_ENERGY_TEXT_OFFSET,
  STS1_TITLE_FONT,
  STS1_TITLE_OFFSET_Y,
  STS1_TYPE_FONT,
  STS1_TYPE_OFFSET_Y,
  sts1CardBodyStyle,
  sts1DescBoxWidthFrac,
  sts1DescriptionBox,
  sts1DescriptionTextStyle,
  sts1EnergyCostBox,
  sts1TitleBox,
  sts1TitleBoxWidthFrac,
  sts1TitleFontScale,
  sts1TypeBox,
} from "../src/lib/sts1/card-style";
import { GAME_LOCALES } from "../src/lib/i18n";
import { sts1HtmlLang, sts1LineBreakViaCharacter, sts1PickerLocales } from "../src/lib/sts1/locale";
import { STS1_IMAGE_CACHE_BUSTER } from "../src/lib/sts1/image-cache";
import { sts1CardUi512Url, sts1PotionImageUrl } from "../src/lib/sts1/paths";

assert.equal(STS1_CARD_IN_ATLAS.left, 106);
assert.equal(STS1_CARD_IN_ATLAS.top, 46);
assert.equal(STS1_CARD_IN_ATLAS.width, 300);
assert.equal(STS1_CARD_IN_ATLAS.height, 420);
assert.equal(STS1_CARD_STAGE.width, 328);
assert.equal(STS1_CARD_STAGE.height, 446);
assert.equal(STS1_CARD_ASPECT, "328 / 446");
assert.deepEqual(sts1CardBodyStyle(), {
  left: `${(20 / 328) * 100}%`,
  top: `${(18 / 446) * 100}%`,
  width: `${(300 / 328) * 100}%`,
  height: `${(420 / 446) * 100}%`,
});
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

assert.equal(STS1_TITLE_OFFSET_Y, 175);
assert.equal(STS1_TITLE_FONT, 27);
assert.equal(sts1TitleBoxWidthFrac(1), 0.6);
assert.equal(sts1TitleBoxWidthFrac(-1), 0.6);
assert.equal(sts1TitleBoxWidthFrac(0), 0.7);
assert.equal(sts1TitleFontScale("타격", 1), 1);
assert.equal(sts1TitleFontScale("Strike", 1), 1);
const title = sts1TitleBox("타격", 1);
assert.equal(title.left, "20%");
assert.equal(title.width, "60%");
assert.equal(title.fontSize, "9cqi");
const titleCenterY = parseFloat(title.top) + parseFloat(title.height) / 2;
assert.ok(Math.abs(titleCenterY - ((210 - 175) / 420) * 100) < 1e-6);

assert.equal(STS1_TYPE_FONT, 17);
assert.equal(STS1_TYPE_OFFSET_Y, 22);
const type = sts1TypeBox();
const typeCenterY = parseFloat(type.top) + parseFloat(type.height) / 2;
assert.ok(Math.abs(typeCenterY - ((210 + 22) / 420) * 100) < 1e-6);
assert.equal(type.fontSize, `${(17 / 300) * 100}cqi`);

assert.equal(STS1_DESC_FONT, 24);
assert.equal(STS1_DESC_OFFSET_Y_FRAC, 0.255);
assert.equal(STS1_DESC_BOX_WIDTH, 0.79);
assert.equal(STS1_CN_DESC_BOX_WIDTH, 0.72);
assert.equal(sts1DescBoxWidthFrac("kor"), 0.79);
assert.equal(sts1DescBoxWidthFrac("eng"), 0.79);
assert.equal(sts1DescBoxWidthFrac("jpn"), 0.72);
assert.equal(sts1DescBoxWidthFrac("zhs"), 0.72);
assert.equal(sts1DescBoxWidthFrac("esp"), 0.79);
assert.deepEqual(sts1DescriptionBox("kor"), {
  left: `${((1 - 0.79) / 2) * 100}%`,
  width: "79%",
  top: "66%",
  bottom: "8%",
});
assert.equal(sts1DescriptionBox("jpn").width, "72%");
assert.equal(sts1DescriptionTextStyle("kor").fontSize, "8cqi");
assert.equal(sts1DescriptionTextStyle("kor").wordBreak, "keep-all");
assert.equal(sts1DescriptionTextStyle("jpn").wordBreak, "break-all");
assert.equal(sts1DescriptionTextStyle("tha").overflowWrap, "anywhere");

for (const locale of GAME_LOCALES) {
  const box = sts1DescriptionBox(locale);
  assert.ok(box.width === "79%" || box.width === "72%", locale);
  assert.equal(typeof sts1HtmlLang(locale), "string");
}
assert.equal(sts1LineBreakViaCharacter("kor"), false);
assert.equal(sts1LineBreakViaCharacter("eng"), false);
assert.equal(sts1LineBreakViaCharacter("jpn"), true);
assert.equal(sts1LineBreakViaCharacter("zhs"), true);
assert.equal(sts1LineBreakViaCharacter("esp"), false);
assert.deepEqual(
  sts1PickerLocales(),
  GAME_LOCALES.filter((locale) => locale !== "esp"),
);
assert.equal(sts1HtmlLang("esp"), "es");
assert.equal(sts1HtmlLang("kor"), "ko");
assert.equal(sts1HtmlLang("zhs"), "zh-Hans");

console.log("sts1-card-layout.spec.ts: ok");
