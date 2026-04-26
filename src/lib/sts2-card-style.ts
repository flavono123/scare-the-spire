/**
 * STS2 카드 스타일 SSOT.
 *
 * 모든 값은 게임 추출본에서 직접 가져옴:
 *  - StsColors:        src/Core/Helpers/StsColors.cs
 *  - 카드 풀 outline:  src/Core/Models/CardPools/<Pool>.cs::EnergyOutlineColor
 *  - 배너/프레임 HSV:  materials/cards/{banners,frames}/*.tres
 *  - 폰트/레이아웃:    scenes/cards/card.tscn
 */

// =============================================================================
// 게임 텍스트 컬러 (StsColors.cs)
// =============================================================================

export const TEXT_CREAM = "#FFF6E2";
export const TEXT_GREEN = "#7FFF00";
export const TEXT_GOLD = "#EFC851";
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
  저주: "#550B9E",       // cardTitleOutlineCurse
  상태이상: "#4F522F",    // cardTitleOutlineStatus
  퀘스트: "#7E3E15",     // cardTitleOutlineQuest
  이벤트: "#1B6131",     // cardTitleOutlineSpecial
};

export const TITLE_UPGRADED_OUTLINE = "#1B6131"; // cardTitleOutlineSpecial

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
  // CardPoolModel 기본값 (#5C5440) — 위에 없는 모든 풀
  colorless: "#5C5440",
  curse: "#5C5440",
  event: "#5C5440",
  status: "#5C5440",
  token: "#5C5440",
};

export const STAR_OUTLINE_COLOR = "#175561"; // defaultStarCostOutline

// =============================================================================
// HSV 셰이더 파라미터
// hsv.gdshader는 (h, s, v) 트리플로 RGB→HSV 변환 후 hue를 h만큼 회전,
// saturation을 s 곱, value를 v 곱.
// CSS 근사: hue-rotate((h*360 - 360)deg) saturate(s) brightness(v)
// =============================================================================

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export const CHAR_FRAME_HSV: Record<string, HSV> = {
  ironclad: { h: 0.025, s: 0.85, v: 1.0 },     // red_mat
  silent: { h: 0.32, s: 0.45, v: 1.2 },         // green_mat
  defect: { h: 0.55, s: 0.9, v: 1.0 },          // blue_mat
  necrobinder: { h: 0.965, s: 0.55, v: 1.2 },   // pink_mat
  regent: { h: 0.12, s: 1.5, v: 1.2 },          // orange_mat
  colorless: { h: 1.0, s: 0.0, v: 1.2 },        // colorless_mat
  curse: { h: 0.85, s: 0.05, v: 0.55 },         // curse_mat
  quest: { h: 1.0, s: 1.0, v: 1.0 },            // quest_mat (identity)
  event: { h: 1.0, s: 0.0, v: 1.0 },
  status: { h: 0.12, s: 0.3, v: 0.7 },
  token: { h: 1.0, s: 0.0, v: 0.8 },
};

export const RARITY_BANNER_HSV: Record<string, HSV> = {
  기본: { h: 1.0, s: 0.0, v: 0.85 },             // common
  일반: { h: 1.0, s: 0.0, v: 0.85 },             // common (s=0 → grayscale)
  고급: { h: 1.0, s: 1.0, v: 1.0 },              // uncommon (identity, base teal)
  희귀: { h: 0.563, s: 1.198, v: 1.14 },         // rare (yellow-shift)
  "고대의 존재": { h: 0.0, s: 0.2, v: 0.9 },     // ancient
  이벤트: { h: 0.875, s: 0.85, v: 0.9 },          // event
  토큰: { h: 1.0, s: 0.0, v: 0.85 },              // (token uses common)
  저주: { h: 0.27, s: 1.1, v: 0.9 },             // curse
  상태이상: { h: 0.634, s: 0.35, v: 0.8 },        // status
  퀘스트: { h: 0.515, s: 1.727, v: 0.9 },         // quest
};

export const ANCIENT_BANNER_HSV: HSV = { h: 0.0, s: 0.2, v: 0.9 };

export function hsvToFilter(hsv: HSV): string {
  const hueDeg = ((hsv.h * 360) % 360) - 360;
  return `hue-rotate(${Math.round(hueDeg)}deg) saturate(${hsv.s}) brightness(${hsv.v})`;
}

// =============================================================================
// 게임식 텍스트 외곽선 + 드롭 섀도우
// Godot의 font_outline_color + font_shadow_color(offset 2,2) 동시 구현.
// `width`는 cqi/em-비율의 외곽선 두께 (단위 px) — 글자 크기에 비례하므로 작은 카드에선 1px, 큰 카드에선 더 두껍게.
// =============================================================================

export function gameTextShadow(outlineColor: string, width: number = 1): string {
  const w = width;
  // 8-방향 외곽선
  const outlineOffsets: Array<[number, number]> = [
    [-w, -w], [w, -w], [-w, w], [w, w],
    [0, -w], [0, w], [-w, 0], [w, 0],
  ];
  const outline = outlineOffsets
    .map(([x, y]) => `${x}px ${y}px 0 ${outlineColor}`)
    .join(", ");
  // 드롭 섀도우 (오프셋 2,2 — Godot 카드 라벨 기본)
  const drop = `${w * 1.5}px ${w * 1.5}px 0 rgba(0,0,0,0.45)`;
  return `${outline}, ${drop}`;
}
