"use client";

import { RichText } from "@/components/rich-text";
import { HistoryEntityPreview } from "@/components/history-course/history-entity-preview";
import {
  LastSceneObtainFly,
  cssEscapeAttr,
  relicTargetSelector,
} from "@/components/history-course/last-scene-obtain-vfx";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryPotion, buildPotionEntityInfo } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic, buildRelicEntityInfo } from "@/lib/history-relic-lookup";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import {
  gameplayUiTemplate,
  gameplayUiText,
} from "@/lib/history-gameplay-ui";
import {
  cardRewardTokenKind,
  lootSpecTaken,
  type CardRewardTokenKind,
  type CombatLootSpec,
} from "@/lib/history-last-scene-steps";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import type { ReplayHistoryEntry } from "@/lib/sts2-run-replay";

const PANEL = "/images/sts2/ui/reward-screen/reward_panel.webp";
const BANNER = "/images/sts2/ui/reward-screen/reward_banner.webp";
const ITEM = "/images/sts2/ui/reward-screen/reward_item_button.webp";
const PROCEED = "/images/sts2/ui/reward-screen/proceed_button.webp";
const ICON_GOLD = "/images/sts2/ui/reward-screen/reward_icon_money.webp";
const ICON_REMOVAL = "/images/sts2/ui/reward-screen/reward_icon_card_removal.webp";
const ICON_CARD = "/images/sts2/ui/reward-screen/reward_icon_card.webp";
const ICON_CARD_RARE = "/images/sts2/ui/reward-screen/reward_icon_rare.webp";
const ICON_CARD_UNCOMMON = "/images/sts2/ui/reward-screen/reward_icon_uncommon.webp";
const ICON_CARD_SPECIAL = "/images/sts2/ui/reward-screen/reward_icon_special_card.webp";
const RETICLE = "/images/sts2/ui/combat/combat_reticle.webp";

function cardTokenIcon(kind: CardRewardTokenKind): string {
  if (kind === "rare") return ICON_CARD_RARE;
  if (kind === "uncommon") return ICON_CARD_UNCOMMON;
  if (kind === "special-card") return ICON_CARD_SPECIAL;
  return ICON_CARD;
}
function SelectionReticle() {
  return (
    <div className="pointer-events-none absolute -inset-[10px] z-20" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute left-0 top-0 h-[30px] w-[30px]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute right-0 top-0 h-[30px] w-[30px] -scale-x-100" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute bottom-0 left-0 h-[30px] w-[30px] -scale-y-100" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute bottom-0 right-0 h-[30px] w-[30px] -scale-100" />
    </div>
  );
}

function LootRow({
  pickId,
  picked,
  active,
  leaving,
  skip,
  beatProgress,
  iconUrl,
  title,
}: {
  pickId: string;
  picked: boolean;
  active: boolean;
  leaving: boolean;
  skip: boolean;
  beatProgress: number;
  iconUrl: string;
  title: string;
}) {
  const collapse = leaving ? Math.min(1, Math.max(0, (beatProgress - 0.55) / 0.45)) : 0;
  const skipFade = skip && active ? Math.min(1, beatProgress / 0.35) : 0;
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      data-history-reward-item={pickId.split(":")[0]}
      className="relative w-full max-w-[402px] overflow-visible"
      style={{
        aspectRatio: "910 / 196",
        maxHeight: collapse > 0 ? `${(1 - collapse) * 86}px` : undefined,
        opacity: skip ? 1 - skipFade : leaving && beatProgress > 0.7 ? 1 - collapse : 1,
      }}
    >
      {active ? <SelectionReticle /> : null}
      <div className="relative h-full w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ITEM}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
        aria-hidden
      />
      <div className="relative flex h-full items-center gap-3 pl-[4.5%] pr-3">
        <div className="flex h-[65%] w-[14%] shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUrl}
            alt=""
            data-history-reward-icon={pickId}
            className="h-full w-full object-contain"
          />
        </div>
        <div
          className="min-w-0 flex-1 font-game-text text-[17px] font-normal leading-[1.1] text-[#fff6e2] sm:text-[20px]"
          style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.06)", WebkitTextStroke: "0.4px #225155" }}
        >
          <RichText text={title} />
        </div>
      </div>
      </div>
    </div>
  );
}

export function CombatLootScreen({
  items,
  resolvedCount,
  beatProgress,
  entry,
  gameLocale,
  locTables,
  relicsById,
  potionsById,
  cardsById,
  serviceLocale,
}: {
  items: CombatLootSpec[];
  resolvedCount: number;
  beatProgress: number;
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  locTables?: HistoryLocTables | null;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  cardsById?: Record<string, CodexCard>;
  serviceLocale?: ServiceLocale;
}) {
  const header = gameplayUiText(gameLocale, "COMBAT_REWARD_HEADER_LOOT", "Loot!", locTables);
  const skipLabel = gameplayUiText(gameLocale, "CHOOSE_CARD_SKIP_BUTTON", "Skip", locTables);
  const remaining = items.slice(Math.min(resolvedCount, items.length));
  const resolving = remaining[0];
  const resolvingTaken = resolving ? lootSpecTaken(resolving, entry) : false;

  let fly: {
    kind: "relic" | "potion" | "card";
    pickId: string;
    iconUrl: string;
    card?: CodexCard;
  } | null = null;
  if (resolving?.kind === "relic" && resolvingTaken) {
    const relic = lookupHistoryRelic(relicsById, resolving.choice.id);
    fly = {
      kind: "relic",
      pickId: resolving.choice.id,
      iconUrl:
        (relic ? resolveRelicDisplayImage(relic, relic.pool) : null)
        ?? "/images/sts2/ui/reward-screen/reward_icon_shared_relic.webp",
    };
  } else if (resolving?.kind === "potion" && resolvingTaken) {
    const potion = lookupHistoryPotion(potionsById, resolving.choice.id);
    fly = {
      kind: "potion",
      pickId: resolving.choice.id,
      iconUrl: potion?.imageUrl ?? ICON_GOLD,
    };
  } else if (resolving?.kind === "special-card" && resolvingTaken) {
    const card = cardsById ? lookupHistoryCard(cardsById, resolving.choice.id) : undefined;
    fly = {
      kind: "card",
      pickId: resolving.choice.id,
      iconUrl: card?.imageUrl ?? ICON_CARD_SPECIAL,
      card,
    };
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-history-combat-loot
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute left-1/2 top-[48%] w-[27.4%] min-w-[16rem] max-w-[26rem] -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative aspect-[526/640] w-full px-[8%] pb-[8%] pt-[16%]"
          style={{
            backgroundImage: `url(${PANEL})`,
            backgroundSize: "100% 100%",
          }}
        >
          <div
            className="absolute left-1/2 top-0 w-[124%] -translate-x-1/2 -translate-y-[18%]"
            style={{
              backgroundImage: `url(${BANNER})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 100%",
              aspectRatio: "1499 / 270",
            }}
          >
            <div
              className="flex h-full items-center justify-center px-[18%] pb-[10%] pt-[2%] text-center font-game-text text-[20px] font-normal tracking-wide text-[#fff6e2] sm:text-[24px]"
              style={{
                textShadow: "6px 5px 0 rgba(0,0,0,0.12)",
                WebkitTextStroke: "0.7px rgba(74,60,42,0.75)",
              }}
            >
              {header}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2.5 pt-6">
            {remaining.map((item, index) => {
              const active = index === 0;
              const leaving = active;
              const skip = active && !lootSpecTaken(item, entry);
              if (item.kind === "gold") {
                const title = gameplayUiTemplate(
                  gameLocale,
                  item.stolen ? "COMBAT_REWARD_GOLD_STOLEN" : "COMBAT_REWARD_GOLD",
                  item.stolen ? "{gold} Gold (reclaimed)" : "{gold} Gold",
                  { gold: item.amount },
                  locTables,
                );
                return (
                  <LootRow
                    key={`gold:${item.amount}`}
                    pickId={`gold:${item.amount}`}
                    picked
                    active={active}
                    leaving={leaving}
                    skip={skip}
                    beatProgress={beatProgress}
                    iconUrl={ICON_GOLD}
                    title={title}
                  />
                );
              }
              if (item.kind === "card-removal") {
                return (
                  <LootRow
                    key="card-removal"
                    pickId="card-removal"
                    picked
                    active={active}
                    leaving={leaving}
                    skip={skip}
                    beatProgress={beatProgress}
                    iconUrl={ICON_REMOVAL}
                    title={gameplayUiText(
                      gameLocale,
                      "COMBAT_REWARD_CARD_REMOVAL",
                      "Remove a card from your deck.",
                      locTables,
                    )}
                  />
                );
              }
              if (item.kind === "special-card") {
                const card = cardsById ? lookupHistoryCard(cardsById, item.choice.id) : undefined;
                return (
                  <LootRow
                    key={`special-card:${item.choice.id}`}
                    pickId={item.choice.id}
                    picked
                    active={active}
                    leaving={leaving}
                    skip={skip}
                    beatProgress={beatProgress}
                    iconUrl={ICON_CARD_SPECIAL}
                    title={card?.name ?? item.choice.id}
                  />
                );
              }
              if (item.kind === "cards") {
                return (
                  <LootRow
                    key="cards"
                    pickId="cards"
                    picked={lootSpecTaken(item, entry)}
                    active={active}
                    leaving={leaving}
                    skip={skip}
                    beatProgress={beatProgress}
                    iconUrl={cardTokenIcon(cardRewardTokenKind(entry, cardsById))}
                    title={gameplayUiText(
                      gameLocale,
                      "COMBAT_REWARD_ADD_CARD",
                      "Add a card to your deck",
                      locTables,
                    )}
                  />
                );
              }
              if (item.kind === "relic") {
                const relic = lookupHistoryRelic(relicsById, item.choice.id);
                const entity = buildRelicEntityInfo(relic);
                const iconUrl =
                  (relic ? resolveRelicDisplayImage(relic, relic.pool) : null)
                  ?? "/images/sts2/ui/reward-screen/reward_icon_shared_relic.webp";
                const row = (
                  <LootRow
                    pickId={item.choice.id}
                    picked={item.choice.picked}
                    active={active}
                    leaving={leaving}
                    skip={skip}
                    beatProgress={beatProgress}
                    iconUrl={iconUrl}
                    title={relic?.name ?? item.choice.id}
                  />
                );
                return relic && entity ? (
                  <HistoryEntityPreview key={item.choice.id} entity={entity} linkClassName="relative block w-full overflow-visible">
                    {row}
                  </HistoryEntityPreview>
                ) : (
                  <div key={item.choice.id}>{row}</div>
                );
              }
              const potion = lookupHistoryPotion(potionsById, item.choice.id);
              const entity = buildPotionEntityInfo(potion);
              const row = (
                <LootRow
                  pickId={item.choice.id}
                  picked={item.choice.picked}
                  active={active}
                  leaving={leaving}
                  skip={skip}
                  beatProgress={beatProgress}
                  iconUrl={potion?.imageUrl ?? ICON_GOLD}
                  title={potion?.name ?? item.choice.id}
                />
              );
              return potion && entity ? (
                <HistoryEntityPreview key={item.choice.id} entity={entity} linkClassName="relative block w-full overflow-visible">
                  {row}
                </HistoryEntityPreview>
              ) : (
                <div key={item.choice.id}>{row}</div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="absolute bottom-[12%] right-[6%] w-[min(14rem,18%)]">
        <div className="relative aspect-[381/178] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PROCEED} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div
            className="absolute inset-0 flex items-center justify-center pb-[6%] font-game-title text-[18px] text-[#fff6e2] sm:text-[22px]"
            style={{ WebkitTextStroke: "0.6px #56100c" }}
          >
            {skipLabel}
          </div>
        </div>
      </div>
      {fly ? (
        <LastSceneObtainFly
          active
          progress={beatProgress}
          sourceSelector={`[data-history-reward-icon="${cssEscapeAttr(fly.pickId)}"]`}
          targetSelector={
            fly.kind === "potion"
              ? "[data-potion-bay]"
              : fly.kind === "card"
                ? "[data-deck-target]"
                : relicTargetSelector(fly.pickId)
          }
          iconUrl={fly.iconUrl}
          kind={fly.kind}
          card={fly.card}
          serviceLocale={serviceLocale}
        />
      ) : null}
    </div>
  );
}
