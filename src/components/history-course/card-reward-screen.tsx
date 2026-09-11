"use client";

import type { ReactNode } from "react";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import {
  CARD_REWARD_APPEAR_FADE,
  CARD_REWARD_APPEAR_POS,
  CARD_REWARD_PICK_START,
  EnchantAppearSparkles,
  RewardCardGlow,
  cubicOut,
  expoOut,
} from "@/components/history-course/last-scene-card-fx";
import { LastSceneObtainFly } from "@/components/history-course/last-scene-obtain-vfx";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { historyCardEnchantmentTileProps } from "@/lib/history-enchantments";
import { gameplayUiText } from "@/lib/history-gameplay-ui";
import { stripReplayId } from "@/lib/history-last-scene";
import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import type { ReplayChoice, ReplayEnchantment } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const BANNER = "/images/sts2/ui/reward-screen/reward_banner.webp";
const SKIP = "/images/sts2/ui/reward-screen/reward_skip_button.webp";

function enchantmentOnChoice(
  choice: ReplayChoice,
  enchantedCards?: ReplayEnchantment[],
): { enchantmentId: string; amount?: number } | null {
  if (choice.enchantmentId) {
    return { enchantmentId: choice.enchantmentId, amount: choice.enchantmentAmount };
  }
  const key = stripReplayId(choice.id).toUpperCase();
  const row = enchantedCards?.find(
    (entry) => stripReplayId(entry.cardId).toUpperCase() === key,
  );
  if (!row?.enchantmentId) return null;
  return { enchantmentId: row.enchantmentId, amount: row.amount };
}

function PickedRing({
  picked,
  pickId,
  appearT,
  fadeT,
  index,
  count,
  children,
}: {
  picked: boolean;
  pickId: string;
  appearT: number;
  fadeT: number;
  index: number;
  count: number;
  children: ReactNode;
}) {
  const fromCenter = (index - (count - 1) / 2) * -42;
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      className={cn(
        "relative flex w-[12.5%] shrink-0 flex-col items-center overflow-visible",
        picked && "z-10",
      )}
      style={{
        transform: `translateX(${(1 - appearT) * fromCenter}%) scale(${picked && appearT > 0.95 ? 1.05 : 1})`,
        filter: `brightness(${Math.max(0.08, fadeT)})`,
        opacity: fadeT,
      }}
    >
      {children}
    </div>
  );
}

export function CardRewardScreen({
  choices,
  cardsById,
  gameLocale,
  serviceLocale,
  locTables,
  skipped,
  beatProgress = 1,
  enchantedCards,
}: {
  choices: ReplayChoice[];
  cardsById?: Record<string, CodexCard>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  locTables?: HistoryLocTables | null;
  skipped: boolean;
  beatProgress?: number;
  enchantedCards?: ReplayEnchantment[];
}) {
  const header = gameplayUiText(gameLocale, "CHOOSE_CARD_HEADER", "Choose a Card", locTables);
  const skipLabel = gameplayUiText(gameLocale, "CHOOSE_CARD_SKIP_BUTTON", "Skip", locTables);
  const picked = choices.find((choice) => choice.picked && choice.id);
  const pickedCard = picked && cardsById ? lookupHistoryCard(cardsById, picked.id) : undefined;
  const appearT = expoOut(beatProgress / CARD_REWARD_APPEAR_POS);
  const fadeT = cubicOut(beatProgress / CARD_REWARD_APPEAR_FADE);
  const flying = Boolean(picked && beatProgress > CARD_REWARD_PICK_START && !skipped);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      data-history-card-reward
    >
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="absolute left-1/2 top-[8%] w-[min(34rem,70%)] -translate-x-1/2"
        style={{
          backgroundImage: `url(${BANNER})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 100%",
          aspectRatio: "1499 / 270",
        }}
      >
        <div
          className="flex h-full items-center justify-center px-[16%] pb-[8%] pt-[2%] text-center font-game-title text-[26px] text-[#fff6e2] sm:text-[32px]"
          style={{
            textShadow: "4px 4px 0 rgba(0,0,0,0.12)",
            WebkitTextStroke: "1px rgba(74,60,42,0.75)",
          }}
        >
          {header}
        </div>
      </div>
      <div className="absolute inset-x-0 top-[26%] bottom-[20%] flex items-center justify-center gap-[4%]">
        {choices.map((choice, index) => {
          const card = cardsById ? lookupHistoryCard(cardsById, choice.id) : undefined;
          const upgradeLevel = choice.upgradeLevel ?? 0;
          const hideForFly = flying && choice.picked;
          const enchantment = enchantmentOnChoice(choice, enchantedCards);
          const enchant = enchantment
            ? historyCardEnchantmentTileProps(
                enchantment.enchantmentId,
                enchantment.amount,
                gameLocale,
              )
            : null;
          return (
            <PickedRing
              key={choice.id}
              picked={choice.picked}
              pickId={choice.id}
              appearT={appearT}
              fadeT={fadeT}
              index={index}
              count={choices.length}
            >
              <div className={cn("relative w-full", hideForFly && "opacity-0")}>
                <RewardCardGlow rarity={card?.rarity} />
                {card ? (
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
                    forcedCost={enchant?.forcedCost}
                    enchantAddedKeywords={enchant?.enchantAddedKeywords}
                    enchantRemovedKeywords={enchant?.enchantRemovedKeywords}
                    descriptionSuffix={enchant?.descriptionSuffix}
                    enchantStatMod={enchant?.enchantStatMod}
                  />
                ) : (
                  <div className="font-game-text text-sm text-[#fff6e2]">{choice.id}</div>
                )}
                {enchant ? <EnchantAppearSparkles progress={beatProgress} /> : null}
              </div>
            </PickedRing>
          );
        })}
      </div>
      <div
        className={cn(
          "absolute bottom-[8%] left-1/2 w-[min(17.25rem,38%)] -translate-x-1/2 transition-transform duration-300",
          skipped && "scale-105",
        )}
        data-history-last-scene-pick="card-skip"
        data-picked={skipped ? "true" : "false"}
      >
        <div className="relative aspect-[552/134] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SKIP} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div
            className="absolute inset-0 flex items-center justify-center font-game-title text-[22px] text-[#fdf4e3] sm:text-[28px]"
            style={{
              textShadow: "5px 3px 0 rgba(0,0,0,0.25)",
              WebkitTextStroke: "0.6px #1f4045",
            }}
          >
            {skipLabel}
          </div>
        </div>
      </div>
      {flying && picked && pickedCard ? (
        <LastSceneObtainFly
          active
          progress={Math.max(0, Math.min(1, (beatProgress - CARD_REWARD_PICK_START) / (1 - CARD_REWARD_PICK_START)))}
          sourceSelector={`[data-history-last-scene-pick="${picked.id}"]`}
          targetSelector="[data-deck-target]"
          iconUrl={pickedCard.imageUrl ?? ""}
          kind="card"
          card={pickedCard}
          upgradeLevel={picked.upgradeLevel ?? 0}
          serviceLocale={serviceLocale}
          size={120}
        />
      ) : null}
    </div>
  );
}
