"use client";

import type { ReactNode, SyntheticEvent } from "react";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import { HistoryTinyCardIcon } from "@/components/history-course/card-action-icon";
import {
  characterCombatArtSrc,
  restSiteChoiceLabel,
} from "@/lib/history-party";
import {
  LAST_SCENE_PICK_REVEAL,
  roomMonsterIds,
  stripReplayId,
  type LastSceneKind,
} from "@/lib/history-last-scene";
import { lastSceneBackgroundUrl } from "@/lib/history-last-scene-assets";
import { gameOverLoseBanner, gameOverQuote } from "@/lib/game-over-copy";
import type { GameLocale } from "@/lib/i18n";
import { RELIC_INSPECT_REWARD_PANEL, relicInspectFrameUrl } from "@/lib/relic-inspect-assets";
import { lookupHistoryRelic } from "@/lib/history-relic-lookup";
import { prettifyId } from "@/lib/sts2-i18n";
import {
  formatGameTemplate,
  isGameI18nTableName,
  localizeGame,
  localizeGameKey,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";
import type { CodexRelic } from "@/lib/codex-types";
import type { ReplayChoice, ReplayHistoryEntry, ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const GOLD_ICON = "/images/sts2/ui/topbar/top_bar_gold.png";
const MERCHANT = "/images/sts2/npcs/merchant.webp";
const CHEST = "/images/sts2/map/icons/map_chest.png";
const REST_CAMP = "/images/sts2/run-history/rest_site.png";
const SKULL = "/images/sts2/ui/emote/skull.png";
const CONFIRM_POPUP = "/images/sts2/ui/confirm/popup_vertical.png";
const DIALOGUE_PATCH = "/images/sts2/ancient-dialogue/dialogue_nine_patch.webp";

function relicIconSrc(id: string): string {
  return `/images/sts2/relics/${stripReplayId(id).toLowerCase()}.webp`;
}

function potionIconSrc(id: string): string {
  return `/images/sts2/potions/${stripReplayId(id).toLowerCase()}.webp`;
}

function monsterPortraitSrc(id: string): string {
  return `/images/sts2/monsters-render/${stripReplayId(id).toLowerCase()}.webp`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = "hidden";
}

function choiceLabel(
  choice: ReplayChoice,
  tables: GameI18nTables,
  fallbackTable: "cards" | "relics" | "potions" | "events" | "ancients",
): string {
  if (choice.locTable && isGameI18nTableName(choice.locTable) && choice.locKey) {
    const template = localizeGameKey(tables, choice.locTable, choice.locKey);
    if (template) {
      return choice.locVars ? formatGameTemplate(template, choice.locVars) : template;
    }
  }
  return localizeGame(tables, fallbackTable, choice.id) ?? prettifyId(stripReplayId(choice.id));
}

function SceneArt({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={hideBrokenImage}
    />
  );
}

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
        revealed && picked && "scale-110",
      )}
    >
      {children}
    </div>
  );
}

function RelicSlab({
  id,
  label,
  relicsById,
}: {
  id: string;
  label: string;
  relicsById?: Record<string, CodexRelic>;
}) {
  const relic = lookupHistoryRelic(relicsById, id);
  const frame = relicInspectFrameUrl(relic?.rarity ?? "None");
  return (
    <div className="relative h-28 w-24" title={label}>
      <SceneArt
        src={RELIC_INSPECT_REWARD_PANEL}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <SceneArt
        src={frame}
        className="absolute inset-[8%] h-[84%] w-[84%] object-contain opacity-90"
      />
      <SceneArt
        src={relic?.imageUrl ?? relicIconSrc(id)}
        className="absolute inset-[22%] h-[56%] w-[56%] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
      />
    </div>
  );
}

function RewardPicks({
  entry,
  tables,
  pickReveal,
  includeRemoved,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  includeRemoved?: boolean;
  relicsById?: Record<string, CodexRelic>;
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
  if (
    cards.length === 0 &&
    gained.length === 0 &&
    relics.length === 0 &&
    potions.length === 0 &&
    removed.length === 0 &&
    extraUpgrades.length === 0
  ) {
    return null;
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-center gap-3 transition-opacity duration-300",
        pickReveal ? "opacity-100" : "opacity-0",
      )}
    >
      {cards.map((choice) => (
        <PickedRing key={choice.id} picked={choice.picked} revealed={pickReveal} pickId={choice.id}>
          <HistoryTinyCardIcon id={choice.id} width={92} />
        </PickedRing>
      ))}
      {gained.map((card) => (
        <PickedRing key={`g-${card.id}`} picked revealed={pickReveal} pickId={card.id ?? ""}>
          <HistoryTinyCardIcon id={card.id ?? ""} width={92} />
        </PickedRing>
      ))}
      {extraUpgrades.map((id) => (
        <PickedRing key={`u-${id}`} picked revealed={pickReveal} pickId={id}>
          <HistoryTinyCardIcon id={id} width={80} />
        </PickedRing>
      ))}
      {removed.map((card) => (
        <PickedRing key={`r-${card.id}`} picked revealed={pickReveal} pickId={card.id ?? ""}>
          <HistoryTinyCardIcon id={card.id ?? ""} width={80} />
        </PickedRing>
      ))}
      {relics.map((choice) => (
        <PickedRing key={choice.id} picked={choice.picked} revealed={pickReveal} pickId={choice.id}>
          <RelicSlab
            id={choice.id}
            label={choiceLabel(choice, tables, "relics")}
            relicsById={relicsById}
          />
        </PickedRing>
      ))}
      {potions.map((choice) => (
        <PickedRing key={`p-${choice.id}`} picked={choice.picked} revealed={pickReveal} pickId={choice.id}>
          <div className="relative h-16 w-16">
            <SceneArt
              src={potionIconSrc(choice.id)}
              className="h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            />
          </div>
        </PickedRing>
      ))}
    </div>
  );
}

export function NodeLastScene({
  kind,
  entry,
  run,
  sceneLocalMs,
  sceneDurationMs,
  tables,
  gameLocale,
  leftoverGoldLabel,
  deathLabel,
  hidden,
  actId,
  character,
  relicsById,
}: {
  kind: LastSceneKind;
  entry: ReplayHistoryEntry;
  run: ReplayRun;
  sceneLocalMs: number;
  sceneDurationMs: number;
  tables: GameI18nTables;
  gameLocale: GameLocale;
  leftoverGoldLabel: string;
  deathLabel: string;
  hidden?: boolean;
  actId: string;
  character: string;
  relicsById?: Record<string, CodexRelic>;
}) {
  if (hidden || kind === "stack") return null;
  const t = clamp01(sceneLocalMs / Math.max(1, sceneDurationMs));
  const pickReveal = t >= LAST_SCENE_PICK_REVEAL;
  const modelId = entry.rooms?.[0]?.model_id;
  const backgroundUrl = lastSceneBackgroundUrl({ kind, modelId, actId });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
      data-history-last-scene={kind}
      data-progress={t.toFixed(2)}
    >
      <SceneArt
        src={backgroundUrl}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {kind === "death" ? <div className="absolute inset-0 bg-red-950/55" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />

      <div className="absolute inset-x-0 bottom-20 top-24 flex flex-col items-center justify-end px-6">
        {kind === "combat" ? (
          <CombatScene
            entry={entry}
            tables={tables}
            t={t}
            pickReveal={pickReveal}
            character={character}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "shop" ? (
          <ShopScene
            entry={entry}
            tables={tables}
            pickReveal={pickReveal}
            leftoverGoldLabel={leftoverGoldLabel}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "event" ? (
          <EventScene
            entry={entry}
            tables={tables}
            pickReveal={pickReveal}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "ancient" ? (
          <AncientScene
            entry={entry}
            tables={tables}
            pickReveal={pickReveal}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "treasure" ? (
          <TreasureScene
            entry={entry}
            tables={tables}
            t={t}
            pickReveal={pickReveal}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "rest" ? (
          <RestScene
            entry={entry}
            tables={tables}
            gameLocale={gameLocale}
            pickReveal={pickReveal}
            relicsById={relicsById}
          />
        ) : null}
        {kind === "death" ? (
          <DeathScene
            entry={entry}
            run={run}
            tables={tables}
            gameLocale={gameLocale}
            deathLabel={deathLabel}
            character={character}
          />
        ) : null}
      </div>
    </div>
  );
}

function CombatScene({
  entry,
  tables,
  t,
  pickReveal,
  character,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  t: number;
  pickReveal: boolean;
  character: string;
  relicsById?: Record<string, CodexRelic>;
}) {
  const monsters = roomMonsterIds(entry);
  return (
    <div className="relative h-full w-full">
      <SceneArt
        src={characterCombatArtSrc(character)}
        className="absolute bottom-[4%] left-[2%] h-[72%] w-[30%] object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)]"
      />
      {monsters.map((id, index) => {
        const dieAt = 0.12 + index * 0.08;
        const dead = t >= dieAt;
        const count = Math.max(monsters.length, 1);
        const left = 48 + (index * 38) / count;
        return (
          <div
            key={`${id}-${index}`}
            className={cn(
              "absolute bottom-[10%] h-[58%] w-[22%] transition-all duration-500",
              dead && "rich-jitter",
            )}
            style={{
              left: `${left}%`,
              opacity: dead ? 0 : 1,
              transform: dead ? "translateY(18px) scale(0.82)" : "none",
            }}
          >
            <SceneArt
              src={monsterPortraitSrc(id)}
              alt={prettifyId(stripReplayId(id))}
              className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
            />
          </div>
        );
      })}
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <RewardPicks
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          relicsById={relicsById}
        />
      </div>
    </div>
  );
}

function ShopScene({
  entry,
  tables,
  pickReveal,
  leftoverGoldLabel,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  leftoverGoldLabel: string;
  relicsById?: Record<string, CodexRelic>;
}) {
  const gold = entry.current_gold;
  return (
    <div className="relative h-full w-full">
      <SceneArt
        src={MERCHANT}
        className="absolute bottom-[8%] right-[4%] h-[70%] w-[32%] object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3">
        <RewardPicks
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          includeRemoved
          relicsById={relicsById}
        />
        {typeof gold === "number" ? (
          <div
            className="flex items-center gap-2 font-game-text text-sm text-amber-100"
            data-history-leftover-gold={gold}
          >
            <SceneArt src={GOLD_ICON} className="h-5 w-5 object-contain" />
            {leftoverGoldLabel.replace("{gold}", String(gold))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EventScene({
  entry,
  tables,
  pickReveal,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  relicsById?: Record<string, CodexRelic>;
}) {
  const title =
    localizeGame(tables, "events", entry.rooms?.[0]?.model_id) ??
    prettifyId(stripReplayId(entry.rooms?.[0]?.model_id ?? "event"));
  return (
    <div className="flex h-full w-full max-w-xl flex-col justify-end gap-3 self-end pb-2">
      <div
        className="font-game-title text-2xl text-[#f3c640]"
        style={{ textShadow: "3px 2px 0 rgba(0,0,0,0.45)" }}
      >
        {title}
      </div>
      <ChoiceList
        choices={entry.event_choices ?? []}
        tables={tables}
        table="events"
        pickReveal={pickReveal}
      />
      <RewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        relicsById={relicsById}
      />
    </div>
  );
}

function AncientScene({
  entry,
  tables,
  pickReveal,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  relicsById?: Record<string, CodexRelic>;
}) {
  const title =
    localizeGame(tables, "ancients", entry.rooms?.[0]?.model_id) ??
    localizeGame(tables, "events", entry.rooms?.[0]?.model_id) ??
    prettifyId(stripReplayId(entry.rooms?.[0]?.model_id ?? "ancient"));
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-3">
      <div
        className="min-w-[18rem] px-6 py-3 font-game-title text-xl text-[#f3c640]"
        style={{
          backgroundImage: `url(${DIALOGUE_PATCH})`,
          backgroundSize: "100% 100%",
          textShadow: "3px 2px 0 rgba(0,0,0,0.45)",
        }}
      >
        {title}
      </div>
      <ChoiceList
        choices={entry.ancient_choice ?? []}
        tables={tables}
        table="ancients"
        pickReveal={pickReveal}
      />
      <RewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        relicsById={relicsById}
      />
    </div>
  );
}

function TreasureScene({
  entry,
  tables,
  t,
  pickReveal,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  t: number;
  pickReveal: boolean;
  relicsById?: Record<string, CodexRelic>;
}) {
  const open = t >= 0.28;
  return (
    <div className="flex flex-col items-center gap-4">
      <SceneArt
        src={CHEST}
        className={cn(
          "h-28 w-36 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.75)] transition-all duration-500",
          open && "scale-125 opacity-0",
        )}
      />
      <RewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        relicsById={relicsById}
      />
    </div>
  );
}

function RestScene({
  entry,
  tables,
  gameLocale,
  pickReveal,
  relicsById,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  gameLocale: GameLocale;
  pickReveal: boolean;
  relicsById?: Record<string, CodexRelic>;
}) {
  const choices = entry.rest_site_choices ?? [];
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <SceneArt
        src={REST_CAMP}
        className="h-24 w-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.7)]"
      />
      <div className="flex w-full flex-col gap-2">
        {choices.map((choice) => (
          <div key={choice} data-history-last-scene-pick={choice} data-picked="true">
            <GameChoiceFrame active={pickReveal}>
              <span className="font-game-text text-base text-[#f4efe2]">
                {restSiteChoiceLabel(choice, gameLocale)}
              </span>
            </GameChoiceFrame>
          </div>
        ))}
      </div>
      <RewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        relicsById={relicsById}
      />
    </div>
  );
}

function ChoiceList({
  choices,
  tables,
  table,
  pickReveal,
}: {
  choices: ReplayChoice[];
  tables: GameI18nTables;
  table: "events" | "ancients";
  pickReveal: boolean;
}) {
  if (choices.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-2">
      {choices.map((choice) => (
        <div
          key={choice.id}
          data-history-last-scene-pick={choice.id}
          data-picked={choice.picked ? "true" : "false"}
          className={cn(
            "transition-opacity duration-300",
            pickReveal && !choice.picked && "opacity-40",
          )}
        >
          <GameChoiceFrame active={pickReveal && choice.picked}>
            <span className="font-game-text text-base leading-snug text-[#f4efe2]">
              {choiceLabel(choice, tables, table)}
            </span>
          </GameChoiceFrame>
        </div>
      ))}
    </div>
  );
}

function DeathScene({
  entry,
  run,
  tables,
  gameLocale,
  deathLabel,
  character,
}: {
  entry: ReplayHistoryEntry;
  run: ReplayRun;
  tables: GameI18nTables;
  gameLocale: GameLocale;
  deathLabel: string;
  character: string;
}) {
  const salt = Math.round((entry.current_hp ?? 0) + (entry.damage_taken ?? 0) + run.seed.length);
  const banner = gameOverLoseBanner(gameLocale, salt);
  const quote = gameOverQuote(gameLocale, salt + 3);
  const causeId = run.killed_by_encounter ?? run.killed_by_event ?? entry.rooms?.[0]?.model_id;
  const cause =
    localizeGame(tables, "encounters", causeId) ??
    localizeGame(tables, "events", causeId) ??
    (causeId ? prettifyId(stripReplayId(causeId)) : deathLabel);
  return (
    <div className="relative flex w-full max-w-sm flex-col items-center gap-3">
      <SceneArt
        src={characterCombatArtSrc(character)}
        className="rich-jitter h-40 w-32 object-contain object-bottom opacity-80"
      />
      <div
        className="relative flex w-full flex-col items-center gap-2 px-8 py-8"
        style={{
          backgroundImage: `url(${CONFIRM_POPUP})`,
          backgroundSize: "100% 100%",
        }}
      >
        <SceneArt src={SKULL} className="h-10 w-10 object-contain" />
        <div className="rich-jitter font-game-title text-2xl text-red-100">
          {banner}
        </div>
        <div className="font-game-text text-sm text-zinc-100">{cause}</div>
        {quote ? (
          <div className="font-game-text text-xs text-zinc-300">{quote}</div>
        ) : null}
      </div>
    </div>
  );
}
