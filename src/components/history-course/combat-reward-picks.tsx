"use client";

import type { ReactNode } from "react";
import { CardTile } from "@/components/codex/card-tile";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import { GameRoomChoicePanel } from "@/components/history-course/game-room-choice";
import { HistoryEntityPreview } from "@/components/history-course/history-entity-preview";
import { RichText } from "@/components/rich-text";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { buildPotionEntityInfo, lookupHistoryPotion } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic, buildRelicEntityInfo } from "@/lib/history-relic-lookup";
import { historyStaticHoverTip } from "@/lib/history-static-hover-tips";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import type { ServiceLocale } from "@/lib/i18n";
import { bakeDescription } from "@/lib/codex-bake";
import { gameUi, type GameI18nTables } from "@/lib/sts2-game-i18n";
import type { ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const GOLD_ICON = "/images/sts2/ui/topbar/top_bar_gold.png";

function PickedRing({
  picked,
  revealed,
  pickId,
  children,
}: {
  picked: boolean;
  revealed: boolean;
  pickId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      className={cn(
        "relative flex flex-col items-center gap-1 transition-all duration-300",
        revealed && !picked && "opacity-40 scale-95",
        revealed && picked && "scale-105",
      )}
    >
      {children}
    </div>
  );
}

function RewardChoiceRow({
  pickId,
  picked,
  revealed,
  title,
  description,
  backgroundImageUrl,
}: {
  pickId: string;
  picked: boolean;
  revealed: boolean;
  title: string;
  description?: string | null;
  backgroundImageUrl?: string | null;
}) {
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      data-history-reward-item={pickId.split(":")[0]}
      className={cn("transition-opacity duration-300", revealed && !picked && "opacity-40")}
    >
      <GameChoiceFrame active={revealed && picked} backgroundImageUrl={backgroundImageUrl}>
        <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
          <RichText text={title} />
        </div>
        {description ? (
          <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
            <RichText text={description} />
          </div>
        ) : null}
      </GameChoiceFrame>
    </div>
  );
}

export function CombatRewardPicks({
  entry,
  tables,
  pickReveal,
  includeRemoved,
  leftoverGoldLabel,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  layout = "compact",
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  includeRemoved?: boolean;
  leftoverGoldLabel?: string;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  layout?: "combat" | "compact";
}) {
  const cards = entry.card_choices ?? [];
  const cardChoiceIds = new Set(cards.map((choice) => choice.id));
  const gained = (entry.cards_gained ?? []).filter(
    (card) => card.id && !cardChoiceIds.has(card.id),
  );
  const relics = (entry.relic_choices ?? []).filter((choice) => choice.id);
  const potions = (entry.potion_choices ?? []).filter((choice) => choice.id);
  const removed = includeRemoved
    ? (entry.cards_removed ?? []).filter((card) => card.id)
    : [];
  const extraUpgrades = (entry.upgraded_cards ?? []).filter(
    (id) => !cardChoiceIds.has(id),
  );
  const skippedCards = cards.length > 0 && !cards.some((choice) => choice.picked);
  const goldGained = entry.gold_gained ?? 0;
  const leftoverGold = leftoverGoldLabel && typeof entry.current_gold === "number"
    ? leftoverGoldLabel.replace("{gold}", String(entry.current_gold))
    : null;
  const cardRewardTip = historyStaticHoverTip("CARD_REWARD", serviceLocale === "en" ? "eng" : "kor");
  const goldTitle = bakeDescription(
    gameUi(tables, "goldGained", "{Amount}"),
    { Amount: goldGained, Icon: "" },
  ).trim();

  const hasCards = cards.length > 0 || gained.length > 0 || extraUpgrades.length > 0 || removed.length > 0;
  const hasSideRewards = goldGained > 0 || relics.length > 0 || potions.length > 0 || Boolean(leftoverGold);
  if (!hasCards && !hasSideRewards && !skippedCards) return null;

  const cardTiles = (
    <>
      {cards.length > 0 ? (
        <div className="flex flex-wrap items-end justify-center gap-3">
          {cards.map((choice) => (
            <RewardCard
              key={choice.id}
              choice={choice}
              cardsById={cardsById}
              pickReveal={pickReveal}
              serviceLocale={serviceLocale}
            />
          ))}
        </div>
      ) : null}
      {gained.length > 0 || extraUpgrades.length > 0 || removed.length > 0 ? (
        <div className="flex flex-wrap items-end justify-center gap-3">
          {gained.map((card) => (
            <RewardCard
              key={`g-${card.id}`}
              choice={{ id: card.id ?? "", picked: true, upgradeLevel: card.current_upgrade_level }}
              cardsById={cardsById}
              pickReveal={pickReveal}
              serviceLocale={serviceLocale}
            />
          ))}
          {extraUpgrades.map((id) => (
            <RewardCard
              key={`u-${id}`}
              choice={{ id, picked: true, upgradeLevel: 1 }}
              cardsById={cardsById}
              pickReveal={pickReveal}
              serviceLocale={serviceLocale}
            />
          ))}
          {removed.map((card) => (
            <RewardCard
              key={`r-${card.id}`}
              choice={{ id: card.id ?? "", picked: true, upgradeLevel: card.current_upgrade_level }}
              cardsById={cardsById}
              pickReveal={pickReveal}
              serviceLocale={serviceLocale}
            />
          ))}
        </div>
      ) : null}
      {skippedCards ? (
        <div className="font-game-title text-lg text-[#efc850] [text-shadow:0_2px_0_rgba(0,0,0,0.85)]">
          {gameUi(tables, "chooseSkip", "넘기기")}
        </div>
      ) : null}
    </>
  );

  const sideRows = (
    <>
      {goldGained > 0 ? (
        <RewardChoiceRow
          pickId={`gold:${goldGained}`}
          picked
          revealed={pickReveal}
          title={goldTitle}
          backgroundImageUrl={GOLD_ICON}
        />
      ) : null}
      {leftoverGold ? (
        <div data-history-leftover-gold={entry.current_gold}>
          <RewardChoiceRow
            pickId={`gold-left:${entry.current_gold}`}
            picked
            revealed={pickReveal}
            title={leftoverGold}
            backgroundImageUrl={GOLD_ICON}
          />
        </div>
      ) : null}
      {relics.map((choice) => {
        const relic = lookupHistoryRelic(relicsById, choice.id);
        const entity = buildRelicEntityInfo(relic);
        const imageUrl = relic ? resolveRelicDisplayImage(relic, relic.pool) : null;
        const row = (
          <RewardChoiceRow
            key={choice.id}
            pickId={choice.id}
            picked={choice.picked}
            revealed={pickReveal}
            title={relic?.name ?? choice.id}
            description={relic?.eventDescription ?? relic?.description}
            backgroundImageUrl={imageUrl}
          />
        );
        return relic && entity ? (
          <HistoryEntityPreview key={choice.id} entity={entity}>
            {row}
          </HistoryEntityPreview>
        ) : row;
      })}
      {potions.map((choice) => {
        const potion = lookupHistoryPotion(potionsById, choice.id);
        const entity = buildPotionEntityInfo(potion);
        const row = (
          <RewardChoiceRow
            key={`p-${choice.id}`}
            pickId={choice.id}
            picked={choice.picked}
            revealed={pickReveal}
            title={potion?.name ?? choice.id}
            description={potion?.description}
            backgroundImageUrl={potion?.imageUrl}
          />
        );
        return potion && entity ? (
          <HistoryEntityPreview key={`p-${choice.id}`} entity={entity}>
            {row}
          </HistoryEntityPreview>
        ) : row;
      })}
      {layout === "combat" && cards.length > 0 ? (
        <RewardChoiceRow
          pickId="card-reward"
          picked={cards.some((choice) => choice.picked)}
          revealed={pickReveal}
          title={cardRewardTip.title}
          description={cardRewardTip.description}
        />
      ) : null}
    </>
  );

  if (layout === "combat") {
    return (
      <div
        data-history-combat-rewards
        className={cn(
          "pointer-events-auto absolute inset-0 z-20 transition-opacity duration-300",
          pickReveal ? "opacity-100" : "opacity-0",
        )}
      >
        {hasCards ? (
          <div className="absolute inset-x-4 top-24 bottom-20 flex flex-col items-center justify-center gap-3 sm:right-[46%] sm:items-center">
            {cardTiles}
          </div>
        ) : null}
        {hasSideRewards || cards.length > 0 ? (
          <GameRoomChoicePanel>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              {sideRows}
            </div>
          </GameRoomChoicePanel>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-h-full flex-col items-center gap-3 overflow-y-auto overscroll-contain transition-opacity duration-300",
        pickReveal ? "opacity-100" : "opacity-0",
      )}
    >
      {cardTiles}
      {hasSideRewards ? (
        <div className="flex w-full max-w-[28rem] flex-col gap-2">
          {sideRows}
        </div>
      ) : null}
    </div>
  );
}

function RewardCard({
  choice,
  cardsById,
  pickReveal,
  serviceLocale,
}: {
  choice: ReplayChoice;
  cardsById?: Record<string, CodexCard>;
  pickReveal: boolean;
  serviceLocale: ServiceLocale;
}) {
  const card = lookupHistoryCard(cardsById ?? {}, choice.id);
  const upgradeLevel = choice.upgradeLevel ?? 0;
  return (
    <PickedRing picked={choice.picked} revealed={pickReveal} pickId={choice.id}>
      {card ? (
        <div className="w-[148px] sm:w-[176px]">
          <CardTile
            card={card}
            showUpgrade={upgradeLevel > 0}
            upgradeLevel={upgradeLevel}
            showBeta={false}
            width={176}
            interactive={false}
            serviceLocale={serviceLocale}
          />
        </div>
      ) : (
        <div className="font-game-text text-sm text-[#fff6e2]">{choice.id}</div>
      )}
    </PickedRing>
  );
}
