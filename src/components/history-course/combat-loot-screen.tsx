"use client";

import { RichText } from "@/components/rich-text";
import { HistoryEntityPreview } from "@/components/history-course/history-entity-preview";
import { lookupHistoryPotion, buildPotionEntityInfo } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic, buildRelicEntityInfo } from "@/lib/history-relic-lookup";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import {
  gameplayUiTemplate,
  gameplayUiText,
} from "@/lib/history-gameplay-ui";
import type { CombatLootSpec } from "@/lib/history-last-scene-steps";
import type { CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import { cn } from "@/lib/utils";

const PANEL = "/images/sts2/ui/reward-screen/reward_panel.webp";
const BANNER = "/images/sts2/ui/reward-screen/reward_banner.webp";
const ITEM = "/images/sts2/ui/reward-screen/reward_item_button.webp";
const PROCEED = "/images/sts2/ui/reward-screen/proceed_button.webp";
const ICON_GOLD = "/images/sts2/ui/reward-screen/reward_icon_money.webp";
const ICON_REMOVAL = "/images/sts2/ui/reward-screen/reward_icon_card_removal.webp";
const RETICLE = "/images/sts2/ui/combat/combat_reticle.webp";

function SelectionReticle() {
  return (
    <div className="pointer-events-none absolute -inset-[6px]" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute left-0 top-0 h-5 w-5" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute right-0 top-0 h-5 w-5 -scale-x-100" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute bottom-0 left-0 h-5 w-5 -scale-y-100" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={RETICLE} alt="" className="absolute bottom-0 right-0 h-5 w-5 -scale-100" />
    </div>
  );
}

function LootRow({
  pickId,
  picked,
  revealed,
  active,
  iconUrl,
  title,
}: {
  pickId: string;
  picked: boolean;
  revealed: boolean;
  active: boolean;
  iconUrl: string;
  title: string;
}) {
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      data-history-reward-item={pickId.split(":")[0]}
      className={cn(
        "relative w-full max-w-[402px] transition-all duration-300",
        !revealed && "pointer-events-none translate-y-2 opacity-0",
        revealed && !active && !picked && "opacity-40",
      )}
      style={{ aspectRatio: "910 / 196" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ITEM}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
        aria-hidden
      />
      {active ? <SelectionReticle /> : null}
      <div className="relative flex h-full items-center gap-2 pl-3 pr-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11" />
        <div
          className="min-w-0 flex-1 font-game-text text-[17px] leading-[1.1] text-[#fff6e2] sm:text-[20px]"
          style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.06)", WebkitTextStroke: "0.4px #225155" }}
        >
          <RichText text={title} />
        </div>
      </div>
    </div>
  );
}

export function CombatLootScreen({
  items,
  revealedCount,
  gameLocale,
  locTables,
  relicsById,
  potionsById,
}: {
  items: CombatLootSpec[];
  revealedCount: number;
  gameLocale: GameLocale;
  locTables?: HistoryLocTables | null;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
}) {
  const header = gameplayUiText(gameLocale, "COMBAT_REWARD_HEADER_LOOT", "Loot!", locTables);
  const proceed = gameplayUiText(gameLocale, "PROCEED_BUTTON", "Proceed", locTables);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-history-combat-loot
    >
      <div className="absolute inset-0 bg-black/80" />
      {/* rewards_screen.tscn Rewards: 526×640, centered */}
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
              className="flex h-full items-center justify-center px-[18%] pb-[8%] font-game-title text-[28px] text-[#fff6e2] sm:text-[34px]"
              style={{
                textShadow: "6px 5px 0 rgba(0,0,0,0.12)",
                WebkitTextStroke: "1px rgba(74,60,42,0.75)",
              }}
            >
              {header}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2.5 pt-6">
            {items.map((item, index) => {
              const revealed = index < revealedCount;
              const active = index === revealedCount - 1;
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
                    revealed={revealed}
                    active={active}
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
                    revealed={revealed}
                    active={active}
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
                    revealed={revealed}
                    active={active}
                    iconUrl={iconUrl}
                    title={relic?.name ?? item.choice.id}
                  />
                );
                return relic && entity ? (
                  <HistoryEntityPreview key={item.choice.id} entity={entity}>
                    {row}
                  </HistoryEntityPreview>
                ) : (
                  <div key={item.choice.id}>{row}</div>
                );
              }
              if (item.kind !== "potion") return null;
              const potion = lookupHistoryPotion(potionsById, item.choice.id);
              const entity = buildPotionEntityInfo(potion);
              const row = (
                <LootRow
                  pickId={item.choice.id}
                  picked={item.choice.picked}
                  revealed={revealed}
                  active={active}
                  iconUrl={potion?.imageUrl ?? ICON_GOLD}
                  title={potion?.name ?? item.choice.id}
                />
              );
              return potion && entity ? (
                <HistoryEntityPreview key={item.choice.id} entity={entity}>
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
            {proceed}
          </div>
        </div>
      </div>
    </div>
  );
}
