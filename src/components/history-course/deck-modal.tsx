"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CardTile } from "@/components/codex/card-tile";
import type { HistoryDeckCopy } from "@/components/history-course/topbar-state";
import type { CodexCard } from "@/lib/codex-types";
import { useGameI18n } from "@/hooks/use-game-i18n";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { historyCardEnchantmentTileProps } from "@/lib/history-enchantments";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryCardVisual } from "@/lib/history-card-visuals";
import { CHAR_FRAME_HSV, TEXT_GOLD, hsvToFilter, type HSV } from "@/lib/sts2-card-style";
import { gameUi, localizeGame } from "@/lib/sts2-game-i18n";
import { serviceMessages } from "@/messages/service";

const SORT_KEYS = ["obtained", "type", "cost", "alphabet"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const CARD_TYPE_ORDER: Record<string, number> = {
  공격: 1,
  스킬: 2,
  파워: 3,
  상태이상: 4,
  저주: 5,
  퀘스트: 6,
};

const SORT_LABEL_KEYS: Record<SortKey, { ui: string; fallback: string }> = {
  obtained: { ui: "sortObtained", fallback: "Obtained" },
  type: { ui: "sortType", fallback: "Card Type" },
  cost: { ui: "sortCost", fallback: "Cost" },
  alphabet: { ui: "sortAlphabet", fallback: "A - Z" },
};

function characterFrameHsv(character: string | undefined): HSV {
  const key = (character ?? "").replace(/^CHARACTER\./, "").toLowerCase();
  if (key === "random" || key === "random_character" || key === "deprived") {
    return CHAR_FRAME_HSV.ironclad;
  }
  return CHAR_FRAME_HSV[key as keyof typeof CHAR_FRAME_HSV] ?? CHAR_FRAME_HSV.ironclad;
}

function canonicalEnergyCost(card: CodexCard | null): number {
  if (!card) return 0;
  return card.isXCost ? 0 : card.cost;
}

function upgradedTitle(
  name: string,
  upgradeLevel: number,
  maxUpgradeLevel: number,
): string {
  if (upgradeLevel < 1) return name;
  if (maxUpgradeLevel > 1) return `${name}+${upgradeLevel}`;
  return `${name}+`;
}

interface DeckModalProps {
  open: boolean;
  onClose: () => void;
  copies: HistoryDeckCopy[];
  cardsById: Record<string, CodexCard>;
  currentFloor: number;
  character?: string;
}

export function DeckModal({
  open,
  onClose,
  copies,
  cardsById,
  currentFloor,
  character,
}: DeckModalProps) {
  const tables = useGameI18n();
  const gameLocale = useGameLocale();
  const serviceLocale = useServiceLocale();
  const playback = serviceMessages[serviceLocale].historyCourse.detail.playback;
  const hsv = characterFrameHsv(character);

  const [descending, setDescending] = useState<Record<SortKey, boolean>>({
    obtained: false,
    type: false,
    cost: false,
    alphabet: false,
  });
  const [priority, setPriority] = useState<SortKey[]>([
    "obtained",
    "type",
    "cost",
    "alphabet",
  ]);
  const [viewUpgrades, setViewUpgrades] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDescending({ obtained: false, type: false, cost: false, alphabet: false });
      setPriority(["obtained", "type", "cost", "alphabet"]);
      setViewUpgrades(false);
    }
  }

  const sorted = useMemo(() => {
    const items = copies.map((copy, pileIndex) => {
      const card = lookupHistoryCard(cardsById, copy.id) ?? null;
      return { copy, card, pileIndex };
    });
    const primary = priority[0] ?? "obtained";
    if (primary === "obtained") {
      return descending.obtained ? [...items].reverse() : items;
    }

    const collator = new Intl.Collator(gameLocale === "kor" ? "ko" : gameLocale, {
      sensitivity: "variant",
    });
    return [...items].sort((a, b) => {
      for (const key of priority) {
        const dir = descending[key] ? -1 : 1;
        let cmp = 0;
        if (key === "obtained") {
          cmp = a.pileIndex - b.pileIndex;
        } else if (key === "type") {
          const ta = CARD_TYPE_ORDER[a.card?.type ?? lookupHistoryCardVisual(a.copy.id)?.type ?? ""] ?? 0;
          const tb = CARD_TYPE_ORDER[b.card?.type ?? lookupHistoryCardVisual(b.copy.id)?.type ?? ""] ?? 0;
          cmp = ta - tb;
        } else if (key === "cost") {
          cmp = canonicalEnergyCost(a.card) - canonicalEnergyCost(b.card);
        } else {
          const na = upgradedTitle(
            localizeGame(tables, "cards", a.copy.id) ?? a.card?.name ?? a.copy.id,
            a.copy.upgradeLevel,
            a.card?.maxUpgradeLevel ?? 1,
          );
          const nb = upgradedTitle(
            localizeGame(tables, "cards", b.copy.id) ?? b.card?.name ?? b.copy.id,
            b.copy.upgradeLevel,
            b.card?.maxUpgradeLevel ?? 1,
          );
          cmp = collator.compare(na, nb);
        }
        if (cmp !== 0) return cmp * dir;
      }
      return a.copy.id.localeCompare(b.copy.id);
    });
  }, [copies, cardsById, priority, descending, gameLocale, tables]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label={playback.close}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-[3px]"
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 sm:p-10">
        <div className="pointer-events-auto relative w-full max-w-6xl rounded-xl border border-border bg-background p-5 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                {playback.currentDeck}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {playback.deckFloor
                  .replace("{floor}", String(currentFloor))
                  .replace("{count}", String(copies.length))}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {SORT_KEYS.map((key) => (
                  <DeckViewSortButton
                    key={key}
                    label={gameUi(tables, SORT_LABEL_KEYS[key].ui, SORT_LABEL_KEYS[key].fallback)}
                    descending={descending[key]}
                    active={priority[0] === key}
                    hsv={hsv}
                    onClick={() => {
                      setDescending((current) => ({ ...current, [key]: !current[key] }));
                      setPriority((current) => [key, ...current.filter((item) => item !== key)]);
                    }}
                  />
                ))}
              </div>
              <DeckViewTickbox
                checked={viewUpgrades}
                label={gameUi(tables, "viewUpgrades", "View Upgrades")}
                onToggle={() => setViewUpgrades((value) => !value)}
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
              >
                {playback.close}
              </button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p className="mt-12 text-center text-sm text-muted-foreground">
              {playback.emptyFilter}
            </p>
          ) : (
            <div
              className="mt-5 grid justify-center gap-x-12 gap-y-7 px-6"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(160px, max-content))",
                placeContent: "start center",
              }}
            >
              {sorted.map((item, index) => {
                const maxLevel = item.card?.maxUpgradeLevel ?? 1;
                const preview =
                  viewUpgrades && item.copy.upgradeLevel < maxLevel;
                const displayLevel = preview
                  ? item.copy.upgradeLevel + 1
                  : item.copy.upgradeLevel;
                const enchant = historyCardEnchantmentTileProps(
                  item.copy.enchantmentId,
                  item.copy.enchantmentAmount,
                  gameLocale,
                );
                return item.card ? (
                  <CardTile
                    key={`${item.copy.id}-${item.pileIndex}-${index}`}
                    card={localizeDeckCard(item.card, tables, gameLocale)}
                    showUpgrade={displayLevel > 0}
                    upgradeLevel={displayLevel}
                    showBeta={false}
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
                  <UnknownCardTile key={`${item.copy.id}-${item.pileIndex}`} id={item.copy.id} />
                );
              })}
            </div>
          )}
          <p className="mt-6 text-center text-xs text-zinc-400">
            {gameUi(tables, "deckPileInfo", "You will start combat with all of these cards.")}
          </p>
        </div>
      </div>
    </>
  );
}

function DeckViewSortButton({
  label,
  descending,
  active,
  hsv,
  onClick,
}: {
  label: string;
  descending: boolean;
  active: boolean;
  hsv: HSV;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="relative flex h-8 min-w-[7.5rem] items-center px-2.5 pr-8"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/images/sts2/ui/deck-view/color_tab_bar.png)",
          backgroundSize: "100% 100%",
          filter: hsvToFilter({
            h: hsv.h,
            s: active ? 1 : 0.8,
            v: active ? hsv.v : Math.min(hsv.v, 0.8),
          }),
        }}
      />
      <span
        className="relative truncate font-game-title text-[15px] font-bold leading-none"
        style={{ color: TEXT_GOLD, textShadow: "2px 2px 0 rgba(0,0,0,0.82)" }}
      >
        {label}
      </span>
      <Image
        src="/images/sts2/ui/deck-view/sort_descending.png"
        alt=""
        width={89}
        height={64}
        className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-auto"
        style={{
          transform: `translateY(-50%) scaleY(${descending ? 1 : -1})`,
          imageRendering: "pixelated",
        }}
        unoptimized
      />
    </button>
  );
}

function DeckViewTickbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex items-center gap-1.5 px-1 py-0.5"
    >
      <Image
        src={
          checked
            ? "/images/sts2/ui/deck-view/checkbox_ticked.png"
            : "/images/sts2/ui/deck-view/checkbox_unticked.png"
        }
        alt=""
        width={64}
        height={64}
        className="h-7 w-7"
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
      <span
        className="font-game-title text-[15px] font-bold leading-none"
        style={{ color: TEXT_GOLD, textShadow: "2px 2px 0 rgba(0,0,0,0.82)" }}
      >
        {label}
      </span>
    </button>
  );
}

function localizeDeckCard(
  card: CodexCard,
  tables: ReturnType<typeof useGameI18n>,
  gameLocale: ReturnType<typeof useGameLocale>,
): CodexCard {
  const name = localizeGame(tables, "cards", card.id) ?? card.name;
  if (gameLocale === "kor") return { ...card, name };
  return {
    ...card,
    name,
    description: card.descriptionEn || card.description,
    descriptionRaw: card.descriptionRawEn || card.descriptionRaw,
    typeLabel:
      card.type === "공격"
        ? gameUi(tables, "cardTypeAttack", card.typeLabel)
        : card.type === "스킬"
          ? gameUi(tables, "cardTypeSkill", card.typeLabel)
          : card.type === "파워"
            ? gameUi(tables, "cardTypePower", card.typeLabel)
            : card.type === "저주"
              ? gameUi(tables, "cardTypeCurse", card.typeLabel)
              : gameUi(tables, "cardTypeStatus", card.typeLabel),
  };
}

function UnknownCardTile({ id }: { id: string }) {
  const tables = useGameI18n();
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  const label = localizeGame(tables, "cards", id) ?? id.replace(/^CARD\./, "");
  return (
    <div className="flex aspect-[2/3] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-center">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {playback.unregistered}
      </p>
      <p className="mt-1 text-xs text-foreground">{label}</p>
    </div>
  );
}
