"use client";

import {
  Fragment,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  CSSProperties,
  type ComponentProps,
  type ReactNode,
} from "react";
import StaticImage from "@/components/ui/static-image";
import { cacheBustSts2ImageUrl } from "@/lib/sts2-image-cache";
import type { ServiceLocale } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { CodexCard } from "@/lib/codex-types";
import {
  getCardMaxUpgradeLevel,
  hasCardUpgrade,
  parseDescription,
  renderCardDescription,
  type EnchantVarMod,
} from "./codex-description";
import {
  TITLE_OUTLINE_COLOR,
  ENERGY_OUTLINE_COLOR,
  DESCRIPTION_FIT,
  DESCRIPTION_SHADOW,
  ENCHANT_LABEL_SHADOW,
  STAR_OUTLINE_COLOR,
  ENCHANT_AMOUNT_OUTLINE,
  TITLE_UPGRADED_OUTLINE,
  TEXT_CREAM,
  TEXT_GREEN,
  TEXT_GOLD,
  CHAR_FRAME_HSV,
  RARITY_BANNER_HSV,
  ANCIENT_BANNER_HSV,
  hsvToFilter,
  gameStroke,
  CARD_ASPECT,
  CARD_ASPECT_H,
  CARD_ASPECT_W,
  CARD_OVERFLOW,
  CARD_WIDTH_PRESET,
  FONT_CQI,
} from "@/lib/sts2-card-style";
import { CardEngagementStatsOverlay } from "./engagement-stats";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import { getMadScienceRenderedCardName } from "@/lib/tinker-time";
import {
  getCardDisplayKeywords,
  getCardKeywordDisplayText,
  splitCardDisplayKeywords,
} from "@/lib/sts2-card-keywords";
import { fitCardDescriptionText } from "@/lib/card-description-fit";

type StaticImageProps = ComponentProps<typeof StaticImage>;

function Image({ loading, priority, ...props }: StaticImageProps) {
  return (
    <StaticImage
      {...props}
      priority={priority}
      loading={priority ? (loading ?? "eager") : (loading ?? "lazy")}
    />
  );
}

// =============================================================================
// Game-extracted asset paths
// =============================================================================

const FRAME_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-frames/card_frame_attack.png",
  스킬: "/images/game-assets/card-frames/card_frame_skill.png",
  파워: "/images/game-assets/card-frames/card_frame_power.png",
  저주: "/images/game-assets/card-frames/card_frame_skill.png",
  상태이상: "/images/game-assets/card-frames/card_frame_skill.png",
  퀘스트: "/images/game-assets/card-frames/card_frame_quest.png",
};

/**
 * CardModel.AncientTextBg: compressed_atlas ancient_text_bg_<type> regions.
 * Each sits inside a 693×533 texture through its atlas margin.
 */
const ANCIENT_TEXT_BG: Record<string, { src: string; region: { width: number; height: number }; margin: AtlasMargin }> = {
  공격: {
    src: "/images/game-assets/card-misc/ancient_card_text_bg_attack.png",
    region: { width: 676, height: 499 },
    margin: { x: 10, y: 10, width: 17, height: 34 },
  },
  스킬: {
    src: "/images/game-assets/card-misc/ancient_card_text_bg_skill.png",
    region: { width: 674, height: 427 },
    margin: { x: 8, y: 106, width: 19, height: 106 },
  },
  파워: {
    src: "/images/game-assets/card-misc/ancient_card_text_bg_power.png",
    region: { width: 677, height: 507 },
    margin: { x: 8, y: 0, width: 16, height: 26 },
  },
};

const ANCIENT_PORTRAIT_MASK = "/images/game-assets/card-misc/ancient_portrait_mask_large.png";
// Baked by scripts/extract-ancient-card-overlay.py from the scene's shader and blend modes.
const ANCIENT_GLASS_SHADE = "/images/game-assets/card-misc/ancient_glass_shade.png";
const ANCIENT_GLASS_LIGHT = "/images/game-assets/card-misc/ancient_glass_light.png";
const ANCIENT_BORDER_ADD = "/images/game-assets/card-misc/ancient_card_border_add.png";
const ANCIENT_BANNER = "/images/game-assets/card-misc/ancient_banner.png";

const ANCIENT_FLAME_SHEET = "/images/game-assets/card-misc/ancient_card_flame_sheet.png";
const INFECTION_CARD_ID = "INFECTION";
const INFECTION_OVERLAY_BASE = "/images/sts2/card-overlays/infection/base.webp";
const INFECTION_OVERLAY_ANIMATED = "/images/sts2/card-overlays/infection/overlay.webp";
const AFFLICTION_OVERLAY_BASE = "/images/sts2/affliction-overlays";
const AFFLICTION_OVERLAY_IDS = new Set([
  "BOUND",
  "ENTANGLED",
  "GALVANIZED",
  "HEXED",
  "RINGING",
  "SMOG",
  "TAINTED",
]);

const AFFLICTION_FRAME_COLORS: Record<string, { vignette?: string; glow: string }> = {
  BOUND: {
    vignette: "rgba(38, 153, 80, 0.1254902)",
    glow: "rgba(140, 255, 77, 1)",
  },
  ENTANGLED: {
    vignette: "rgba(51, 18, 0, 0.3764706)",
    glow: "rgba(216, 122, 91, 1)",
  },
  GALVANIZED: {
    vignette: "rgba(0, 162, 255, 0.2509804)",
    glow: "rgba(128, 223, 255, 1)",
  },
  HEXED: {
    vignette: "rgba(14, 0, 26, 0.5019608)",
    glow: "rgba(165, 121, 219, 1)",
  },
  RINGING: {
    glow: "rgba(174, 252, 255, 1)",
  },
  SMOG: {
    vignette: "rgba(14, 0, 26, 0.2509804)",
    glow: "rgba(202, 122, 202, 1)",
  },
  TAINTED: {
    vignette: "rgba(51, 0, 64, 0.6)",
    glow: "rgba(178, 51, 217, 1)",
  },
};

const ENTANGLED_LEAVES = [
  { x: -102, y: -218, rotation: -0.5255747, scale: 0.5397214 },
  { x: -82, y: -207, rotation: 1.3220456, scale: 0.40900528 },
  { x: 105, y: -205, rotation: -1.0907083, scale: 0.419221 },
  { x: 148, y: -140, rotation: 0.62127, scale: 0.5397214 },
  { x: 148, y: -33, rotation: -0.592255, scale: 0.5397214 },
  { x: 145, y: 81, rotation: -1.1490887, scale: 0.39509588 },
  { x: 146, y: 145, rotation: -0.0710828, scale: 0.5397214 },
  { x: 109, y: 203, rotation: -0.87968427, scale: 0.44095248 },
  { x: -145, y: 110, rotation: 0.50267345, scale: 0.6153229 },
  { x: -153, y: 27, rotation: -1.2563549, scale: 0.6800933 },
  { x: -158, y: -17, rotation: 0.49224094, scale: 0.5397214 },
];

/**
 * Only Ancient portraits get a canvas-group mask; the others rely on the
 * border covering the 250×190 art. These cuts follow each border's bottom band
 * 5px above its outer edge, where the opaque band hides them, so rounding at
 * grid sizes cannot leave art under the V (attack) or round (power) bottom.
 */
const PORTRAIT_CLIP_PATHS: Record<string, string> = {
  공격: "polygon(0% 0%, 100% 0%, 100% 82.3%, 61.2% 100%, 38.8% 100%, 0% 82.3%)",
  파워: "polygon(0% 0%, 100% 0%, 100% 80.9%, 97.6% 86.5%, 94% 91.5%, 90% 95.3%, 85.2% 98.6%, 80.4% 100%, 19.6% 100%, 14.8% 98.6%, 10% 95.3%, 6% 91.5%, 2.4% 86.5%, 0% 80.9%)",
};

const TYPE_PLAQUE_SRC = "/images/game-assets/card-misc/card_portrait_border_plaque.png";

const PORTRAIT_BORDER_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-portraits/card_portrait_border_attack.png",
  스킬: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  파워: "/images/game-assets/card-portraits/card_portrait_border_power.png",
  저주: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  상태이상: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  퀘스트: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
};

function InfectionCardOverlay() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-[3] pointer-events-none overflow-visible"
    >
      <Image
        src={INFECTION_OVERLAY_BASE}
        alt=""
        className="absolute max-w-none object-fill"
        style={{
          left: "2.33%",
          top: "1.18%",
          width: "93.67%",
          height: "93.84%",
        }}
      />
      <Image
        src={INFECTION_OVERLAY_ANIMATED}
        alt=""
        className="absolute max-w-none object-fill"
        style={{
          left: "-5.67%",
          top: "-5.92%",
          width: "111.05%",
          height: "108.29%",
        }}
      />
    </div>
  );
}

function AfflictionImageLayer({
  src,
  className,
  style,
  imageClassName = "object-fill",
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  imageClassName?: string;
}) {
  return (
    <span aria-hidden="true" className={`absolute ${className ?? ""}`} style={style}>
      <Image src={src} alt="" fill className={imageClassName} />
    </span>
  );
}

function AfflictionFrameBackdrop({ id }: { id: string }) {
  const colors = AFFLICTION_FRAME_COLORS[id] ?? AFFLICTION_FRAME_COLORS.BOUND;
  return (
    <>
      {id === "BOUND" && (
        <AfflictionImageLayer
          src={`${AFFLICTION_OVERLAY_BASE}/bound/bound_border_shader.webp`}
          className="sts2-affliction-overlay__border"
          style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
        />
      )}
      {colors.vignette && (
        <span
          aria-hidden="true"
          className="sts2-affliction-overlay__vignette"
          style={{ backgroundColor: colors.vignette }}
        />
      )}
    </>
  );
}

function AfflictionFrameGlow({ id }: { id: string }) {
  const colors = AFFLICTION_FRAME_COLORS[id] ?? AFFLICTION_FRAME_COLORS.BOUND;
  return (
    <>
      <span
        aria-hidden="true"
        className="sts2-affliction-overlay__glow"
        style={{ backgroundColor: colors.glow }}
      />
    </>
  );
}

function EntangledLeaves() {
  return (
    <>
      {ENTANGLED_LEAVES.map((leaf, index) => {
        const centerX = 150 + leaf.x;
        const centerY = 211 + leaf.y;
        return (
          <AfflictionImageLayer
            key={`${leaf.x}:${leaf.y}:${index}`}
            src={`${AFFLICTION_OVERLAY_BASE}/entangled/entangled_leaf_shader.webp`}
            className="sts2-affliction-overlay__entangled-leaf"
            style={{
              left: `${((centerX - 64) / 300) * 100}%`,
              top: `${((centerY - 64) / 422) * 100}%`,
              width: `${(128 / 300) * 100}%`,
              height: `${(128 / 422) * 100}%`,
              transform: `rotate(${leaf.rotation}rad) scale(${leaf.scale * 0.48})`,
            }}
          />
        );
      })}
    </>
  );
}

function GalvanizedCorner({
  style,
}: {
  style?: CSSProperties;
}) {
  return (
    <AfflictionImageLayer
      src={`${AFFLICTION_OVERLAY_BASE}/galvanized/galvanized_lightning_corner_shader.webp`}
      className="sts2-affliction-overlay__galvanized-corner"
      style={style}
    />
  );
}

function AfflictionCardOverlay({ afflictionId }: { afflictionId: string | null | undefined }) {
  const id = afflictionId?.toUpperCase();
  if (!id || !AFFLICTION_OVERLAY_IDS.has(id)) return null;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-[3] pointer-events-none overflow-visible sts2-affliction-overlay sts2-affliction-overlay--${id.toLowerCase()}`}
    >
      <div className="absolute inset-0 overflow-hidden sts2-affliction-overlay__mask">
        <AfflictionFrameBackdrop id={id} />

        {id === "GALVANIZED" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/galvanized/galvanized_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--galvanized"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "HEXED" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/hexed/hexed_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--hexed"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "RINGING" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/ringing/ringing_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--ringing"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "SMOG" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/smog/smog_main_shader.webp`}
            className="sts2-affliction-overlay__smog-field"
            style={{ inset: 0 }}
          />
        )}

        {id === "SMOG" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/smog/smog_outer_shader.webp`}
            className="sts2-affliction-overlay__smog-field sts2-affliction-overlay__smog-field--outer"
            style={{ left: "-20.33%", top: "-3.55%", width: "140.67%", height: "133.3%" }}
          />
        )}

        <AfflictionFrameGlow id={id} />
      </div>

      {id === "BOUND" && (
        <AfflictionImageLayer
          src={`${AFFLICTION_OVERLAY_BASE}/bound/bound_main_shader.webp`}
          className="sts2-affliction-overlay__main sts2-affliction-overlay__main--bound"
          style={{
            left: "-34.33%",
            top: "-9.95%",
            width: "140.67%",
            height: "100%",
            transform: "scale(1.2)",
          }}
        />
      )}

      {id === "ENTANGLED" && (
        <>
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/entangled/entangled_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--entangled"
            style={{
              left: "-34.33%",
              top: "-9.95%",
              width: "140.67%",
              height: "100%",
              transform: "scale(1.2)",
            }}
          />
          <EntangledLeaves />
        </>
      )}

      {id === "TAINTED" && (
        <AfflictionImageLayer
          src={`${AFFLICTION_OVERLAY_BASE}/tainted/tainted_main_shader.webp`}
          className="sts2-affliction-overlay__main sts2-affliction-overlay__main--tainted"
          style={{
            left: "-34.33%",
            top: "-9.95%",
            width: "140.67%",
            height: "100%",
            transform: "scale(1.2)",
          }}
        />
      )}

      {id === "GALVANIZED" && (
        <>
          <GalvanizedCorner style={{ left: "-6%", top: "-4%", transform: "rotate(0deg)" }} />
          <GalvanizedCorner style={{ right: "-6%", top: "-4%", transform: "rotate(90deg)" }} />
          <GalvanizedCorner style={{ right: "-6%", bottom: "-4%", transform: "rotate(180deg)" }} />
          <GalvanizedCorner style={{ left: "-6%", bottom: "-4%", transform: "rotate(270deg)" }} />
        </>
      )}
    </div>
  );
}

function getCardDisplayImageUrl(
  card: CodexCard,
  upgradeLevel: number,
  showBeta: boolean,
): string | null {
  if (showBeta && card.betaImageUrl) return card.betaImageUrl;
  const upgradeImages = card.specialUpgrade?.imageUrls;
  if (upgradeLevel > 0 && upgradeImages?.length) {
    return upgradeImages[Math.min(upgradeLevel, upgradeImages.length - 1)];
  }
  return card.imageUrl ?? card.betaImageUrl ?? null;
}

// =============================================================================
// Fonts
// =============================================================================

const CARD_FONT = "var(--font-game-text)";
const TITLE_FONT = "var(--font-game-title)";

// =============================================================================
// Layout config (% of 300×422 holder coords)
// Holder: CardContainer origin center, top-left = (-150, -211)
// banner: card.tscn NameBanner offset(-160 ~ 160, -250 ~ -180) → w=320(=107%), h=70/422=16.6%
// EnergyIcon: offset(-166,-227)~(-102,-163) → 64×64
// StarIcon: offset(-186,-189)~(-128,-131) → 58×58, sits below-left of energy
// Enchantment: offset(-166,-116)~(-94,-62) → 72×54, below both orbs (star bottom y=80, enchant top y=95)
// Portrait: offset(-125,-168)~(125,22) → 250×190, drawn unmasked under Frame
// PortraitBorder: offset(-137.5,-164)~(137.5,46) → 275×210
// TypePlaque: NinePatchRect offset(-30.5,1)~(30.5,38), patch margins 13/12;
//   NCard.UpdateTypePlaqueSizeAndPosition widens it to max(label + 17, 61)
// =============================================================================

const HOLDER_W = 300;
const HOLDER_H = 422;

/** card.tscn offsets from the card center → % of the holder. */
function holderBox(left: number, top: number, width: number, height: number) {
  return {
    left: `${((left + HOLDER_W / 2) / HOLDER_W) * 100}%`,
    top: `${((top + HOLDER_H / 2) / HOLDER_H) * 100}%`,
    width: `${(width / HOLDER_W) * 100}%`,
    height: `${(height / HOLDER_H) * 100}%`,
  };
}

/** Game px → cqi of the 300-wide holder. */
function holderCqi(px: number) {
  return `${(px / HOLDER_W) * 100}cqi`;
}

type GameRect = { left: number; top: number; width: number; height: number };
/** Godot AtlasTexture.margin: region offset (x, y) and total extra size. */
type AtlasMargin = { x: number; y: number; width: number; height: number };
const NO_MARGIN: AtlasMargin = { x: 0, y: 0, width: 0, height: 0 };

function rectBox(rect: GameRect) {
  return holderBox(rect.left, rect.top, rect.width, rect.height);
}

/**
 * TextureRect KEEP_ASPECT_CENTERED ("contain") or KEEP_ASPECT_COVERED
 * ("cover") of an AtlasTexture, returning where its region lands. Godot clips
 * a covered texture to the rect, so a cover result must stay inside it.
 */
function fittedRegion(
  rect: GameRect,
  region: { width: number; height: number },
  margin: AtlasMargin,
  mode: "contain" | "cover",
): GameRect {
  const textureWidth = region.width + margin.width;
  const textureHeight = region.height + margin.height;
  const pick = mode === "cover" ? Math.max : Math.min;
  const scale = pick(rect.width / textureWidth, rect.height / textureHeight);
  return {
    left: rect.left + (rect.width - textureWidth * scale) / 2 + margin.x * scale,
    top: rect.top + (rect.height - textureHeight * scale) / 2 + margin.y * scale,
    width: region.width * scale,
    height: region.height * scale,
  };
}

/**
 * canvas_group_mask_blur maps the CanvasGroup rect (content grown by
 * fit_margin) to maskUv = uv * (region + offset) + regionXY - offset, clamped
 * to the region, so the mask region covers the group rect minus `offset`.
 */
function canvasGroupMaskRect(
  content: GameRect,
  region: { width: number; height: number },
  offset: { x: number; y: number },
  fitMargin: number,
): GameRect {
  const left = content.left - fitMargin;
  const top = content.top - fitMargin;
  const width = content.width + fitMargin * 2;
  const height = content.height + fitMargin * 2;
  const spanX = region.width + offset.x;
  const spanY = region.height + offset.y;
  return {
    left: left + (width * offset.x) / spanX,
    top: top + (height * offset.y) / spanY,
    width: (width * region.width) / spanX,
    height: (height * region.height) / spanY,
  };
}

function maskStyle(src: string, size = "100% 100%", position = "0 0"): CSSProperties {
  const image = `url("${cacheBustSts2ImageUrl(src)}")`;
  return {
    maskImage: image,
    maskRepeat: "no-repeat",
    maskSize: size,
    maskPosition: position,
    WebkitMaskImage: image,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: size,
    WebkitMaskPosition: position,
  };
}

// AncientPortrait: offset(-153,-215)~(445,627) at scale 0.5, stretched.
const ANCIENT_PORTRAIT_RECT: GameRect = { left: -153, top: -215, width: 299, height: 421 };

const ANCIENT = {
  portrait: ANCIENT_PORTRAIT_RECT,
  // card_canvas_group_mask_material: mask_region (615,1151,600,847), mask_offset (10,8).
  portraitMask: canvasGroupMaskRect(ANCIENT_PORTRAIT_RECT, { width: 600, height: 847 }, { x: 10, y: 8 }, 1),
  // AncientBorderGlassOverlay: offset(-148.465,-210.71)~(442.08,621.3) at scale 0.5.
  glass: rectBox({ left: -148.46497, top: -210.71002, width: (442.08002 + 148.46497) / 2, height: (621.3 + 210.71002) / 2 }),
  // AncientBorder: offset(-154,-223)~(152,217), keep aspect centered, 821×1148.
  border: rectBox(fittedRegion({ left: -154, top: -223, width: 306, height: 440 }, { width: 821, height: 1148 }, NO_MARGIN, "contain")),
  // AncientTextBg: offset(-133,-22)~(131,181), keep aspect centered.
  textBgRect: { left: -133, top: -22, width: 264, height: 203 } satisfies GameRect,
  // AncientBanner: offset(-163,-207)~(164,-124), keep aspect covered (no atlas margin).
  banner: holderBox(-163, -207, 327, 83),
  // Fire: AnimatedSprite2D at (164,-10) in the banner, centered, 49×69 frames at scale 0.6.
  fire: holderBox(-163 + 164 - (49 * 0.6) / 2, -207 - 10 - (69 * 0.6) / 2, 49 * 0.6, 69 * 0.6),
};

/** TitleLabel is a MegaLabel: MaxFontSize 26, default MinFontSize 8. */
const TITLE_FONT_PX = { max: 26, min: 8 };
/**
 * Godot line height is the font's ascent + descent (kreon_regular hhea
 * 997 + 293 of 1024; it outranks the CJK fallbacks) plus line_separation -3,
 * which stays in px while the autosize shrinks the font.
 */
const DESCRIPTION_LINE_HEIGHT = `calc(${(997 + 293) / 1024}em - ${holderCqi(3)})`;

const L = {
  art: holderBox(-125, -168, 250, 190),
  portraitBorder: holderBox(-137.5, -164, 275, 210),
  // TitleBanner offset(-163,-207)~(164,-124); card_banner.tres margin Rect2(1, 23, 2, 25).
  banner: rectBox(fittedRegion(
    { left: -163, top: -207, width: 327, height: 83 },
    { width: 653, height: 145 },
    { x: 1, y: 23, width: 2, height: 25 },
    "cover",
  )),
  title: holderBox(-105, -204, 210, 54),
  plaque: { top: ((1 + HOLDER_H / 2) / HOLDER_H) * 100, height: 37, minWidth: 61, labelPadX: 17 },
  // DescriptionLabel offset(-122,37)~(121,173), vertically centered.
  desc: holderBox(-122, 37, 243, 136),
  cost: {
    top: (-16 / HOLDER_H) * 100,
    left: (-16 / HOLDER_W) * 100,
    size: (64 / HOLDER_W) * 100,
  },
  starCost: {
    top: (22 / HOLDER_H) * 100,
    left: (-36 / HOLDER_W) * 100,
    size: (58 / HOLDER_W) * 100,
  },
  enchant: {
    top: (95 / HOLDER_H) * 100,
    left: (-16 / HOLDER_W) * 100,
    width: (72 / HOLDER_W) * 100,
    height: (54 / HOLDER_H) * 100,
  },
};

/** Written straight to the title node so the fit loop needs no React state. */
const TITLE_FONT_VAR = "--card-title-font";

/** MegaLabel.AdjustFontSize: the largest whole font size whose line fits. */
function fitTitleFont(box: HTMLElement, text: HTMLElement) {
  const apply = (px: number) => text.style.setProperty(TITLE_FONT_VAR, holderCqi(px));
  const fits = (px: number) => {
    apply(px);
    return text.scrollWidth <= box.clientWidth + 0.5;
  };
  let size = TITLE_FONT_PX.max;
  if (!fits(size)) {
    let low = TITLE_FONT_PX.min;
    let high = TITLE_FONT_PX.max - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (fits(mid)) low = mid + 1;
      else high = mid - 1;
    }
    size = Math.max(TITLE_FONT_PX.min, high);
  }
  apply(size);
}

/**
 * NinePatchRect TypePlaque. The banner material tints only the plaque; the
 * TypeLabel child keeps its own color.
 */
function TypePlaque({ label, filter }: { label: ReactNode; filter?: string }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-[4] flex items-center justify-center whitespace-nowrap"
      style={{
        top: `${L.plaque.top}%`,
        height: holderCqi(L.plaque.height),
        minWidth: holderCqi(L.plaque.minWidth),
        paddingInline: holderCqi(L.plaque.labelPadX / 2),
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: 0,
          borderImageSource: `url("${cacheBustSts2ImageUrl(TYPE_PLAQUE_SRC)}")`,
          // 123×75 sprite is the 2× of the 61×37 patch (margins 13 / 12).
          borderImageSlice: "0 24 0 26 fill",
          borderImageWidth: `0 ${holderCqi(12)} 0 ${holderCqi(13)}`,
          filter,
        }}
      />
      <span
        className="relative"
        style={{
          fontFamily: CARD_FONT,
          fontSize: `${FONT_CQI.type}cqi`,
          fontWeight: 700,
          color: "rgba(0,0,0,0.75)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export type CardTileSize = keyof typeof CARD_WIDTH_PRESET;

export interface CardDescriptionFit {
  fits: boolean;
  fontScale: number;
}

interface CardTileProps {
  card: CodexCard;
  serviceLocale?: ServiceLocale;
  showUpgrade: boolean;
  upgradeLevel?: number;
  showBeta: boolean;
  /** 고정 픽셀 폭. 게임처럼 반응형 X. 미지정 시 size="grid" 기본. */
  width?: number;
  size?: CardTileSize;
  enchantmentImageUrl?: string | null;
  enchantmentLabel?: string | null;
  enchantmentAmount?: number | null;
  /** 인챈트 적용 후 카드 코스트 (TezcatarasEmber 등). null이면 원래 cost. */
  forcedCost?: number | null;
  /** Override Regent star cost display. null keeps the card value; use with isX via content. */
  forcedStarCost?: number | null;
  /** 인챈트가 추가하는 키워드(영구/선천성/보존/소멸). */
  enchantAddedKeywords?: string[];
  /** 인챈트가 제거하는 키워드(SoulsPower→소멸). */
  enchantRemovedKeywords?: string[];
  /** Replaces all card keywords. An empty array suppresses automatic keyword rendering. */
  keywordOverride?: string[];
  /** 카드 본문 끝에 분홍색으로 추가될 인챈트 효과 텍스트. BBCode OK. */
  descriptionSuffix?: string | null;
  /** 인챈트가 카드 damage/block 에 미치는 효과 — descriptionRaw 재렌더에 사용. */
  enchantStatMod?: EnchantVarMod | null;
  /** Active affliction overlay id. */
  afflictionId?: string | null;
  /**
   * Custom affliction overlay drawn in the affliction slot (card.tscn
   * OverlayContainer: above the frame and portrait border, below the title
   * banner, type plaque and cost). Used for overlays with no extracted texture.
   */
  afflictionOverlay?: ReactNode;
  /** 카드에 박힌 인챈트 슬롯을 클릭했을 때 (해제 등). */
  onEnchantSlotClick?: () => void;
  onClick?: () => void;
  /** Static preview mode: disables pointer cursor and hover scale. */
  interactive?: boolean;
  /** Replaces the rendered title while preserving the game card frame. */
  titleContent?: ReactNode;
  /** Replaces the rendered description while preserving the game card frame and keywords. */
  descriptionContent?: ReactNode;
  /** Replaces the energy-cost text while preserving the game energy orb. */
  costContent?: ReactNode;
  /** Replaces the Regent star-cost text while preserving the star orb. */
  starCostContent?: ReactNode;
  /** Allows text selection and editing inside custom content slots. */
  editableContent?: boolean;
  /** Smallest permitted description font relative to the game default. */
  minimumDescriptionFontScale?: number;
  /** Reports whether the complete description fits, including card keywords. */
  onDescriptionFitChange?: (fit: CardDescriptionFit) => void;
  /** Version and game locale this tile was rendered from. Image copy waits for these. */
  captureSnapshot?: {
    gameLocale: string;
    version: string;
  };
  engagementStats?: {
    commentCount: number;
    likeCount: number;
    loading: boolean;
    unavailable: boolean;
  } | null;
}

export const CardTile = memo(function CardTile({
  card,
  serviceLocale = "ko",
  showUpgrade,
  upgradeLevel,
  showBeta,
  width,
  size = "grid",
  enchantmentImageUrl,
  enchantmentLabel,
  enchantmentAmount,
  forcedCost,
  forcedStarCost,
  enchantAddedKeywords,
  enchantRemovedKeywords,
  keywordOverride,
  descriptionSuffix,
  enchantStatMod,
  afflictionId,
  afflictionOverlay,
  onEnchantSlotClick,
  onClick,
  interactive = true,
  titleContent,
  descriptionContent,
  costContent,
  starCostContent,
  editableContent = false,
  minimumDescriptionFontScale = DESCRIPTION_FIT.minimumFontScale,
  onDescriptionFitChange,
  engagementStats,
  captureSnapshot,
}: CardTileProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [imgError, setImgError] = useState(false);
  const [descriptionFontScale, setDescriptionFontScale] = useState(1);
  const descriptionViewportRef = useRef<HTMLDivElement>(null);
  const descriptionContentRef = useRef<HTMLDivElement>(null);
  const titleBoxRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLSpanElement>(null);

  const cardWidth = width ?? CARD_WIDTH_PRESET[size];

  // === Derived values ===
  const requestedUpgradeLevel = Math.max(
    0,
    Math.floor(upgradeLevel ?? (showUpgrade ? 1 : 0)),
  );
  const effectiveUpgradeLevel = hasCardUpgrade(card) ? requestedUpgradeLevel : 0;
  const imageSrc = getCardDisplayImageUrl(card, effectiveUpgradeLevel, showBeta);
  const isUpgraded = effectiveUpgradeLevel > 0;
  const maxUpgradeLevel = getCardMaxUpgradeLevel(card);
  const renderedCardName = getMadScienceRenderedCardName(card);
  const titleUpgradeSuffix = isUpgraded
    ? maxUpgradeLevel > 1 ? `+${effectiveUpgradeLevel}` : "+"
    : "";

  let costDisplay = "";
  if (forcedCost !== undefined && forcedCost !== null) {
    costDisplay = String(forcedCost);
  } else if (card.isXCost) costDisplay = "X";
  else if (card.cost >= 0) {
    costDisplay = isUpgraded && card.upgrade?.cost !== undefined
      ? String(card.upgrade.cost) : String(card.cost);
  }

  let starCostDisplay = "";
  if (forcedStarCost !== undefined && forcedStarCost !== null) {
    starCostDisplay = String(forcedStarCost);
  } else if (card.isXStarCost) {
    starCostDisplay = "X";
  } else if (card.starCost !== null) {
    const upgradedStar = card.upgrade?.starCost ?? card.upgrade?.StarCost;
    starCostDisplay = isUpgraded && typeof upgradedStar === "number"
      ? String(upgradedStar)
      : String(card.starCost);
  }

  const frameAsset = FRAME_ASSETS[card.type] ?? FRAME_ASSETS["스킬"];
  const portraitBorderAsset = PORTRAIT_BORDER_ASSETS[card.type] ?? PORTRAIT_BORDER_ASSETS["스킬"];
  const visualColor = card.visualColor ?? card.color;
  const charHsv = CHAR_FRAME_HSV[visualColor] ?? CHAR_FRAME_HSV.colorless;
  const frameFilter = hsvToFilter(charHsv);
  const bannerHsv = RARITY_BANNER_HSV[card.rarity] ?? RARITY_BANNER_HSV["일반"];
  const bannerFilter = hsvToFilter(bannerHsv);

  const titleOutline = isUpgraded
    ? TITLE_UPGRADED_OUTLINE
    : (TITLE_OUTLINE_COLOR[card.rarity] ?? TITLE_OUTLINE_COLOR["일반"]);
  const titleColor = isUpgraded ? TEXT_GREEN : TEXT_CREAM;
  const costOutline = ENERGY_OUTLINE_COLOR[visualColor] ?? ENERGY_OUTLINE_COLOR.colorless;
  const energyIcon = resolveSts2EnergyIcon(visualColor);
  const isAncientCard = card.rarity === "고대의 존재";
  const isInfectionCard = card.id === INFECTION_CARD_ID;

  // 게임 outline_size: title=12, cost=16, type=0, enchant amount=8 (card.tscn)
  const titleStroke = gameStroke(titleOutline, cardWidth, 12);
  const costStroke = gameStroke(costOutline, cardWidth, 16);
  const starStroke = gameStroke(STAR_OUTLINE_COLOR, cardWidth, 12);
  const enchantAmountStroke = gameStroke(ENCHANT_AMOUNT_OUTLINE, cardWidth, 8, ENCHANT_LABEL_SHADOW);

  // 강화 + 인챈트 모두 누적 적용 (게임 순서: base → upgrade → enchant).
  // descriptionRaw 가 없으면 통합 함수가 card.description 으로 폴백.
  const hasEnchantStat = Boolean(
    enchantStatMod &&
      (enchantStatMod.damageAdd || enchantStatMod.damageMultiplier || enchantStatMod.blockAdd)
  );
  const descText = isUpgraded || hasEnchantStat
    ? renderCardDescription(card, {
        upgradeLevel: effectiveUpgradeLevel,
        enchantMod: hasEnchantStat ? enchantStatMod : null,
      })
    : card.description;
  const descParts = parseDescription(descText);
  // 인챈트 추가 텍스트 — 분홍 baseline + 안의 모든 색을 분홍 통일.
  const suffixParts = descriptionSuffix
    ? parseDescription(descriptionSuffix)
    : null;

  // 표시할 키워드: 카드 keywords + 강화/인챈트 추가 - 강화/인챈트 제거
  const displayKeywords = keywordOverride ?? getCardDisplayKeywords(card, {
    upgradeLevel: effectiveUpgradeLevel,
    addedKeywords: enchantAddedKeywords,
    removedKeywords: enchantRemovedKeywords,
  });
  const {
    preDescriptionKeywords,
    postDescriptionKeywords,
  } = splitCardDisplayKeywords(displayKeywords);
  const renderKeyword = (kw: string) => {
    // 인챈트/강화 추가 키워드도 게임에선 일반 키워드와 동일한 골드.
    // 사이드 tip은 CardSideTipsAnchor가 담당 — 본문에서는 색만 유지.
    const displayText = getCardKeywordDisplayText(card, kw);
    return (
      <span className="font-bold" style={{ color: TEXT_GOLD }}>
        {displayText}.
      </span>
    );
  };
  // ─── 텍스트 파트 렌더 헬퍼 ───
  // mode="card": 일반 카드 본문 — 색 BBCode 그대로 (gold→골드 hover, blue→블루)
  // mode="suffix": 인챈트 추가 본문 — 모든 색을 분홍(#EE82EE)로 통일
  const renderParts = (parts: ReturnType<typeof parseDescription>, mode: "card" | "suffix") =>
    parts.map((part, i) => {
      // suffix 모드에선 모든 색 BBCode를 분홍으로 통일
      if (mode === "suffix" && (
        part.type === "gold" || part.type === "blue" ||
        part.type === "red" || part.type === "purple" ||
        part.type === "upgrade"
      )) {
        return (
          <span key={i} className="font-bold" style={{ color: "#EE82EE" }}>{part.text}</span>
        );
      }
      return part.type === "gold" ? (
        <span
          key={i}
          className="font-bold"
          style={{ color: TEXT_GOLD }}
        >
          {part.text}
        </span>
      ) : part.type === "upgrade" ? (
        <span key={i} className="font-bold" style={{ color: TEXT_GREEN }}>{part.text}</span>
      ) : part.type === "blue" ? (
        <span key={i} className="font-bold" style={{ color: "#87CEEB" }}>{part.text}</span>
      ) : part.type === "red" ? (
        <span key={i} style={{ color: "#FF5555" }}>{part.text}</span>
      ) : part.type === "purple" ? (
        <span key={i} className="font-bold" style={{ color: "#EE82EE" }}>{part.text}</span>
      ) : part.type === "energy" ? (
        <span key={i} className="inline-flex items-baseline gap-0">
          {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
            <Image
              key={j}
              src={energyIcon}
              alt="energy"
              width={14}
              height={14}
              className="inline-block align-text-bottom mx-[0.1em]"
              style={{ width: "1em", height: "1em" }}
            />
          ))}
        </span>
      ) : part.type === "star" ? (
        <span key={i} className="inline-flex items-baseline gap-0">
          {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
            <Image
              key={j}
              src="/images/game-assets/card-misc/star_icon.png"
              alt="star"
              width={14}
              height={14}
              className="inline-block align-text-bottom mx-[0.1em]"
              style={{ width: "1em", height: "1em" }}
            />
          ))}
        </span>
      ) : part.type === "newline" ? (
        <br key={i} />
      ) : (
        <span key={i}>{part.text}</span>
      );
    });

  const hasCustomDescription = descriptionContent != null;
  const measureDescriptionFit = useCallback(() => {
    const viewport = descriptionViewportRef.current;
    const content = descriptionContentRef.current;
    if (!viewport || !content) return;

    const fit = fitCardDescriptionText({
      viewport,
      content,
      baseFontCqi: FONT_CQI.description,
      ...DESCRIPTION_FIT,
      minimumFontScale: minimumDescriptionFontScale,
    });
    setDescriptionFontScale((current) => (
      Math.abs(current - fit.fontScale) < 0.001 ? current : fit.fontScale
    ));
    onDescriptionFitChange?.(fit);
  }, [
    minimumDescriptionFontScale,
    onDescriptionFitChange,
  ]);

  useLayoutEffect(() => {
    measureDescriptionFit();

    const viewport = descriptionViewportRef.current;
    const content = descriptionContentRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measureDescriptionFit);
    observer.observe(viewport);
    // A late web-font swap resizes the text without touching the viewport.
    if (content) observer.observe(content);
    void document.fonts?.ready.then(measureDescriptionFit);
    return () => observer.disconnect();
  });

  const hasCustomTitle = titleContent != null;
  const titleText = `${renderedCardName}${titleUpgradeSuffix}`;
  useLayoutEffect(() => {
    const box = titleBoxRef.current;
    const text = titleTextRef.current;
    if (!box || !text) return;
    const measure = () => {
      if (hasCustomTitle) text.style.removeProperty(TITLE_FONT_VAR);
      else fitTitleFont(box, text);
    };
    measure();
    // The text node too: a late web-font swap resizes it without touching the box.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(text);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [hasCustomTitle, titleText]);

  const renderTitle = () => (
    <div
      ref={titleBoxRef}
      className="absolute z-[3] flex items-center justify-center"
      style={L.title}
    >
      <span
        ref={titleTextRef}
        className={`shrink-0 text-center ${hasCustomTitle ? "w-full" : "whitespace-nowrap"}`}
        style={{
          fontFamily: TITLE_FONT,
          fontSize: `var(${TITLE_FONT_VAR}, ${holderCqi(TITLE_FONT_PX.max)})`,
          fontWeight: 800,
          color: titleColor,
          ...(titleStroke as CSSProperties),
        }}
      >
        {titleContent ?? titleText}
      </span>
    </div>
  );

  const renderDescription = () => (
    <div
      ref={descriptionContentRef}
      className={`text-center ${
        hasCustomDescription
          ? "flex h-full w-full flex-col items-stretch"
          : "max-w-full"
      }`}
      data-card-description-content
      style={{
        color: TEXT_CREAM,
        fontSize: `${FONT_CQI.description * descriptionFontScale}cqi`,
        lineHeight: DESCRIPTION_LINE_HEIGHT,
        textShadow: `${(DESCRIPTION_SHADOW.offset / 300) * cardWidth}px ${(DESCRIPTION_SHADOW.offset / 300) * cardWidth}px 0 rgba(0,0,0,${DESCRIPTION_SHADOW.alpha})`,
      }}
    >
      {hasCustomDescription ? (
        <>
          {preDescriptionKeywords.length > 0 && (
            <div className="mb-[1cqi] shrink-0">
              {preDescriptionKeywords.map((kw, i) => (
                <Fragment key={`pre-kw-${kw}`}>
                  {i > 0 && <br />}
                  {renderKeyword(kw)}
                </Fragment>
              ))}
            </div>
          )}
          <div className="min-h-0 w-full flex-1">
            {descriptionContent}
          </div>
          {suffixParts && (
            <div className="mt-[1cqi] shrink-0" style={{ color: "#EE82EE" }}>
              {renderParts(suffixParts, "suffix")}
            </div>
          )}
          {postDescriptionKeywords.length > 0 && (
            <div className="mt-[1cqi] shrink-0">
              {postDescriptionKeywords.map((kw, i) => (
                <Fragment key={`post-kw-${kw}`}>
                  {i > 0 && <br />}
                  {renderKeyword(kw)}
                </Fragment>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {preDescriptionKeywords.map((kw, i) => (
            <Fragment key={`pre-kw-${kw}`}>
              {i > 0 && <br />}
              {renderKeyword(kw)}
            </Fragment>
          ))}
          {preDescriptionKeywords.length > 0 && descParts.length > 0 && <br />}
          {renderParts(descParts, "card")}
          {suffixParts && (
            <>
              <br />
              <span style={{ color: "#EE82EE" }}>{renderParts(suffixParts, "suffix")}</span>
            </>
          )}
          {postDescriptionKeywords.length > 0 && <br />}
          {postDescriptionKeywords.map((kw, i) => (
            <Fragment key={`post-kw-${kw}`}>
              {i > 0 && <br />}
              {renderKeyword(kw)}
            </Fragment>
          ))}
        </>
      )}
    </div>
  );

  // ─── Energy cost orb ───
  const renderCostOrb = () => costDisplay || costContent ? (
    <div
      className="absolute z-[6]"
      style={{
        top: `${L.cost.top}%`,
        left: `${L.cost.left}%`,
        width: `${L.cost.size}%`,
        aspectRatio: "1",
      }}
    >
      <Image src={energyIcon} alt="cost" fill className="object-contain" />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.cost}cqi`,
          fontFamily: TITLE_FONT,
          letterSpacing: "-0.02em",
          ...(costStroke as CSSProperties),
        }}
      >
        {costContent ?? costDisplay}
      </span>
    </div>
  ) : null;

  // ─── Star cost (Regent) ───
  const renderStarCost = () => starCostDisplay || starCostContent ? (
    <div
      className="absolute z-[6]"
      style={{
        top: `${L.starCost.top}%`,
        left: `${L.starCost.left}%`,
        width: `${L.starCost.size}%`,
        aspectRatio: "1",
      }}
    >
      <Image
        src="/images/game-assets/card-misc/energy_star.png"
        alt="star cost"
        fill
        className="object-contain"
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.star}cqi`,
          fontFamily: TITLE_FONT,
          ...(starStroke as CSSProperties),
        }}
      >
        {starCostContent ?? starCostDisplay}
      </span>
    </div>
  ) : null;

  // ─── 인챈트 슬롯 (코스트 아래) — game material: hsv.gdshader(h=0.25, s=0.4, v=1.0)
  // → CSS filter 환산: hue-rotate(-270deg = +90deg) saturate(0.4) brightness(1.0)
  // 슬롯 텍스처를 검정/회색으로 만드는 게임 셰이더와 동일.
  const slotInteractive = Boolean(onEnchantSlotClick);
  const enchantmentSlotLabel = enchantmentLabel ?? serviceText.enchantments;
  const removeEnchantActionLabel = serviceLocale === "ko"
    ? `${enchantmentSlotLabel} ${serviceText.cardsView.enchantments.remove}`
    : `${serviceText.cardsView.enchantments.remove} ${enchantmentSlotLabel}`;
  const renderEnchantSlot = () => enchantmentImageUrl ? (
    <div
      role={slotInteractive ? "button" : undefined}
      aria-label={slotInteractive ? removeEnchantActionLabel : undefined}
      tabIndex={slotInteractive ? 0 : undefined}
      onClick={slotInteractive
        ? (e) => {
            e.stopPropagation();
            onEnchantSlotClick?.();
          }
        : undefined}
      onKeyDown={slotInteractive
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onEnchantSlotClick?.();
            }
          }
        : undefined}
      className={`absolute z-[6] ${slotInteractive ? "cursor-pointer hover:scale-110 transition-transform" : "pointer-events-none"}`}
      style={{
        top: `${L.enchant.top}%`,
        left: `${L.enchant.left}%`,
        width: `${L.enchant.width}%`,
        aspectRatio: "72/54",
      }}
      title={slotInteractive ? removeEnchantActionLabel : enchantmentLabel ?? undefined}
    >
      {/* Slot base — 게임 ShaderMaterial_ots2x: HSV(0.25, 0.4, 1.0) */}
      <Image
        src="/images/game-assets/card-misc/card_enchant.png"
        alt=""
        fill
        className="object-contain"
        style={{ filter: "hue-rotate(90deg) saturate(0.4) brightness(1.0)" }}
      />
      {/* 인챈트 아이콘 — game Icon offset(14,9)~(49,44) within 72×54 슬롯 */}
      <div
        className="absolute"
        style={{
          left: `${(14 / 72) * 100}%`,
          top: `${(9 / 54) * 100}%`,
          width: `${((49 - 14) / 72) * 100}%`,
          height: `${((44 - 9) / 54) * 100}%`,
        }}
      >
        <Image
          src={enchantmentImageUrl}
          alt={enchantmentLabel ?? "enchantment"}
          fill
          className="object-contain"
        />
      </div>
      {/* Amount: game Label offset_left=26, top=27, right=66, bottom=53 (slot 72×54 내) */}
      {enchantmentAmount !== undefined && enchantmentAmount !== null && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${(26 / 72) * 100}%`,
            top: `${(27 / 54) * 100}%`,
            width: `${((66 - 26) / 72) * 100}%`,
            height: `${((53 - 27) / 54) * 100}%`,
          }}
        >
          <span
            className="font-black"
            style={{
              color: TEXT_CREAM,
              fontSize: `${FONT_CQI.enchantAmount}cqi`,
              fontFamily: TITLE_FONT,
              lineHeight: 1,
              ...(enchantAmountStroke as CSSProperties),
            }}
          >
            {enchantmentAmount}
          </span>
        </div>
      )}
    </div>
  ) : null;

  // 카드 컨테이너 인라인 스타일: 고정 픽셀 + cqi 베이스
  const cardContainerStyle: CSSProperties = {
    width: cardWidth,
    aspectRatio: CARD_ASPECT,
    containerType: "inline-size",
    overflow: "visible",
  };
  const holderHeight = cardWidth * (CARD_ASPECT_H / CARD_ASPECT_W);
  const overflowPad = {
    left: (CARD_OVERFLOW.left / CARD_ASPECT_W) * cardWidth,
    top: (CARD_OVERFLOW.top / CARD_ASPECT_H) * holderHeight,
    right: (CARD_OVERFLOW.right / CARD_ASPECT_W) * cardWidth,
    bottom: (CARD_OVERFLOW.bottom / CARD_ASPECT_H) * holderHeight,
  };
  const wrapCardRoot = (node: ReactNode) => (
    <div
      data-card-tile=""
      data-game-locale={captureSnapshot?.gameLocale}
      data-version={captureSnapshot?.version}
      className="relative overflow-visible"
      style={{
        width: cardWidth + overflowPad.left + overflowPad.right,
        marginLeft: -overflowPad.left,
        marginRight: -overflowPad.right,
        marginTop: -overflowPad.top,
        marginBottom: -overflowPad.bottom,
        paddingLeft: overflowPad.left,
        paddingTop: overflowPad.top,
        paddingRight: overflowPad.right,
        paddingBottom: overflowPad.bottom,
      }}
    >
      {node}
    </div>
  );
  const cardRootClassName = interactive
    ? "group relative cursor-pointer select-none transition-transform hover:scale-[1.03] hover:z-10"
    : `group relative ${editableContent ? "select-text" : "select-none"}`;
  const lifecycleClassName = card.deprecated ? " opacity-50 grayscale saturate-0" : "";

  // =====================================================================
  // ANCIENT CARD
  // =====================================================================
  if (isAncientCard) {
    const textBg = ANCIENT_TEXT_BG[card.type] ?? ANCIENT_TEXT_BG["스킬"];
    const textBgBox = rectBox(fittedRegion(ANCIENT.textBgRect, textBg.region, textBg.margin, "contain"));
    const { portrait, portraitMask } = ANCIENT;
    const ancientBannerFilter = hsvToFilter(ANCIENT_BANNER_HSV);
    const portraitMaskStyle = maskStyle(
      ANCIENT_PORTRAIT_MASK,
      `${holderCqi(portraitMask.width)} ${holderCqi(portraitMask.height)}`,
      `${holderCqi(portraitMask.left - portrait.left)} ${holderCqi(portraitMask.top - portrait.top)}`,
    );

    return wrapCardRoot(
      <div
        className={`${cardRootClassName}${lifecycleClassName}`}
        style={cardContainerStyle}
        onClick={onClick}
      >
        <div className="relative w-full h-full overflow-visible">
          <div
            className="absolute"
            style={{ ...rectBox(portrait), ...portraitMaskStyle }}
          >
            {imageSrc && !imgError ? (
              <Image
                src={imageSrc}
                alt={renderedCardName}
                fill
                className="object-fill"
                sizes={`${cardWidth}px`}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-gray-500 text-[10px]">
                No Image
              </div>
            )}
          </div>

          {/* AncientBorderGlassOverlay: dst * P + Q from its shader, as two masked layers. */}
          <div aria-hidden className="pointer-events-none absolute bg-black" style={{ ...ANCIENT.glass, ...maskStyle(ANCIENT_GLASS_SHADE) }} />
          <div
            aria-hidden
            className="pointer-events-none absolute bg-white"
            style={{ ...ANCIENT.glass, ...maskStyle(ANCIENT_GLASS_LIGHT), mixBlendMode: "plus-lighter" }}
          />
          {/* AncientBorder: modulate tint and 0.502 alpha baked, blend_mode ADD. */}
          <div className="pointer-events-none absolute" style={{ ...ANCIENT.border, mixBlendMode: "plus-lighter" }}>
            <Image src={ANCIENT_BORDER_ADD} alt="" fill className="object-fill" sizes={`${cardWidth}px`} />
          </div>
          {/* AncientTextBg: modulate Color(0, 0, 0, 0.66). */}
          <div className="pointer-events-none absolute" style={textBgBox}>
            <Image src={textBg.src} alt="" fill className="object-fill" style={{ filter: "brightness(0)", opacity: 0.66 }} />
          </div>

          <AfflictionCardOverlay afflictionId={afflictionId} />
          {afflictionOverlay}

          <div className="absolute z-[3] pointer-events-none overflow-hidden" style={ANCIENT.banner}>
            <Image src={ANCIENT_BANNER} alt="" fill className="object-cover" />
          </div>
          <span aria-hidden className="pointer-events-none absolute z-[3] overflow-hidden" style={ANCIENT.fire}>
            <Image
              src={ANCIENT_FLAME_SHEET}
              alt=""
              fill
              className="sts2-ancient-card-flame__sheet pointer-events-none"
              style={{
                width: "1000%",
                maxWidth: "none",
                height: "100%",
              }}
            />
          </span>
          {renderTitle()}

          <TypePlaque label={card.typeLabel} filter={ancientBannerFilter} />

          <div
            ref={descriptionViewportRef}
            className="absolute z-[5] overflow-hidden flex flex-col items-center justify-center"
            data-card-description-viewport
            style={{ ...L.desc, fontFamily: CARD_FONT }}
          >
            {renderDescription()}
          </div>

          {renderCostOrb()}
          {renderStarCost()}
          {renderEnchantSlot()}
          {engagementStats && (
            <CardEngagementStatsOverlay
              commentCount={engagementStats.commentCount}
              likeCount={engagementStats.likeCount}
              loading={engagementStats.loading}
              unavailable={engagementStats.unavailable}
              serviceLocale={serviceLocale}
            />
          )}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STANDARD CARD
  // =====================================================================
  return wrapCardRoot(
    <div
      className={`${cardRootClassName}${lifecycleClassName}`}
      style={cardContainerStyle}
      onClick={onClick}
    >
      <div className="relative h-full w-full overflow-visible">
        <div
          className="absolute overflow-hidden"
          style={{ ...L.art, clipPath: PORTRAIT_CLIP_PATHS[card.type] }}
        >
          {imageSrc && !imgError ? (
            <Image
              src={imageSrc}
              alt={renderedCardName}
              fill
              className="object-contain object-center"
              sizes={`${cardWidth}px`}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black/30 text-gray-500 text-[10px]">
              No Image
            </div>
          )}
        </div>

        <Image
          src={frameAsset}
          alt=""
          fill
          className="object-contain pointer-events-none z-[1]"
          style={{ filter: frameFilter }}
          sizes={`${cardWidth}px`}
          priority={false}
        />

        <div className="absolute z-[2] pointer-events-none" style={L.portraitBorder}>
          <Image
            src={portraitBorderAsset}
            alt=""
            fill
            className="object-contain"
            style={{ filter: bannerFilter }}
          />
        </div>

        {isInfectionCard && <InfectionCardOverlay />}
        <AfflictionCardOverlay afflictionId={afflictionId} />
        {afflictionOverlay}

        <div className="absolute z-[3] pointer-events-none" style={L.banner}>
          <Image
            src="/images/game-assets/card-misc/card_banner.png"
            alt=""
            fill
            className="pointer-events-none"
            style={{ filter: bannerFilter }}
          />
        </div>
        {renderTitle()}

        <TypePlaque label={card.typeLabel} filter={bannerFilter} />

        <div
          ref={descriptionViewportRef}
          className="absolute z-[5] overflow-hidden flex flex-col items-center justify-center"
          data-card-description-viewport
          style={{ ...L.desc, fontFamily: CARD_FONT }}
        >
          {renderDescription()}
        </div>

        {renderCostOrb()}
        {renderStarCost()}
        {renderEnchantSlot()}
        {engagementStats && (
          <CardEngagementStatsOverlay
            commentCount={engagementStats.commentCount}
            likeCount={engagementStats.likeCount}
            loading={engagementStats.loading}
            unavailable={engagementStats.unavailable}
            serviceLocale={serviceLocale}
          />
        )}
      </div>
    </div>
  );
});
