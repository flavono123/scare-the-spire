"use client";

import { DescriptionText } from "@/components/codex/codex-description";
import { ShopObtainOverlay } from "@/components/history-course/merchant-shop-screen";
import { blitzShopStateAt } from "@/lib/history-last-scene-steps";
import { merchantRoomTemplate } from "@/lib/history-gameplay-ui";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { ReplayHistoryEntry } from "@/lib/sts2-run-replay";

// merchant_inventory.tscn in Blitz: the rug and its six slot origins (game px on the rug), as the
// compendium's Blitz shop lays them. Each slot's 240 px hitbox is centred on its origin.
const RUG_W = 1747;
const RUG_H = 978;
const RUG_URL = "/images/sts2/blitz-merchant/shop_rug.webp";
const RUG_SLOTS: [number, number][] = [[415, 320], [896, 293], [1291, 355], [437, 679], [831, 637], [1247, 689]];
const SLOT = { left: -121, top: -120, size: 240 };
// SelectionText: anchored at (0.487, 0.937) of the rug, 24 px font, 12 px half-black outline.
const SELECTION = { x: 0.487, y: 0.937, fontSize: 24, outline: 12 };
const BACK = "/images/sts2/ui/back_button.png";
const BACK_ARROW = "/images/sts2/ui/back_button_arrow.png";

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

/** The Blitz merchant's rug: each ware empties its slot when bought, the rest dim once no choice is left. */
export function BlitzMerchantShopScreen({
  entry,
  step,
  beatProgress,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  gameLocale,
  locTables,
}: {
  entry: ReplayHistoryEntry;
  step: number;
  beatProgress: number;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  locTables: HistoryLocTables | null;
}) {
  const wares = entry.blitz_merchant_choices ?? [];
  const { statuses, remaining } = blitzShopStateAt(entry, step, beatProgress);
  const selection = remaining > 0
    ? merchantRoomTemplate(gameLocale, "MERCHANT.blitzSelection.remaining", "{Amount}", { Amount: remaining }, locTables)
    : merchantRoomTemplate(gameLocale, "MERCHANT.blitzSelection.none", "", {}, locTables);
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-history-blitz-merchant>
      {/* NMerchantInventory backstop modulate.a = 0.8 */}
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute left-1/2 w-[91%] max-w-[1747px] -translate-x-1/2" style={{ top: "7.4%" }}>
        <div className="relative aspect-[1747/978] w-full [container-type:inline-size]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RUG_URL} alt="" className="absolute inset-0 h-full w-full" aria-hidden />
          {wares.slice(0, RUG_SLOTS.length).map((ware, index) => {
            const [ox, oy] = RUG_SLOTS[index];
            const status = statuses[index];
            const icon = `/images/sts2/blitz-merchant/entries/entry_${ware.type}.webp`;
            return (
              <div
                key={index}
                data-history-blitz-ware={index}
                data-status={status}
                className="absolute transition-opacity duration-200"
                style={{
                  left: pct(ox + SLOT.left, RUG_W),
                  top: pct(oy + SLOT.top, RUG_H),
                  width: pct(SLOT.size, RUG_W),
                  height: pct(SLOT.size, RUG_H),
                  // The slot stays in the DOM when used: its rewards fly from it.
                  opacity: status === "used" ? 0 : 1,
                  // NBlitzMerchantSlot disabled look.
                  filter: status === "disabled" ? "brightness(0.6627)" : undefined,
                }}
              >
                {/* Slot shadow (offset 20, 16; 25% black) under the ware icon. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={icon} alt="" className="absolute h-full w-full" style={{ left: "8%", top: "6.5%", filter: "brightness(0)", opacity: 0.25 }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={icon} alt={ware.type} className="relative h-full w-full" />
              </div>
            );
          })}
          <div
            className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap font-game-text text-[#fff6e2]"
            style={{
              left: `${SELECTION.x * 100}%`,
              top: `${SELECTION.y * 100}%`,
              fontSize: `${(SELECTION.fontSize / RUG_W) * 100}cqw`,
              WebkitTextStroke: `${(SELECTION.outline / RUG_W) * 100}cqw rgba(0, 0, 0, 0.5)`,
              paintOrder: "stroke fill",
            }}
            data-history-blitz-selection
          >
            <DescriptionText description={selection} />
          </div>
        </div>
      </div>
      {/* scenes/ui/back_button.tscn — bottom-left of the screen */}
      <div className="absolute" style={{ left: "1.5%", bottom: "22%", width: "10.4%", maxWidth: "10rem" }}>
        <div className="relative aspect-[256/131] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACK} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center pl-[18%] pt-[4%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BACK_ARROW} alt="" className="h-[55%] w-[40%] object-contain" />
          </div>
        </div>
      </div>
      <ShopObtainOverlay
        entry={entry}
        step={step}
        beatProgress={beatProgress}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
    </div>
  );
}
