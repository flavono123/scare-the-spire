import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STS1_CARD_ASPECT,
  STS1_CARD_IN_ATLAS,
  STS1_CARD_STAGE,
  STS1_CN_DESC_BOX_WIDTH,
  STS1_DESC_BOX_WIDTH,
  STS1_DESC_MIN_FONT_SCALE,
  STS1_DESC_FONT,
  STS1_DESC_WELL_BOTTOM,
  STS1_DESC_WELL_TOP,
  STS1_ENERGY_TEXT_OFFSET,
  STS1_GREEN_TEXT,
  STS1_TITLE_BORDER,
  STS1_TITLE_BORDER_WIDTH,
  STS1_TITLE_FONT,
  STS1_TITLE_OFFSET_Y,
  STS1_TYPE_FONT,
  STS1_TYPE_OFFSET_Y,
  sts1CardBodyStyle,
  sts1DescBoxWidthFrac,
  sts1DescriptionBox,
  sts1DescriptionContentHeightPx,
  sts1DescriptionTextStyle,
  sts1DescriptionWellHeightPx,
  sts1EnergyCostBox,
  sts1EnergyCostTextStyle,
  STS1_CREAM,
  STS1_ENERGY_FONT,
  sts1PortraitBox,
  sts1TitleBox,
  sts1TitleBoxWidthFrac,
  sts1TitleFontScale,
  sts1TitleTextStyle,
  sts1TypeBox,
} from "../src/lib/sts1/card-style";
import { GAME_LOCALES } from "../src/lib/i18n";
import { EMPTY_STS1_STATS, wrapSts1DescriptionLines } from "../src/lib/sts1/description";
import { collectSts1CardSideTips, sts1KeywordTipBody } from "../src/lib/sts1/keyword-tips";
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
assert.equal(STS1_ENERGY_FONT, 38);
assert.equal(STS1_CREAM, "#FFF6E2");
assert.match(String(sts1EnergyCostTextStyle().fontSize), /^12\.6/);
assert.match(String(sts1EnergyCostTextStyle().WebkitTextStroke), /#4D4D4D/);
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

const attackPortrait = sts1PortraitBox({ type: "attack" } as never);
assert.equal(attackPortrait.left, `${((136 - 106) / 300) * 100}%`);
assert.equal(attackPortrait.top, `${((108 - 46) / 420) * 100}%`);
assert.equal(attackPortrait.width, `${(240 / 300) * 100}%`);
assert.equal(attackPortrait.height, `${(162 / 420) * 100}%`);
const attackPortraitBottom =
  parseFloat(attackPortrait.top) + parseFloat(attackPortrait.height);
assert.ok(attackPortraitBottom < 53.4, "attack art must stop at the type plaque");
const skillPortrait = sts1PortraitBox({ type: "skill" } as never);
const skillPortraitBottom =
  parseFloat(skillPortrait.top) + parseFloat(skillPortrait.height);
assert.ok(skillPortraitBottom < 53.7);
const powerPortrait = sts1PortraitBox({ type: "power" } as never);
assert.equal(powerPortrait.top, `${((61 - 46) / 420) * 100}%`);
const powerPortraitBottom =
  parseFloat(powerPortrait.top) + parseFloat(powerPortrait.height);
assert.ok(powerPortraitBottom < 53.4);
assert.deepEqual(sts1PortraitBox({ type: "curse" } as never), skillPortrait);
assert.deepEqual(sts1PortraitBox({ type: "status" } as never), skillPortrait);

assert.equal(STS1_DESC_FONT, 24);
assert.equal(STS1_DESC_BOX_WIDTH, 0.79);
assert.equal(STS1_CN_DESC_BOX_WIDTH, 0.72);
assert.equal(sts1DescBoxWidthFrac("kor"), 0.79);
assert.equal(sts1DescBoxWidthFrac("eng"), 0.79);
assert.equal(sts1DescBoxWidthFrac("jpn"), 0.72);
assert.equal(sts1DescBoxWidthFrac("zhs"), 0.72);
assert.equal(sts1DescBoxWidthFrac("esp"), 0.79);
assert.equal(STS1_DESC_WELL_TOP, 0.62);
assert.equal(STS1_DESC_WELL_BOTTOM, 0.925);
const korWell = sts1DescriptionBox("kor");
assert.equal(korWell.left, `${((1 - 0.79) / 2) * 100}%`);
assert.equal(korWell.width, "79%");
assert.equal(korWell.top, "62%");
assert.ok(!("height" in korWell));
assert.ok("bottom" in korWell);
assert.ok(parseFloat(korWell.top) > 57, "well must sit below the type plaque");
assert.ok(100 - parseFloat(String(korWell.bottom)) >= 92, "well must stay above the bottom bevel");
assert.equal(sts1DescriptionBox("jpn").width, "72%");
assert.equal(sts1DescriptionTextStyle("kor").fontSize, "8cqi");
assert.equal(sts1DescriptionTextStyle("kor").wordBreak, "keep-all");
assert.equal(sts1DescriptionTextStyle("jpn").wordBreak, "break-all");
assert.equal(sts1DescriptionTextStyle("tha").overflowWrap, "anywhere");

assert.equal(sts1TitleTextStyle(false).color, STS1_CREAM);
assert.equal(sts1TitleTextStyle(true).color, STS1_GREEN_TEXT);
assert.equal(STS1_TITLE_BORDER_WIDTH, 4);
assert.match(String(sts1TitleTextStyle(false).WebkitTextStroke), new RegExp(STS1_TITLE_BORDER));
assert.match(String(sts1TitleTextStyle(true).textShadow), /rgba\(0,0,0/);

const clashLines = wrapSts1DescriptionLines(
  "손에 있는 카드가 전부 공격 카드일 때만 사용할 수 있습니다. NL 피해를 !D! 줍니다.",
  { ...EMPTY_STS1_STATS, damage: 14 },
  "kor",
);
assert.equal(clashLines.length, 4);
assert.equal(clashLines[0], "손에 있는 카드가 전부");
assert.equal(clashLines[1], "공격 카드일 때만");
assert.equal(clashLines[2], "사용할 수 있습니다.");
assert.equal(clashLines[3], "피해를 GOLD:14 줍니다.");
const clashFullHeight = sts1DescriptionContentHeightPx(clashLines.length, 1);
const wellHeight = sts1DescriptionWellHeightPx();
assert.ok(clashFullHeight > wellHeight, "Clash at 24px overflows the well and must scale");
assert.ok(
  sts1DescriptionContentHeightPx(clashLines.length, STS1_DESC_MIN_FONT_SCALE) <= wellHeight,
  "Clash must fit after STS2 adaptive minimum scale",
);
const bashLines = wrapSts1DescriptionLines(
  "피해를 !D! 줍니다. NL 취약을 !M! 부여합니다.",
  { ...EMPTY_STS1_STATS, damage: 8, magic: 2 },
  "kor",
);
assert.equal(bashLines.length, 2);

const bashTips = collectSts1CardSideTips(
  "피해를 8 줍니다. NL 취약을 2 부여합니다.",
  [{
    id: "VULNERABLE",
    names: ["취약", "취약을"],
    description: "공격을 받을 시 #b50% 의 피해를 추가로 받습니다.",
  }],
);
assert.equal(bashTips.length, 1);
assert.equal(bashTips[0]?.kind, "keyword");
if (bashTips[0]?.kind === "keyword") {
  assert.equal(bashTips[0].id, "VULNERABLE");
  assert.equal(bashTips[0].variant, "debuff");
  assert.equal(bashTips[0].title, "취약");
}
assert.equal(
  sts1KeywordTipBody("공격을 받을 시 #b50% 의 피해를 추가로 받습니다."),
  "공격을 받을 시 [blue]50%[/blue] 의 피해를 추가로 받습니다.",
);
assert.equal(collectSts1CardSideTips("손에 있는 카드가 전부 공격 카드일 때만", [{
  id: "VULNERABLE",
  names: ["취약", "취약을"],
  description: "",
}]).length, 0);
assert.equal(collectSts1CardSideTips("방어도를 4 얻습니다. 영구적으로 이 카드의 방어도를 2 증가시킵니다.", [{
  id: "THORNS",
  names: ["가시", "가시를", "가시가"],
  description: "",
}]).length, 0);

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

type RawCard = {
  id: string;
  slug: string;
  damage: number | null;
  block: number | null;
  magic: number | null;
  cost: number;
};
type CardLoc = { name: string; description: string; upgradeDescription: string };
type KeywordLoc = { NAMES?: string[]; DESCRIPTION?: string };

const rawCards = JSON.parse(
  readFileSync(join(process.cwd(), "data/sts1/cards.json"), "utf8"),
) as RawCard[];
const korCards = JSON.parse(
  readFileSync(join(process.cwd(), "data/sts1/localization/kor/cards.json"), "utf8"),
) as Record<string, CardLoc>;
const korKeywordsRaw = JSON.parse(
  readFileSync(join(process.cwd(), "data/sts1/localization/kor/keywords.json"), "utf8"),
) as { "Game Dictionary": Record<string, KeywordLoc | string[]> };
const korKeywords = Object.entries(korKeywordsRaw["Game Dictionary"])
  .filter((entry): entry is [string, { NAMES: string[]; DESCRIPTION?: string }] => (
    entry[0] !== "TODO"
    && !Array.isArray(entry[1])
    && Array.isArray(entry[1]?.NAMES)
    && (entry[1]?.NAMES.length ?? 0) > 0
  ))
  .map(([id, entry]) => ({
    id,
    names: entry.NAMES,
    description: entry.DESCRIPTION ?? "",
  }));

const ranked = rawCards.map((card) => {
  const loc = korCards[card.id];
  const description = loc?.description ?? "";
  const lines = wrapSts1DescriptionLines(description, {
    ...EMPTY_STS1_STATS,
    cost: card.cost,
    damage: card.damage,
    block: card.block,
    magic: card.magic,
  }, "kor");
  const nlCount = (description.match(/\bNL\b/g) ?? []).length;
  return {
    id: card.id,
    slug: card.slug,
    name: loc?.name ?? card.id,
    lines: lines.length,
    nlCount,
    chars: description.replace(/\s*NL\s*/g, "").length,
    fitsAtFull: sts1DescriptionContentHeightPx(lines.length, 1) <= wellHeight,
    fitsAtMin: sts1DescriptionContentHeightPx(lines.length, STS1_DESC_MIN_FONT_SCALE) <= wellHeight,
  };
});

const longestByChars = [...ranked].sort((a, b) => b.chars - a.chars).slice(0, 8);
const mostNewlines = [...ranked].sort((a, b) => b.nlCount - a.nlCount || b.lines - a.lines).slice(0, 8);
const mostWrapped = [...ranked].sort((a, b) => b.lines - a.lines).slice(0, 8);
assert.ok(mostWrapped.every((row) => row.fitsAtMin), "longest wrapped cards must fit at min scale");
assert.equal(ranked.find((row) => row.slug === "clash")?.lines, 4);

const keywordHits = korKeywords.map((keyword) => {
  const cards: string[] = [];
  for (const card of rawCards) {
    const loc = korCards[card.id];
    if (!loc) continue;
    const haystack = `${loc.description}\n${loc.upgradeDescription}`;
    const tips = collectSts1CardSideTips(haystack, [keyword]);
    if (tips.length > 0) cards.push(card.slug);
  }
  return { id: keyword.id, title: keyword.names[0], count: cards.length, sample: cards[0] ?? "" };
});
const inText = keywordHits.filter((row) => row.count > 0);
assert.ok(inText.some((row) => row.id === "VULNERABLE"));
assert.equal(keywordHits.some((row) => row.id === "LOCKED" && row.count === 0), true);

console.log("sts1-card-layout.spec.ts: ok");
console.log("\nLongest Kor descriptions (chars):");
for (const row of longestByChars) {
  console.log(`  ${row.slug}\t${row.name}\tchars=${row.chars}\tNL=${row.nlCount}\twrap=${row.lines}\tfull=${row.fitsAtFull}\tmin=${row.fitsAtMin}`);
}
console.log("\nMost explicit NL:");
for (const row of mostNewlines) {
  console.log(`  ${row.slug}\t${row.name}\tNL=${row.nlCount}\twrap=${row.lines}`);
}
console.log("\nMost wrapped lines:");
for (const row of mostWrapped) {
  console.log(`  ${row.slug}\t${row.name}\twrap=${row.lines}\tfull=${row.fitsAtFull}\tmin=${row.fitsAtMin}`);
}
console.log("\nKeyword tips in Kor card text:");
for (const row of keywordHits) {
  console.log(`  ${row.id}\t${row.title}\tcards=${row.count}\tsample=${row.sample || "—"}`);
}
