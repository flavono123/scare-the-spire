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
import {
  lastSceneBackgroundUrl,
  lastSceneMonsterSlots,
  monsterStillUrl,
} from "@/lib/history-last-scene-assets";
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
  return monsterStillUrl(id);
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
  hideOnError = true,
}: {
  src: string;
  alt?: string;
  className?: string;
  hideOnError?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={hideOnError ? hideBrokenImage : undefined}
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
      className="pointer-events-none absolute inset-0 z-[18] overflow-hidden bg-black"
      data-history-last-scene={kind}
      data-progress={t.toFixed(2)}
    >
      <SceneArt
        src={backgroundUrl}
        hideOnError={false}
        className={cn(
          "absolute inset-0 h-full w-full",
          kind === "event" ? "object-contain" : "object-cover",
        )}
      />
      {kind === "death" ? <div className="absolute inset-0 bg-red-950/55" /> : null}

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
  const slots = lastSceneMonsterSlots(entry.rooms?.[0]?.model_id);
  return (
    <div className="absolute inset-0">
      <SceneArt
        src={characterCombatArtSrc(character)}
        className="absolute bottom-[8%] left-[6%] h-[62%] w-[22%] object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)]"
      />
      {monsters.map((id, index) => {
        const dieAt = 0.12 + index * 0.08;
        const dead = t >= dieAt;
        const slot = slots[index];
        const count = Math.max(monsters.length, 1);
        return (
          <div
            key={`${id}-${index}`}
            className={cn(
              "absolute h-[52%] w-[20%] transition-all duration-500",
              dead && "rich-jitter",
            )}
            style={
              slot
                ? {
                    left: `${slot.leftPct}%`,
                    top: `${slot.topPct}%`,
                    opacity: dead ? 0 : 1,
                    transform: dead
                      ? "translate(-50%, -70%) scale(0.82)"
                      : "translate(-50%, -100%)",
                  }
                : {
                    left: `${48 + (index * 38) / count}%`,
                    bottom: "10%",
                    opacity: dead ? 0 : 1,
                    transform: dead ? "translateY(18px) scale(0.82)" : "none",
                  }
            }
          >
            <SceneArt
              src={monsterPortraitSrc(id)}
              alt={prettifyId(stripReplayId(id))}
              className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
            />
          </div>
        );
      })}
      <HudSafe>
        <RewardPicks
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          relicsById={relicsById}
        />
      </HudSafe>
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
    <div className="absolute inset-0">
      <SceneArt
        src={MERCHANT}
        className="absolute bottom-[6%] right-[4%] h-[78%] w-[38%] object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      />
      <HudSafe>
        <div className="flex flex-col items-center gap-3">
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
      </HudSafe>
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
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/25 to-transparent" />
      <ChoicePanel>
        <div
          className="font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
          style={{ textShadow: "3px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.75)" }}
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
      </ChoicePanel>
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
  const modelId = entry.rooms?.[0]?.model_id;
  const title =
    localizeGame(tables, "ancients", modelId) ??
    localizeGame(tables, "events", modelId) ??
    prettifyId(stripReplayId(modelId ?? "ancient"));
  return (
    <div className="absolute inset-0">
      <ChoicePanel>
        <div
          className="px-5 py-2 font-game-title text-2xl text-[#f3c640]"
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
      </ChoicePanel>
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
    <div className="absolute inset-0">
      <SceneArt
        src={CHEST}
        className={cn(
          "absolute bottom-[22%] left-1/2 h-40 w-52 -translate-x-1/2 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.75)] transition-all duration-500",
          open && "scale-125 opacity-0",
        )}
      />
      <HudSafe>
        <RewardPicks
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          relicsById={relicsById}
        />
      </HudSafe>
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
    <div className="absolute inset-0">
      <SceneArt
        src={REST_CAMP}
        className="absolute bottom-[18%] left-[12%] h-44 w-44 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-transparent" />
      <ChoicePanel>
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
      </ChoicePanel>
    </div>
  );
}

function HudSafe({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-20 top-24 flex flex-col items-center justify-end px-6">
      {children}
    </div>
  );
}

function ChoicePanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-4 bottom-20 top-24 z-10 flex min-w-0 flex-col justify-end gap-3 sm:inset-x-auto sm:right-[3.5%] sm:w-[min(28rem,42%)]">
      {children}
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
    <div className="absolute inset-0">
      <SceneArt
        src={characterCombatArtSrc(character)}
        className="rich-jitter absolute bottom-[8%] left-[8%] h-[55%] w-[22%] object-contain object-bottom opacity-80"
      />
      <HudSafe>
        <div className="relative flex w-full max-w-sm flex-col items-center gap-3">
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
      </HudSafe>
    </div>
  );
}
