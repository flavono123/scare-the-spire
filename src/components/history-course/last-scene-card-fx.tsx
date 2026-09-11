"use client";

import { hsvToFilter, RARITY_BANNER_HSV } from "@/lib/sts2-card-style";
import { cn } from "@/lib/utils";

const GLOW_RARE = "/images/sts2/vfx/glow_card_rare.webp";
const GLOW_UNCOMMON = "/images/sts2/vfx/glow_card_uncommon.webp";
const STAR = "/images/sts2/vfx/star1.webp";

/** `NCardRewardSelectionScreen` position tween is 0.5s Expo Out. */
export const CARD_REWARD_APPEAR_POS = 0.42;
/** Modulate black→white is 1.0s Cubic Out on a 1.2s beat. */
export const CARD_REWARD_APPEAR_FADE = 0.83;
/** Pick fly waits until the fan-out has settled. */
export const CARD_REWARD_PICK_START = 0.55;

export function expoOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u >= 1 ? 1 : 1 - 2 ** (-10 * u);
}

export function cubicOut(t: number): number {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

type RewardGlow = {
  src: string;
  color: string;
  sparkles: boolean;
  sizeClass: string;
  opacity: number;
  extraFilter?: string;
};

/**
 * `NCard.ActivateRewardScreenGlow` instantiates GPU glows only for Rare
 * (`Color(1, 0.877, 0.08)` + sparkles) and Uncommon (`Color(0.68, 0.989, 1, 0.25)`).
 * Other rarities reuse the uncommon sprite, tinted with `RARITY_BANNER_HSV`.
 */
export function rewardGlowForRarity(rarity: string | undefined): RewardGlow {
  if (rarity === "희귀") {
    return {
      src: GLOW_RARE,
      color: "rgb(255, 224, 20)",
      sparkles: true,
      sizeClass: "h-[220%] w-[187%]",
      opacity: 0.95,
    };
  }
  if (rarity === "고급") {
    return {
      src: GLOW_UNCOMMON,
      color: "rgba(173, 252, 255, 0.85)",
      sparkles: false,
      sizeClass: "h-[230%] w-[170%]",
      opacity: 0.8,
    };
  }
  const hsv = RARITY_BANNER_HSV[rarity ?? ""] ?? RARITY_BANNER_HSV["일반"];
  return {
    src: GLOW_UNCOMMON,
    color: "rgb(255, 246, 226)",
    sparkles: false,
    sizeClass: "h-[190%] w-[160%]",
    opacity: 0.62,
    extraFilter: hsvToFilter(hsv),
  };
}

export function RewardCardGlow({ rarity }: { rarity: string | undefined }) {
  const glow = rewardGlowForRarity(rarity);
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
      aria-hidden
      data-history-card-glow={rarity ?? "none"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={glow.src}
        alt=""
        className={cn("max-w-none origin-center animate-[spin_12s_linear_infinite]", glow.sizeClass)}
        style={{
          opacity: glow.opacity,
          filter: [glow.extraFilter, `drop-shadow(0 0 18px ${glow.color})`].filter(Boolean).join(" "),
        }}
      />
      {glow.sparkles ? <CardSparkleField density="glow" /> : null}
    </div>
  );
}

const SPARKLE_SLOTS = [
  { x: 8, y: 18, delay: "0ms", duration: "1.6s" },
  { x: 18, y: 8, delay: "80ms", duration: "1.8s" },
  { x: 4, y: 32, delay: "120ms", duration: "1.5s" },
  { x: 22, y: 28, delay: "40ms", duration: "1.7s" },
  { x: 12, y: 42, delay: "160ms", duration: "1.9s" },
  { x: 28, y: 14, delay: "200ms", duration: "1.4s" },
  { x: 6, y: 52, delay: "90ms", duration: "1.6s" },
  { x: 16, y: 22, delay: "240ms", duration: "1.8s" },
];

/**
 * `scenes/vfx/vfx_card_enchant.tscn` EnchantmentAppearSparkles:
 * cream stars, one-shot, start at 0.2s, drift +72px x.
 */
export function EnchantAppearSparkles({ progress }: { progress: number }) {
  const t = Math.max(0, Math.min(1, progress));
  if (t < 0.16) return null;
  return (
    <div
      className="pointer-events-none absolute left-[6%] top-[12%] z-20 h-[28%] w-[22%] mix-blend-screen"
      aria-hidden
      data-history-enchant-sparkles
      style={{
        transform: `translateX(${Math.min(1, (t - 0.16) / 0.34) * 72}px)`,
      }}
    >
      <CardSparkleField density="enchant" />
    </div>
  );
}

export function UpgradeBurstSparkles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 mix-blend-screen"
      aria-hidden
      data-history-upgrade-sparkles
    >
      <CardSparkleField density="upgrade" />
    </div>
  );
}

function CardSparkleField({ density }: { density: "glow" | "enchant" | "upgrade" }) {
  const copies = density === "enchant" || density === "upgrade" ? 3 : 1;
  const slots = Array.from({ length: copies }, () => SPARKLE_SLOTS).flat();
  return (
    <>
      {slots.map((slot, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${density}-${index}`}
          src={STAR}
          alt=""
          className="absolute h-[18%] w-[18%] max-h-6 max-w-6 origin-center"
          style={{
            left: `${slot.x + (index % 5) * (density === "upgrade" ? 12 : 4)}%`,
            top: `${slot.y + Math.floor(index / 8) * (density === "upgrade" ? 10 : 6)}%`,
            animation: `${density === "upgrade" ? "historyUpgradeSpark" : "historyEnchantSpark"} ${slot.duration} ease-out ${slot.delay} both`,
            filter:
              density === "upgrade"
                ? "drop-shadow(0 0 6px rgb(255, 255, 138))"
                : "drop-shadow(0 0 6px rgb(255, 253, 204))",
            ["--dx" as string]: `${(index % 5 - 2) * 14}px`,
            ["--dy" as string]: `${-28 - (index % 4) * 10}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes historyEnchantSpark {
          0% { opacity: 0; transform: translate(0, 0) scale(0.4) rotate(-8deg); }
          12% { opacity: 0.95; transform: translate(4px, -6px) scale(1) rotate(8deg); }
          100% { opacity: 0; transform: translate(18px, -28px) scale(0.35) rotate(16deg); }
        }
        @keyframes historyUpgradeSpark {
          0% { opacity: 1; transform: translate(0, 0) scale(0.7); }
          100% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, -40px)) scale(0.2); }
        }
      `}</style>
    </>
  );
}
