"use client";

import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import {
  LastSceneObtainFly,
  cssEscapeAttr,
  relicTargetSelector,
} from "@/components/history-course/last-scene-obtain-vfx";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryPotion } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic } from "@/lib/history-relic-lookup";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import { shopObtainsAtStep } from "@/lib/history-last-scene-steps";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import type { ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const RUG = "/images/sts2/ui/merchant/shop_rug.webp";
const REMOVAL_AVAILABLE = "/images/sts2/ui/merchant/card_removal_00.webp";
const REMOVAL_USED = "/images/sts2/ui/merchant/card_removal_05.webp";
const BACK = "/images/sts2/ui/back_button.png";
const BACK_ARROW = "/images/sts2/ui/back_button_arrow.png";

/**
 * `scenes/merchant/merchant_inventory.tscn` SlotsContainer size after
 * expand_mode stretch: 1747×978. Item offsets are in that space.
 * NMerchantInventory opens the rug at position.y = 80 on a 1080p canvas.
 */
const RUG_W = 1747;
const RUG_H = 978;
const CARD_SCALE = 0.65;
const CARD_W = 300 * CARD_SCALE;
const CARD_H = 422 * CARD_SCALE;
const CHARACTER_CARDS = [
  { x: 332 - 13, y: 303 },
  { x: 332 + 250, y: 303 },
  { x: 332 + 511, y: 303 },
  { x: 332 + 770, y: 303 },
  { x: 332 + 1036, y: 303 - 3 },
] as const;
const COLORLESS_CARDS = [
  { x: 397 - 13, y: 676 },
  { x: 397 + 261, y: 676 },
] as const;
const RELIC_ORIGIN = { x: 871, y: 595 };
const POTION_ORIGIN = { x: 871, y: 739 };
const SLOT_GAP = 150;
const RELIC_SLOT = 122 * CARD_SCALE;
const REMOVAL = { x: 1370, y: 678, w: 218, h: 218 };

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function ShopCard({
  choice,
  cardsById,
  serviceLocale,
  left,
  top,
  flying,
  beatProgress,
}: {
  choice: ReplayChoice | undefined;
  cardsById?: Record<string, CodexCard>;
  serviceLocale: ServiceLocale;
  left: number;
  top: number;
  flying?: boolean;
  beatProgress?: number;
}) {
  if (!choice?.id) return null;
  const card = cardsById ? lookupHistoryCard(cardsById, choice.id) : undefined;
  const upgradeLevel = choice.upgradeLevel ?? 0;
  const hideIcon = flying && (beatProgress ?? 0) > 0.04;
  return (
    <div
      data-history-last-scene-pick={choice.id}
      data-picked={choice.picked ? "true" : "false"}
      className={cn(
        "absolute overflow-hidden transition-all duration-300",
        choice.picked ? "z-10 scale-105" : "opacity-85",
      )}
      style={{
        left: pct(left, RUG_W),
        top: pct(top, RUG_H),
        width: pct(CARD_W, RUG_W),
        height: pct(CARD_H, RUG_H),
      }}
    >
      {card ? (
        <div className={cn("h-full w-full", hideIcon && "opacity-0")}>
          <FittedCardTile
            card={card}
            showUpgrade={upgradeLevel > 0}
            upgradeLevel={upgradeLevel}
            showBeta={false}
            interactive={false}
            serviceLocale={serviceLocale}
          />
        </div>
      ) : (
        <div className="font-game-text text-xs text-[#fff6e2]">{choice.id}</div>
      )}
    </div>
  );
}

function ShopRelic({
  choice,
  relicsById,
  index,
  flying,
  beatProgress,
}: {
  choice: ReplayChoice | undefined;
  relicsById?: Record<string, CodexRelic>;
  index: number;
  flying?: boolean;
  beatProgress?: number;
}) {
  if (!choice?.id) return null;
  const relic = lookupHistoryRelic(relicsById, choice.id);
  const src = relic ? resolveRelicDisplayImage(relic, relic.pool) : null;
  const hideIcon = flying && (beatProgress ?? 0) > 0.12;
  return (
    <div
      data-history-last-scene-pick={choice.id}
      data-picked={choice.picked ? "true" : "false"}
      className={cn(
        "absolute flex items-center justify-center transition-all duration-300",
        choice.picked ? "z-10 scale-110" : "opacity-85",
      )}
      style={{
        left: pct(RELIC_ORIGIN.x + index * SLOT_GAP, RUG_W),
        top: pct(RELIC_ORIGIN.y, RUG_H),
        width: pct(RELIC_SLOT, RUG_W),
        height: pct(RELIC_SLOT, RUG_H),
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={relic?.name ?? choice.id}
          data-history-reward-icon={choice.id}
          className={cn("h-full w-full object-contain", hideIcon && "opacity-0")}
        />
      ) : (
        <span className="font-game-text text-[10px] text-[#fff6e2]">{choice.id}</span>
      )}
    </div>
  );
}

function ShopPotion({
  choice,
  potionsById,
  index,
  flying,
  beatProgress,
}: {
  choice: ReplayChoice | undefined;
  potionsById?: Record<string, CodexPotion>;
  index: number;
  flying?: boolean;
  beatProgress?: number;
}) {
  if (!choice?.id) return null;
  const potion = lookupHistoryPotion(potionsById, choice.id);
  const hideIcon = flying && (beatProgress ?? 0) > 0.12;
  return (
    <div
      data-history-last-scene-pick={choice.id}
      data-picked={choice.picked ? "true" : "false"}
      className={cn(
        "absolute flex items-center justify-center transition-all duration-300",
        choice.picked ? "z-10 scale-110" : "opacity-85",
      )}
      style={{
        left: pct(POTION_ORIGIN.x + index * SLOT_GAP, RUG_W),
        top: pct(POTION_ORIGIN.y, RUG_H),
        width: pct(RELIC_SLOT, RUG_W),
        height: pct(RELIC_SLOT, RUG_H),
      }}
    >
      {potion?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={potion.imageUrl}
          alt={potion.name}
          data-history-reward-icon={choice.id}
          className={cn("h-full w-full object-contain", hideIcon && "opacity-0")}
        />
      ) : (
        <span className="font-game-text text-[10px] text-[#fff6e2]">{choice.id}</span>
      )}
    </div>
  );
}

const COLORLESS_CARD_COLORS = new Set(["colorless", "curse", "status", "event", "token"]);

export function splitShopCardRows(
  choices: ReplayChoice[],
  cardsById?: Record<string, CodexCard>,
): { characterCards: ReplayChoice[]; colorlessCards: ReplayChoice[] } {
  if (!cardsById) {
    return {
      characterCards: choices.slice(0, 5),
      colorlessCards: choices.slice(5, 7),
    };
  }
  const characterCards: ReplayChoice[] = [];
  const colorlessCards: ReplayChoice[] = [];
  for (const choice of choices) {
    const card = lookupHistoryCard(cardsById, choice.id);
    if (card && COLORLESS_CARD_COLORS.has(card.color)) colorlessCards.push(choice);
    else characterCards.push(choice);
  }
  return {
    characterCards: characterCards.slice(0, 5),
    colorlessCards: colorlessCards.length > 0
      ? colorlessCards.slice(0, 2)
      : characterCards.slice(5, 7),
  };
}

export function MerchantShopScreen({
  characterCards,
  colorlessCards,
  relics,
  potions,
  removalUsed,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  entry,
  beatProgress = 1,
  step = 0,
}: {
  characterCards: ReplayChoice[];
  colorlessCards: ReplayChoice[];
  relics: ReplayChoice[];
  potions: ReplayChoice[];
  removalUsed: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  entry?: ReplayHistoryEntry;
  beatProgress?: number;
  step?: number;
}) {
  const flying = entry ? shopObtainsAtStep(entry, step) : [];
  const flyingIds = new Set(flying.map((item) => item.id));
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-history-merchant-shop>
      {/* NMerchantInventory backstop modulate.a = 0.8 */}
      <div className="absolute inset-0 bg-black/80" />
      {/* Open rug: y=80 on 1080p, width 1747/1920 */}
      <div
        className="absolute left-1/2 w-[91%] max-w-[1747px] -translate-x-1/2"
        style={{ top: "7.4%" }}
      >
        <div className="relative aspect-[1747/978] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RUG} alt="" className="absolute inset-0 h-full w-full" aria-hidden />
          {CHARACTER_CARDS.map((slot, index) => (
            <ShopCard
              key={`c-${index}`}
              choice={characterCards[index]}
              cardsById={cardsById}
              serviceLocale={serviceLocale}
              left={slot.x}
              top={slot.y}
              flying={Boolean(characterCards[index]?.id && flyingIds.has(characterCards[index]!.id))}
              beatProgress={beatProgress}
            />
          ))}
          {COLORLESS_CARDS.map((slot, index) => (
            <ShopCard
              key={`n-${index}`}
              choice={colorlessCards[index]}
              cardsById={cardsById}
              serviceLocale={serviceLocale}
              left={slot.x}
              top={slot.y}
              flying={Boolean(colorlessCards[index]?.id && flyingIds.has(colorlessCards[index]!.id))}
              beatProgress={beatProgress}
            />
          ))}
          {Array.from({ length: 3 }, (_, index) => (
            <ShopRelic
              key={`r-${index}`}
              choice={relics[index]}
              relicsById={relicsById}
              index={index}
              flying={Boolean(relics[index]?.id && flyingIds.has(relics[index]!.id))}
              beatProgress={beatProgress}
            />
          ))}
          {Array.from({ length: 3 }, (_, index) => (
            <ShopPotion
              key={`p-${index}`}
              choice={potions[index]}
              potionsById={potionsById}
              index={index}
              flying={Boolean(potions[index]?.id && flyingIds.has(potions[index]!.id))}
              beatProgress={beatProgress}
            />
          ))}
          <div
            className="absolute"
            style={{
              left: pct(REMOVAL.x, RUG_W),
              top: pct(REMOVAL.y, RUG_H),
              width: pct(REMOVAL.w, RUG_W),
              height: pct(REMOVAL.h, RUG_H),
            }}
            data-history-last-scene-pick="card-removal"
            data-picked={removalUsed ? "true" : "false"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={removalUsed ? REMOVAL_USED : REMOVAL_AVAILABLE}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
      {/* scenes/ui/back_button.tscn — bottom-left of the screen */}
      <div
        className="absolute"
        style={{ left: "1.5%", bottom: "22%", width: "10.4%", maxWidth: "10rem" }}
      >
        <div className="relative aspect-[256/131] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACK} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center pl-[18%] pt-[4%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BACK_ARROW} alt="" className="h-[55%] w-[40%] object-contain" />
          </div>
        </div>
      </div>
      {flying.map((item) => {
        const relic = item.kind === "relic" ? lookupHistoryRelic(relicsById, item.id) : undefined;
        const potion = item.kind === "potion" ? lookupHistoryPotion(potionsById, item.id) : undefined;
        const card = item.kind === "card" && cardsById ? lookupHistoryCard(cardsById, item.id) : undefined;
        const shopCard = item.kind === "card"
          ? (entry?.card_choices ?? []).find((choice) => choice.id === item.id)
          : undefined;
        const iconUrl =
          item.kind === "relic"
            ? (relic ? resolveRelicDisplayImage(relic, relic.pool) : null)
            : item.kind === "potion"
              ? potion?.imageUrl
              : card?.imageUrl;
        if (!iconUrl && item.kind !== "card") return null;
        return (
          <LastSceneObtainFly
            key={`${item.kind}:${item.id}`}
            active
            progress={beatProgress}
            sourceSelector={
              item.kind === "card"
                ? `[data-history-last-scene-pick="${cssEscapeAttr(item.id)}"]`
                : `[data-history-reward-icon="${cssEscapeAttr(item.id)}"]`
            }
            targetSelector={
              item.kind === "relic"
                ? relicTargetSelector(item.id)
                : item.kind === "potion"
                  ? "[data-potion-bay]"
                  : "[data-deck-target]"
            }
            iconUrl={iconUrl ?? ""}
            kind={item.kind}
            size={item.kind === "card" ? 120 : 56}
            card={item.kind === "card" ? card : undefined}
            upgradeLevel={shopCard?.upgradeLevel ?? 0}
            serviceLocale={serviceLocale}
          />
        );
      })}
    </div>
  );
}
