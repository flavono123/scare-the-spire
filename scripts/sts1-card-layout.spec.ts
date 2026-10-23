import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STS1_CARD_ASPECT,
  STS1_CARD_IN_ATLAS,
  STS1_CARD_STAGE,
  STS1_CN_DESC_BOX_WIDTH,
  STS1_DESC_BOX_WIDTH,
  STS1_DESC_FONT,
  STS1_DESC_LINE_STEP,
  STS1_DESC_OFFSET_Y,
  STS1_ENERGY_TEXT_OFFSET,
  STS1_GREEN_TEXT,
  STS1_TITLE_BORDER_WIDTH,
  STS1_TITLE_FONT,
  STS1_TITLE_OFFSET_Y,
  STS1_TYPE_FONT,
  STS1_TYPE_OFFSET_Y,
  sts1CardBodyStyle,
  sts1DescBoxWidthFrac,
  sts1DescriptionLineCapCenterY,
  sts1DescriptionOrbCenterY,
  sts1EnergyCostBox,
  sts1EnergyCostTextStyle,
  STS1_CREAM,
  STS1_ENERGY_FONT,
  sts1PortraitBox,
  STS1_PORTRAIT_OFFSET_Y,
  STS1_PORTRAIT_SIZE,
  STS1_TYPE_COLOR,
  STS1_TYPE_PLAQUE_BASE_WIDTH,
  sts1TypeBannerLayers,
  sts1TypePlaqueStretch,
  sts1TitleBox,
  sts1TitleBoxWidthFrac,
  sts1TitleFontScale,
  sts1TitleTextStyle,
  sts1TypeBox,
  sts1CardBackgroundRegion,
  sts1CardOrbRegion,
} from "../src/lib/sts1/card-style";
import { GAME_LOCALES } from "../src/lib/i18n";
import { measureBitmapText, sts1BitmapRole } from "../src/lib/sts1/bitmap-font";
import { EMPTY_STS1_STATS, wrapSts1DescriptionLines } from "../src/lib/sts1/description";
import { sts1CostLabel, sts1ShowsEnergyOrb } from "../src/lib/sts1/stats";
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
assert.equal(STS1_ENERGY_TEXT_OFFSET.x, -132);
assert.equal(STS1_ENERGY_TEXT_OFFSET.y, 192);
assert.deepEqual(sts1EnergyCostBox(), {
  left: `${((150 - 132 - 36) / 300) * 100}%`,
  top: `${((210 - 192 - 35.5) / 420) * 100}%`,
  width: `${(72 / 300) * 100}%`,
  height: `${(71 / 420) * 100}%`,
});
assert.equal(sts1ShowsEnergyOrb(0), true);
assert.equal(sts1ShowsEnergyOrb(1), true);
assert.equal(sts1ShowsEnergyOrb(-1), true);
assert.equal(sts1ShowsEnergyOrb(-2), false);
assert.equal(sts1CostLabel(-2), "");
assert.equal(
  sts1CardBackgroundRegion({ type: "curse", cardColor: "curse" } as never),
  "bg_skill_black",
);
assert.equal(
  sts1CardBackgroundRegion({ type: "status", cardColor: "colorless" } as never),
  "bg_skill_gray",
);
assert.equal(
  sts1CardOrbRegion({ cardColor: "curse" } as never),
  "card_colorless_orb",
);
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
// initializeTitle compares the real GlyphLayout width with TITLE_BOX_WIDTH (180 / 210).
const korTitleRole = sts1BitmapRole("kor", "title")!;
assert.equal(sts1TitleFontScale(measureBitmapText(korTitleRole, "타격").width, 1), 1);
assert.equal(sts1TitleFontScale(181, 1), 0.85);
assert.equal(sts1TitleFontScale(181, 0), 1);
assert.equal(sts1TitleFontScale(211, 0), 0.85);
const title = sts1TitleBox(60, 1, korTitleRole.capHeight);
assert.equal(title.left, "20%");
assert.equal(title.width, "60%");
assert.equal(title.fontSize, "9cqi");
// The box ends at the baseline, cap height centered on y = 210 - 175.
const titleBottom = ((parseFloat(title.top) + parseFloat(title.height)) / 100) * 420;
assert.ok(Math.abs(titleBottom - (35 + korTitleRole.capHeight / 2)) < 1e-6);

assert.equal(STS1_TYPE_FONT, 17);
assert.equal(STS1_TYPE_OFFSET_Y, 22);
const type = sts1TypeBox(11);
const typeBottom = ((parseFloat(type.top) + parseFloat(type.height)) / 100) * 420;
assert.ok(Math.abs(typeBottom - (232 + 11 / 2)) < 1e-6);
assert.equal(type.fontSize, `${(17 / 300) * 100}cqi`);

// renderPortrait: 250×190 at 1:1, centered 72 above card center, never fit to the frame hole.
assert.equal(STS1_PORTRAIT_SIZE.width, 250);
assert.equal(STS1_PORTRAIT_SIZE.height, 190);
assert.equal(STS1_PORTRAIT_OFFSET_Y, 72);
const untrimmedPortrait = sts1PortraitBox({ type: "power" } as never);
assert.deepEqual(untrimmedPortrait, {
  left: `${(25 / 300) * 100}%`,
  top: `${(43 / 420) * 100}%`,
  width: `${(250 / 300) * 100}%`,
  height: `${(190 / 420) * 100}%`,
});
assert.deepEqual(sts1PortraitBox({ type: "attack" } as never), untrimmedPortrait);
// Trimmed atlas regions drift because renderPortrait ignores the region offset.
const strikePortrait = sts1PortraitBox({ portraitShift: [0.5, 2] } as never);
assert.equal(strikePortrait.left, `${(25.5 / 300) * 100}%`);
assert.equal(strikePortrait.top, `${(45 / 420) * 100}%`);
const betaCard = { portraitShift: [1, 4], betaPortraitShift: [0, 2], hasBetaArt: true } as never;
assert.equal(sts1PortraitBox(betaCard).top, `${(47 / 420) * 100}%`);
assert.equal(sts1PortraitBox(betaCard, true).top, `${(45 / 420) * 100}%`);
const realCards = JSON.parse(
  readFileSync(join(process.cwd(), "data", "sts1", "cards.json"), "utf8"),
) as { slug: string; portraitShift?: [number, number] }[];
assert.deepEqual(realCards.find((card) => card.slug === "defend-r")?.portraitShift, [1, 4]);

// renderDynamicFrame: short labels keep the frame's own plaque; long ones stretch it.
assert.equal(STS1_TYPE_COLOR, "#595959");
assert.equal(STS1_TYPE_PLAQUE_BASE_WIDTH, 48);
assert.equal(sts1TypePlaqueStretch(31), null, "공격 fits the frame plaque");
assert.equal(sts1TypePlaqueStretch(50.4), null, "stretch 1.1 still returns early");
assert.deepEqual(sts1TypePlaqueStretch(64), { scaleX: (64 / 48 - 1) * 2 + 1, offset: 8 });
assert.deepEqual(sts1TypeBannerLayers({ rarity: "rare" } as never, 31), []);
const korTypeRole = sts1BitmapRole("kor", "type")!;
for (const label of ["공격", "스킬", "파워", "저주"]) {
  assert.deepEqual(
    sts1TypeBannerLayers({ rarity: "common" } as never, measureBitmapText(korTypeRole, label).width),
    [],
    `${label} must not draw the stretch pieces`,
  );
}
const statusLayers = sts1TypeBannerLayers(
  { rarity: "uncommon" } as never,
  measureBitmapText(korTypeRole, "상태이상").width,
);
assert.deepEqual(statusLayers.map((layer) => layer.region), ["uncommon_center", "uncommon_left", "uncommon_right"]);
assert.match(statusLayers[0].transform, /^scaleX\(1\.[4-9]/);
assert.match(statusLayers[1].transform, /^translateX\(-/);
assert.equal(statusLayers[2].transform, statusLayers[1].transform.replace("-", ""));

assert.equal(STS1_DESC_FONT, 24);
assert.equal(STS1_DESC_BOX_WIDTH, 0.79);
assert.equal(STS1_CN_DESC_BOX_WIDTH, 0.72);
assert.equal(sts1DescBoxWidthFrac("kor"), 0.79);
assert.equal(sts1DescBoxWidthFrac("eng"), 0.79);
assert.equal(sts1DescBoxWidthFrac("jpn"), 0.72);
assert.equal(sts1DescBoxWidthFrac("zhs"), 0.72);
assert.equal(sts1DescBoxWidthFrac("esp"), 0.79);
// renderDescription: DESC_OFFSET_Y = 420 * 0.255, line step 1.45 * capHeight (not 1.45em).
assert.ok(Math.abs(STS1_DESC_OFFSET_Y - 107.1) < 1e-9);
assert.equal(STS1_DESC_LINE_STEP, 1.45);
// Latin capHeight 17, 2 lines: draw_y = -210 + 107.1 + 2*17*0.775 - 17*0.375 from center.
const latinCap = sts1BitmapRole("eng", "desc")!.capHeight;
assert.equal(latinCap, 17);
assert.ok(Math.abs(sts1DescriptionLineCapCenterY(0, 2, 17) - (210 - (-210 + 107.1 + 26.35 - 6.375 - 6))) < 1e-9);
assert.ok(Math.abs(sts1DescriptionLineCapCenterY(1, 2, 17) - sts1DescriptionLineCapCenterY(0, 2, 17) - 1.45 * 17) < 1e-9);
// renderSmallEnergy: 24×24 orb bottom at -100 + ((n - 4) / 2 - i + 1) * 1.45 * cap.
assert.ok(Math.abs(sts1DescriptionOrbCenterY(0, 2, 17) - (210 - (-100 + 0 * 1.45 * 17 + 12))) < 1e-9);

assert.equal(STS1_TITLE_BORDER_WIDTH, 2);
assert.equal(sts1TitleTextStyle(false).color, STS1_CREAM);
assert.equal(sts1TitleTextStyle(true).color, STS1_GREEN_TEXT);
assert.equal(sts1TitleTextStyle(false).WebkitTextStroke, undefined);
assert.equal(sts1EnergyCostTextStyle().WebkitTextStroke, undefined);
assert.ok(sts1BitmapRole("kor", "title")?.glyphs["타"]);
assert.ok(sts1BitmapRole("kor", "desc")?.glyphs["손"]);
assert.equal(sts1BitmapRole("eng", "energy")?.glyphs["3"]?.xadv, sts1BitmapRole("kor", "energy")?.glyphs["3"]?.xadv);

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
// The game does not shrink card text; Clash's 4 lines sit below the type plaque.
const korDescCap = sts1BitmapRole("kor", "desc")!.capHeight;
assert.ok(sts1DescriptionLineCapCenterY(0, clashLines.length, korDescCap) - korDescCap / 2 > 232 + 11);
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
  assert.ok([0.79, 0.72].includes(sts1DescBoxWidthFrac(locale)), locale);
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
    // Top of the first line's caps; under ~233 it reaches into the art, as in game.
    textTop: Math.round(sts1DescriptionLineCapCenterY(0, lines.length, korDescCap) - korDescCap / 2),
  };
});

const longestByChars = [...ranked].sort((a, b) => b.chars - a.chars).slice(0, 8);
const mostNewlines = [...ranked].sort((a, b) => b.nlCount - a.nlCount || b.lines - a.lines).slice(0, 8);
const mostWrapped = [...ranked].sort((a, b) => b.lines - a.lines).slice(0, 8);
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
  console.log(`  ${row.slug}\t${row.name}\tchars=${row.chars}\tNL=${row.nlCount}\twrap=${row.lines}\ttextTop=${row.textTop}`);
}
console.log("\nMost explicit NL:");
for (const row of mostNewlines) {
  console.log(`  ${row.slug}\t${row.name}\tNL=${row.nlCount}\twrap=${row.lines}`);
}
console.log("\nMost wrapped lines:");
for (const row of mostWrapped) {
  console.log(`  ${row.slug}\t${row.name}\twrap=${row.lines}\ttextTop=${row.textTop}`);
}
console.log("\nKeyword tips in Kor card text:");
for (const row of keywordHits) {
  console.log(`  ${row.id}\t${row.title}\tcards=${row.count}\tsample=${row.sample || "—"}`);
}
