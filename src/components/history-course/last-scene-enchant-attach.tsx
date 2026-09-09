"use client";

import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import type { CodexCard, CodexEnchantment } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";

/**
 * Card-enchant token attach from `scenes/vfx/vfx_card_enchant.tscn`:
 * the enchantment icon drops onto the card's enchant slot.
 */
export function LastSceneEnchantAttach({
  card,
  enchantment,
  progress,
  serviceLocale,
}: {
  card: CodexCard;
  enchantment: CodexEnchantment;
  progress: number;
  serviceLocale: ServiceLocale;
}) {
  const t = Math.max(0, Math.min(1, progress));
  const tokenT = Math.max(0, Math.min(1, (t - 0.2) / 0.5));
  const landed = tokenT >= 1;
  const tokenY = (1 - tokenT) * -72;
  const tokenScale = landed ? 1 : 1.35 - tokenT * 0.35;
  const tokenOpacity = t < 0.15 ? 0 : 1;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[12%] z-30 flex justify-center"
      data-history-enchant-attach={enchantment.id}
    >
      <div className="relative w-[12.5%]">
        <FittedCardTile
          card={card}
          showUpgrade={false}
          showBeta={false}
          interactive={false}
          serviceLocale={serviceLocale}
          enchantmentImageUrl={landed ? enchantment.imageUrl : null}
          enchantmentLabel={enchantment.name}
        />
        {enchantment.imageUrl && !landed ? (
          <div
            className="absolute left-[11%] top-[18%] z-10 h-[12%] w-[16%]"
            style={{
              transform: `translateY(${tokenY}px) scale(${tokenScale})`,
              opacity: tokenOpacity,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enchantment.imageUrl}
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_4px_10px_rgba(255,240,180,0.65)]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
