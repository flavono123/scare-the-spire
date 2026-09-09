"use client";

import { CardTile } from "@/components/codex/card-tile";
import { RichText } from "@/components/rich-text";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryPotion } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic } from "@/lib/history-relic-lookup";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import { runHistoryText } from "@/lib/history-run-history-loc";
import { bakeDescription } from "@/lib/codex-bake";
import { stripReplayId } from "@/lib/history-last-scene";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

function line(locale: GameLocale, key: string, fallback: string, vars: Record<string, string | number>) {
  return bakeDescription(runHistoryText(locale, key, fallback), vars);
}

export function RoomResultReceipt({
  entry,
  gameLocale,
  serviceLocale,
  cardsById,
  relicsById,
  potionsById,
  excludeRelicIds,
  includeHeal = true,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  excludeRelicIds?: Set<string>;
  includeHeal?: boolean;
}) {
  const cardChoiceIds = new Set((entry.card_choices ?? []).map((choice) => choice.id));
  const cards = [
    ...(entry.card_choices ?? []).filter((choice) => choice.picked && choice.id),
    ...(entry.cards_gained ?? [])
      .filter((card) => card.id && !cardChoiceIds.has(card.id))
      .map((card) => ({
        id: card.id ?? "",
        picked: true,
        upgradeLevel: card.current_upgrade_level,
      })),
    ...(entry.upgraded_cards ?? [])
      .filter((id) => id && !cardChoiceIds.has(id))
      .map((id) => ({
        id,
        picked: true,
        upgradeLevel: 1,
      })),
  ];
  const relics = (entry.relic_choices ?? []).filter((choice) => {
    if (!choice.id || !choice.picked) return false;
    if (!excludeRelicIds) return true;
    return !excludeRelicIds.has(stripReplayId(choice.id).toUpperCase());
  });
  const potions = (entry.potion_choices ?? []).filter((choice) => choice.picked && choice.id);
  const removed = (entry.cards_removed ?? []).filter((card) => card.id);
  const enchanted = (entry.cards_enchanted ?? []).filter((row) => row.cardId);
  const goldGained = entry.gold_gained ?? 0;
  const goldLost = entry.gold_lost ?? 0;
  const goldStolen = entry.gold_stolen ?? 0;
  const damage = entry.damage_taken ?? 0;
  const healed = includeHeal ? (entry.hp_healed ?? 0) : 0;
  const maxUp = entry.max_hp_gained ?? 0;
  const maxDown = entry.max_hp_lost ?? 0;
  const hasVisual =
    cards.length > 0 || relics.length > 0 || potions.length > 0 || removed.length > 0 || enchanted.length > 0;
  const hasCopy =
    goldGained > 0 || goldLost > 0 || goldStolen > 0 || damage > 0 || healed > 0 || maxUp > 0 || maxDown > 0;
  if (!hasVisual && !hasCopy) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-4 bottom-20 top-24 z-20 flex flex-col items-center justify-end gap-3 sm:inset-x-auto sm:left-1/2 sm:w-[min(40rem,70%)] sm:-translate-x-1/2"
      data-history-room-receipt
    >
      {hasVisual ? (
        <div className="flex flex-wrap items-end justify-center gap-3">
          {cards.map((choice) => (
            <ReceiptCard
              key={`c-${choice.id}`}
              choice={choice}
              cardsById={cardsById}
              serviceLocale={serviceLocale}
            />
          ))}
          {removed.map((card) => (
            <ReceiptCard
              key={`r-${card.id}`}
              choice={{ id: card.id ?? "", picked: true, upgradeLevel: card.current_upgrade_level }}
              cardsById={cardsById}
              serviceLocale={serviceLocale}
              removed
            />
          ))}
          {enchanted.map((row) => (
            <ReceiptCard
              key={`e-${row.cardId}-${row.enchantmentId}`}
              choice={{ id: row.cardId, picked: true, upgradeLevel: row.upgradeLevel }}
              cardsById={cardsById}
              serviceLocale={serviceLocale}
            />
          ))}
          {relics.map((choice) => {
            const relic = lookupHistoryRelic(relicsById, choice.id);
            const src = relic ? resolveRelicDisplayImage(relic, relic.pool) : null;
            return (
              <div
                key={choice.id}
                data-history-last-scene-pick={choice.id}
                data-picked="true"
                className="flex h-20 w-20 items-center justify-center"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={relic?.name ?? choice.id} className="h-full w-full object-contain" />
                ) : (
                  <span className="font-game-text text-xs text-[#fff6e2]">{choice.id}</span>
                )}
              </div>
            );
          })}
          {potions.map((choice) => {
            const potion = lookupHistoryPotion(potionsById, choice.id);
            return (
              <div
                key={choice.id}
                data-history-last-scene-pick={choice.id}
                data-picked="true"
                className="flex h-16 w-16 items-center justify-center"
              >
                {potion?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={potion.imageUrl} alt={potion.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="font-game-text text-xs text-[#fff6e2]">{choice.id}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {hasCopy ? (
        <div className="flex flex-col items-center gap-1 text-center font-game-text text-[18px] text-[#fff6e2]">
          {goldGained > 0 ? (
            <RichText text={line(gameLocale, "HISTORY_ENTRY.goldGained", "{Amount} Gold", { Amount: goldGained, Icon: "" })} />
          ) : null}
          {goldLost > 0 ? (
            <RichText text={line(gameLocale, "HISTORY_ENTRY.goldLost", "Lost {Amount} Gold", { Amount: goldLost })} />
          ) : null}
          {goldStolen > 0 ? (
            <RichText text={line(gameLocale, "HISTORY_ENTRY.goldStolen", "{Amount} Gold stolen", { Amount: goldStolen })} />
          ) : null}
          {damage > 0 ? (
            <RichText text={line(gameLocale, "MAP_POINT_HISTORY.damageTaken", "[red]{Damage} Damage[/red]", { Damage: damage })} />
          ) : null}
          {healed > 0 ? (
            <RichText text={line(gameLocale, "MAP_POINT_HISTORY.healed", "[green]Healed for {HP} HP[/green]", { HP: healed })} />
          ) : null}
          {maxUp > 0 ? (
            <RichText text={line(gameLocale, "MAP_POINT_HISTORY.maxHpGained", "[green]Gained {HP} Max HP[/green]", { HP: maxUp })} />
          ) : null}
          {maxDown > 0 ? (
            <RichText text={line(gameLocale, "MAP_POINT_HISTORY.maxHpLost", "[red]Lost {HP} Max HP[/red]", { HP: maxDown })} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReceiptCard({
  choice,
  cardsById,
  serviceLocale,
  removed,
}: {
  choice: ReplayChoice;
  cardsById?: Record<string, CodexCard>;
  serviceLocale: ServiceLocale;
  removed?: boolean;
}) {
  const card = cardsById ? lookupHistoryCard(cardsById, choice.id) : undefined;
  const upgradeLevel = choice.upgradeLevel ?? 0;
  return (
    <div
      data-history-last-scene-pick={choice.id}
      data-picked="true"
      className={cn("w-[132px] sm:w-[160px]", removed && "opacity-60")}
    >
      {card ? (
        <CardTile
          card={card}
          showUpgrade={upgradeLevel > 0}
          upgradeLevel={upgradeLevel}
          showBeta={false}
          width={160}
          interactive={false}
          serviceLocale={serviceLocale}
        />
      ) : (
        <div className="font-game-text text-sm text-[#fff6e2]">{choice.id}</div>
      )}
    </div>
  );
}
