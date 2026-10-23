/**
 * STS2 카드 스타일 SSOT.
 *
 * 모든 값은 게임 추출본에서 직접 가져옴:
 *  - StsColors:        src/Core/Helpers/StsColors.cs
 *  - 카드 풀 outline:  src/Core/Models/CardPools/<Pool>.cs::EnergyOutlineColor
 *  - 인챈트 규칙:      src/Core/Models/Enchantments/*.cs::CanEnchant{,CardType}
 *  - 배너/프레임 HSV:  materials/cards/{banners,frames}/*.tres
 *  - 폰트/레이아웃:    scenes/cards/card.tscn
 *  - 카드 사이즈:      scenes/cards/Holders/*.tscn (offset 300×422 = 게임 canonical)
 */

// =============================================================================
// 게임 텍스트 컬러 (StsColors.cs)
// =============================================================================

export const TEXT_CREAM = "#FFF6E2";
export const TEXT_GREEN = "#7FFF00";
export const TEXT_GOLD = "#EFC851";
export const TEXT_PURPLE = "#EE82EE";
export const TEXT_RED = "#FF5555";
export const TEXT_BLUE = "#87CEEB";
export const TEXT_AQUA = "#2AEBBE";

// =============================================================================
// 카드 이름(TitleLabel) 외곽선 — 희귀도별
// 강화 시: 희귀도 무관하게 cardTitleOutlineSpecial(녹색)로 덮어씀
// =============================================================================

export const TITLE_OUTLINE_COLOR: Record<string, string> = {
  기본: "#4D4B40",       // cardTitleOutlineCommon
  일반: "#4D4B40",
  고급: "#005C75",       // cardTitleOutlineUncommon
  희귀: "#6B4B00",       // cardTitleOutlineRare
  "고대의 존재": "#4D4B40",
  토큰: "#4D4B40",
  저주: "#550B9E",
  상태이상: "#4F522F",
  퀘스트: "#7E3E15",
  이벤트: "#1B6131",
};

export const TITLE_UPGRADED_OUTLINE = "#1B6131";

// =============================================================================
// 에너지/별 코스트 외곽선 — 캐릭터 풀별
// =============================================================================

export const ENERGY_OUTLINE_COLOR: Record<string, string> = {
  ironclad: "#802020",
  silent: "#1A6625",
  defect: "#1D5673",
  necrobinder: "#803367",
  regent: "#803D0E",
  quest: "#431E14",
  colorless: "#5C5440",
  curse: "#5C5440",
  event: "#5C5440",
  status: "#5C5440",
  token: "#5C5440",
};

export const STAR_OUTLINE_COLOR = "#175561";

// 인챈트 라벨 outline (card.tscn → Enchantment/Label.font_outline_color)
export const ENCHANT_AMOUNT_OUTLINE = "#0A0F1C";

// =============================================================================
// HSV 셰이더 파라미터
// =============================================================================

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export const CHAR_FRAME_HSV: Record<string, HSV> = {
  ironclad: { h: 0.025, s: 0.85, v: 1.0 },
  silent: { h: 0.32, s: 0.45, v: 1.2 },
  defect: { h: 0.55, s: 0.9, v: 1.0 },
  necrobinder: { h: 0.965, s: 0.55, v: 1.2 },
  regent: { h: 0.12, s: 1.5, v: 1.2 },
  colorless: { h: 1.0, s: 0.0, v: 1.2 },
  curse: { h: 0.85, s: 0.05, v: 0.55 },
  quest: { h: 1.0, s: 1.0, v: 1.0 },
  event: { h: 1.0, s: 0.0, v: 1.0 },
  status: { h: 1.0, s: 0.0, v: 1.2 },
  token: { h: 1.0, s: 0.0, v: 1.2 },
};

export const RARITY_BANNER_HSV: Record<string, HSV> = {
  기본: { h: 1.0, s: 0.0, v: 0.85 },
  일반: { h: 1.0, s: 0.0, v: 0.85 },
  고급: { h: 1.0, s: 1.0, v: 1.0 },
  희귀: { h: 0.563, s: 1.198, v: 1.14 },
  "고대의 존재": { h: 0.0, s: 0.2, v: 0.9 },
  이벤트: { h: 0.875, s: 0.85, v: 0.9 },
  토큰: { h: 1.0, s: 0.0, v: 0.85 },
  저주: { h: 0.27, s: 1.1, v: 0.9 },
  상태이상: { h: 0.634, s: 0.35, v: 0.8 },
  퀘스트: { h: 0.515, s: 1.727, v: 0.9 },
};

export const ANCIENT_BANNER_HSV: HSV = { h: 0.0, s: 0.2, v: 0.9 };

export function hsvToFilter(hsv: HSV): string {
  const hueDeg = ((hsv.h * 360) % 360) - 360;
  return `hue-rotate(${Math.round(hueDeg)}deg) saturate(${hsv.s}) brightness(${hsv.v})`;
}

// =============================================================================
// 카드 사이즈 프리셋 (게임 holder 기준)
// holder 표준: 300×422 (offset_left=-150, top=-211, right=150, bottom=211)
// hover preview: 0.75x = 225×316
// 0.5x mini: 150×211
// =============================================================================

export const CARD_ASPECT_W = 300;
export const CARD_ASPECT_H = 422;
export const CARD_ASPECT = `${CARD_ASPECT_W}/${CARD_ASPECT_H}`;

/**
 * Extra paint box around the 300×422 holder so the energy orb, star cost,
 * and rarity banner are not clipped by `overflow: hidden` ancestors.
 * Values are game pixels at holder size.
 */
export const CARD_OVERFLOW = {
  left: 36,
  top: 16,
  right: 27,
  bottom: 0,
} as const;

export const CARD_WIDTH_PRESET = {
  detail: 380,
  hover: 280,
  grid: 200,
  mini: 150,
} as const;

// =============================================================================
// 게임 폰트 비율 — 카드 holder width(300px) 기준 cqi
// scenes/cards/card.tscn theme_override_font_sizes/font_size 값 / 300 * 100
// =============================================================================

/** DescriptionLabel: MegaRichTextLabel MaxFontSize 21, MinFontSize 12. */
export const DESCRIPTION_FONT_PX = { max: 21, min: 12 };

/**
 * fitCardDescriptionText options that mirror MegaRichTextLabel: the whole
 * label height, whole-px steps, no smaller than MinFontSize.
 */
export const DESCRIPTION_FIT = {
  availableHeightRatio: 1,
  scaleStep: 1 / DESCRIPTION_FONT_PX.max,
  minimumFontScale: DESCRIPTION_FONT_PX.min / DESCRIPTION_FONT_PX.max,
} as const;

export const FONT_CQI = {
  title: 26 / 300 * 100,        // 8.67
  description: 21 / 300 * 100,  // 7.00
  cost: 32 / 300 * 100,         // 10.67
  type: 16 / 300 * 100,         // 5.33
  star: 22 / 300 * 100,         // 7.33
  enchantAmount: 18 / 300 * 100, // 6.0 (Enchantment Label, font_size 미지정 → ~18 추정)
};

// =============================================================================
// 깔끔한 외곽선 (-webkit-text-stroke + paint-order)
// 게임 Godot의 outline_size를 width 비율로 환산.
// width: 카드 px 폭. game outline_size = 12 (title) / 16 (cost) / 8 (enchant amount)
// → 각각 width의 4%, 5.3%, 2.7%
// =============================================================================

export interface StrokeStyle {
  WebkitTextStroke: string;
  paintOrder: string;
  filter: string;
}

/** Label font_shadow_color alpha / shadow_offset from card.tscn. */
export interface GameShadow {
  alpha: number;
  offset: number;
}

/** TitleLabel, EnergyLabel, StarLabel: Color(0, 0, 0, 0.188235), offset (2, 2). */
export const LABEL_SHADOW: GameShadow = { alpha: 0.188235, offset: 2 };
/** Enchantment/Label: Color(0, 0, 0, 0.25098), offset (1, 1). */
export const ENCHANT_LABEL_SHADOW: GameShadow = { alpha: 0.25098, offset: 1 };
/** DescriptionLabel: Color(0, 0, 0, 0.25098), offset (2, 2), no outline. */
export const DESCRIPTION_SHADOW: GameShadow = { alpha: 0.25098, offset: 2 };

/**
 * 카드 폭(px) 기준 stroke 두께를 자동 계산.
 * Godot는 FT_Stroker 반지름을 outline_size / 4로 잡는다. CSS stroke는 글리프 중심에서
 * 양쪽으로 그려지고 paint-order로 fill 아래에 깔리므로 width = outline_size / 2면
 * 바깥으로 outline_size / 4가 보인다.
 * 그림자는 shadow_outline_size = outline_size라 외곽선까지 포함한 모양이므로
 * text-shadow(fill만) 대신 drop-shadow로 그린다.
 */
export function gameStroke(
  outlineColor: string,
  cardWidthPx: number,
  outlineSizeGamePx: number = 12, // 게임 기본
  shadow: GameShadow = LABEL_SHADOW,
): StrokeStyle {
  const strokePx = Math.max(
    1,
    Math.round((outlineSizeGamePx / 300) * cardWidthPx * 0.5),
  );
  const offsetPx = (shadow.offset / 300) * cardWidthPx;
  return {
    WebkitTextStroke: `${strokePx}px ${outlineColor}`,
    paintOrder: "stroke fill",
    filter: `drop-shadow(${offsetPx}px ${offsetPx}px 0 rgba(0,0,0,${shadow.alpha}))`,
  };
}
