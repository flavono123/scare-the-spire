"use client";

import type { ReactNode } from "react";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import { LastSceneObtainFly } from "@/components/history-course/last-scene-obtain-vfx";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { gameplayUiText } from "@/lib/history-gameplay-ui";
import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import type { ReplayChoice } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const BANNER = "/images/sts2/ui/reward-screen/reward_banner.webp";
const SKIP = "/images/sts2/ui/reward-screen/reward_skip_button.webp";
const GLOW_RARE = "/images/sts2/vfx/glow_card_rare.webp";
const GLOW_UNCOMMON = "/images/sts2/vfx/glow_card_uncommon.webp";

function glowForRarity(rarity: string | undefined): string {
  if (rarity === "희귀") return GLOW_RARE;
  return GLOW_UNCOMMON;
}

function RewardCardGlow({ rarity }: { rarity: string | undefined }) {
  const src = glowForRarity(rarity);
  const rare = rarity === "희귀";
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={cn(
          "max-w-none origin-center animate-[spin_12s_linear_infinite]",
          rare ? "h-[220%] w-[220%] opacity-90" : "h-[190%] w-[190%] opacity-70",
        )}
      />
    </div>
  );
}

function PickedRing({
  picked,
  pickId,
  children,
}: {
  picked: boolean;
  pickId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      className={cn(
        "relative flex w-[12.5%] shrink-0 flex-col items-center transition-transform duration-300",
        picked && "z-10 scale-105",
      )}
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
}: {
  choices: ReplayChoice[];
  cardsById?: Record<string, CodexCard>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  locTables?: HistoryLocTables | null;
  skipped: boolean;
  beatProgress?: number;
}) {
  const header = gameplayUiText(gameLocale, "CHOOSE_CARD_HEADER", "Choose a Card", locTables);
  const skipLabel = gameplayUiText(gameLocale, "CHOOSE_CARD_SKIP_BUTTON", "Skip", locTables);
  const picked = choices.find((choice) => choice.picked && choice.id);
  const pickedCard = picked && cardsById ? lookupHistoryCard(cardsById, picked.id) : undefined;
  const flying = Boolean(picked && beatProgress > 0.04 && !skipped);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      data-history-card-reward
    >
      {/* NOverlayStack shared backstop under the card-pick overlay */}
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
      {/* Game: 240px cards on 1920 = 12.5% of the 16:9 stage. */}
      <div className="absolute inset-x-0 top-[26%] bottom-[20%] flex items-center justify-center gap-[4%]">
        {choices.map((choice) => {
          const card = cardsById ? lookupHistoryCard(cardsById, choice.id) : undefined;
          const upgradeLevel = choice.upgradeLevel ?? 0;
          const hideForFly = flying && choice.picked;
          return (
            <PickedRing key={choice.id} picked={choice.picked} pickId={choice.id}>
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
                  />
                ) : (
                  <div className="font-game-text text-sm text-[#fff6e2]">{choice.id}</div>
                )}
              </div>
            </PickedRing>
          );
        })}
      </div>
      {/* card_reward_alternative_button.tscn — 276×73 hex skip */}
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
          progress={Math.max(0, Math.min(1, (beatProgress - 0.04) / 0.96))}
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
