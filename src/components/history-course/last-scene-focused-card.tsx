"use client";

import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import { EnchantAppearSparkles, UpgradeBurstSparkles } from "@/components/history-course/last-scene-card-fx";
import { historyCardEnchantmentTileProps } from "@/lib/history-enchantments";
import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Centered last-scene card (shop removal pick, Pomander upgrade,
 * event enchant/upgrade). Game `NCardUpgradeVfx` / deck-select preview
 * place the tile at screen center.
 */
export function LastSceneFocusedCard({
  card,
  progress,
  serviceLocale,
  gameLocale,
  upgradeLevel = 0,
  enchantmentId,
  enchantmentAmount,
  burst = false,
  appearFromZero = false,
  removed = false,
}: {
  card: CodexCard;
  progress: number;
  serviceLocale: ServiceLocale;
  gameLocale?: GameLocale;
  upgradeLevel?: number;
  enchantmentId?: string;
  enchantmentAmount?: number;
  burst?: boolean;
  appearFromZero?: boolean;
  removed?: boolean;
}) {
  const t = Math.max(0, Math.min(1, progress));
  const scale = appearFromZero ? Math.min(1, t / 0.21) : 1;
  const eased = appearFromZero ? 1 - (1 - Math.min(1, t / 0.21)) ** 3 : 1;
  const enchant = enchantmentId
    ? historyCardEnchantmentTileProps(enchantmentId, enchantmentAmount, gameLocale ?? serviceLocale)
    : null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      data-history-focused-card={card.id}
    >
      <div className="absolute inset-0 bg-black/78" />
      <div
        className={cn("relative w-[min(18rem,22%)]", removed && "opacity-70")}
        style={{
          transform: `scale(${appearFromZero ? eased : scale})`,
        }}
      >
        <FittedCardTile
          card={card}
          showUpgrade={upgradeLevel > 0}
          upgradeLevel={upgradeLevel}
          showBeta={false}
          interactive={false}
          serviceLocale={serviceLocale}
          enchantmentImageUrl={enchant?.enchantmentImageUrl}
          enchantmentLabel={enchant?.enchantmentLabel}
          enchantmentAmount={enchant?.enchantmentAmount}
        />
        {burst ? <UpgradeBurstSparkles active={t > 0.04} /> : null}
        {enchant ? <EnchantAppearSparkles progress={progress} /> : null}
      </div>
    </div>
  );
}
