"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import dynamic from "next/dynamic";
import { CombatRewardPicks } from "@/components/history-course/combat-reward-picks";
import { EventRoomArt } from "@/components/history-course/event-room-art";
import {
  GameRoomChoiceList,
  GameRoomChoicePanel,
} from "@/components/history-course/game-room-choice";
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
import { matchEncounterFormationIndex } from "@/lib/history-encounter-match";
import {
  loadHistoryLastSceneCatalog,
  lookupHistoryAncient,
  lookupHistoryCharacter,
  lookupHistoryEncounter,
  lookupHistoryEvent,
  type HistoryLastSceneCatalog,
} from "@/lib/history-last-scene-catalog";
import { historyRoomChoiceCopy, eventOpeningDescription } from "@/lib/history-room-choice";
import { historyEventVfxSlug } from "@/lib/history-event-vfx";
import { getHistoryCourseCatalog } from "@/lib/history-course-catalog";
import { gameOverLoseBanner, gameOverQuote } from "@/lib/game-over-copy";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { useOptionalHistoryCatalogLocale } from "@/hooks/use-history-catalog-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { localizeGame, type GameI18nTables } from "@/lib/sts2-game-i18n";
import { prettifyId } from "@/lib/sts2-i18n";
import type { CodexCard, CodexEnchantment, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { ReplayChoice, ReplayHistoryEntry, ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import type { HistoryLocTables } from "@/lib/history-loc-tables";

const EncounterSceneStage = dynamic(
  () => import("@/components/codex/encounter-scene-stage").then((mod) => mod.EncounterSceneStage),
  { ssr: false },
);
const AncientSceneStage = dynamic(
  () => import("@/components/codex/ancient-scene-stage").then((mod) => mod.AncientSceneStage),
  { ssr: false },
);
const EventVfxStage = dynamic(
  () => import("@/components/codex/event-vfx-stage").then((mod) => mod.EventVfxStage),
  { ssr: false },
);
const FakeMerchantSpineStage = dynamic(
  () => import("@/components/codex/fake-merchant-spine-stage").then((mod) => mod.FakeMerchantSpineStage),
  { ssr: false },
);

const MERCHANT = "/images/sts2/npcs/merchant.webp";
const CHEST = "/images/sts2/map/icons/map_chest.png";
const REST_CAMP = "/images/sts2/run-history/rest_site.png";
const SKULL = "/images/sts2/ui/emote/skull.png";
const CONFIRM_POPUP = "/images/sts2/ui/confirm/popup_vertical.png";

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = "hidden";
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function HudSafe({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-20 top-24 z-20 flex flex-col items-center justify-end px-4">
      {children}
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
  cardsById,
  relicsById,
  potionsById,
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
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
}) {
  const serviceLocale = useServiceLocale();
  const locTables = useOptionalHistoryCatalogLocale()?.locTables ?? null;
  const [sceneCatalog, setSceneCatalog] = useState<HistoryLastSceneCatalog | null>(null);
  const catalogResources = useMemo(() => getHistoryCourseCatalog(), []);
  const monsters = catalogResources.allMonsters;
  const enchantments = catalogResources.allEnchantments;

  useEffect(() => {
    let cancelled = false;
    void loadHistoryLastSceneCatalog().then((catalog) => {
      if (!cancelled) setSceneCatalog(catalog);
    }).catch((error: unknown) => {
      console.warn("[history-course] last-scene catalog failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || kind === "stack") return null;
  const t = clamp01(sceneLocalMs / Math.max(1, sceneDurationMs));
  const pickReveal = t >= LAST_SCENE_PICK_REVEAL;
  const modelId = entry.rooms?.[0]?.model_id;
  const backgroundUrl = lastSceneBackgroundUrl({ kind, modelId, actId });

  return (
    <div
      className="absolute inset-0 z-[18] overflow-hidden bg-black"
      data-history-last-scene={kind}
      data-progress={t.toFixed(2)}
    >
      {kind === "combat" ? (
        <CombatScene
          entry={entry}
          tables={tables}
          t={t}
          pickReveal={pickReveal}
          character={character}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          catalog={sceneCatalog}
          monsters={monsters}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "shop" ? (
        <ShopScene
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          leftoverGoldLabel={leftoverGoldLabel}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "event" ? (
        <EventScene
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          enchantments={enchantments}
          serviceLocale={serviceLocale}
          catalog={sceneCatalog}
          locTables={locTables}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "ancient" ? (
        <AncientScene
          entry={entry}
          tables={tables}
          pickReveal={pickReveal}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          enchantments={enchantments}
          serviceLocale={serviceLocale}
          catalog={sceneCatalog}
          locTables={locTables}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "treasure" ? (
        <TreasureScene
          entry={entry}
          tables={tables}
          t={t}
          pickReveal={pickReveal}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "rest" ? (
        <RestScene
          entry={entry}
          tables={tables}
          gameLocale={gameLocale}
          pickReveal={pickReveal}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          backgroundUrl={backgroundUrl}
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
          backgroundUrl={backgroundUrl}
        />
      ) : null}
    </div>
  );
}

function ResultPreview({
  entry,
  tables,
  pickReveal,
  leftoverGoldLabel,
  includeRemoved,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  leftoverGoldLabel?: string;
  includeRemoved?: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[46%] z-20 w-[min(36rem,58%)] -translate-x-1/2 -translate-y-1/2 sm:left-[27%] sm:w-[min(32rem,48%)]">
      <CombatRewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        includeRemoved={includeRemoved}
        leftoverGoldLabel={leftoverGoldLabel}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
    </div>
  );
}

function CombatScene({
  entry,
  tables,
  t,
  pickReveal,
  character,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  catalog,
  monsters,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  t: number;
  pickReveal: boolean;
  character: string;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  catalog: HistoryLastSceneCatalog | null;
  monsters: ReturnType<typeof getHistoryCourseCatalog>["allMonsters"];
  backgroundUrl: string;
}) {
  const encounter = catalog
    ? lookupHistoryEncounter(catalog.encounters, entry.rooms?.[0]?.model_id)
    : undefined;
  const characterRow = catalog
    ? lookupHistoryCharacter(catalog.characters, character)
    : undefined;
  const roomMonsters = roomMonsterIds(entry);
  const canUseEncounterStage = Boolean(encounter?.scene && characterRow);
  const formationIndex = encounter
    ? matchEncounterFormationIndex(encounter, roomMonsters)
    : 0;

  if (!catalog) {
    return <div className="absolute inset-0 bg-black" data-history-last-scene-loading="combat" />;
  }

  return (
    <div className="absolute inset-0">
      {canUseEncounterStage && encounter && characterRow ? (
        <div className={cn("absolute inset-0 transition-opacity duration-500", pickReveal && "opacity-40")}>
          <EncounterSceneStage
            encounter={encounter}
            character={characterRow}
            monsters={monsters}
            serviceLocale={serviceLocale}
            interactive={false}
            showCharacter
            fill
            lockedFormationIndex={formationIndex}
          />
        </div>
      ) : (
        <CombatStillFallback
          entry={entry}
          character={character}
          t={t}
          backgroundUrl={backgroundUrl}
        />
      )}
      <CombatRewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
        layout="combat"
      />
    </div>
  );
}

function CombatStillFallback({
  entry,
  character,
  t,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  character: string;
  t: number;
  backgroundUrl: string;
}) {
  const monsters = roomMonsterIds(entry);
  const slots = lastSceneMonsterSlots(entry.rooms?.[0]?.model_id);
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
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
            className={cn("absolute h-[52%] w-[20%] transition-all duration-500", dead && "rich-jitter")}
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
              src={monsterStillUrl(id)}
              alt={prettifyId(stripReplayId(id))}
              className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
            />
          </div>
        );
      })}
    </div>
  );
}

function ShopScene({
  entry,
  tables,
  pickReveal,
  leftoverGoldLabel,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  leftoverGoldLabel: string;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
}) {
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      <SceneArt
        src={MERCHANT}
        className="absolute bottom-[6%] right-[4%] h-[78%] w-[38%] object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      />
      <CombatRewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        includeRemoved
        leftoverGoldLabel={leftoverGoldLabel}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
        layout="combat"
      />
    </div>
  );
}

function EventScene({
  entry,
  tables,
  pickReveal,
  cardsById,
  relicsById,
  potionsById,
  enchantments,
  serviceLocale,
  catalog,
  locTables,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  enchantments?: CodexEnchantment[];
  serviceLocale: ServiceLocale;
  catalog: HistoryLastSceneCatalog | null;
  locTables: HistoryLocTables | null;
  backgroundUrl: string;
}) {
  const modelId = entry.rooms?.[0]?.model_id;
  const event = catalog ? lookupHistoryEvent(catalog.events, modelId) : undefined;
  const title =
    event?.name
    ?? localizeGame(tables, "events", modelId)
    ?? prettifyId(stripReplayId(modelId ?? "event"));
  const art = event?.imageUrl ?? backgroundUrl;
  const vfxSlug = historyEventVfxSlug(event?.id);
  const fakeMerchant = event?.id === "FAKE_MERCHANT";
  return (
    <EventRoomArt
      src={art}
      name={title}
      portrait={fakeMerchant ? (
        <div className="absolute inset-0">
          <FakeMerchantSpineStage fallbackImageUrl={art} />
        </div>
      ) : undefined}
      viewportOverlay={vfxSlug ? <EventVfxStage sceneSlug={vfxSlug} /> : null}
    >
      <GameRoomChoicePanel title={title} body={eventOpeningDescription(event)}>
        <GameRoomChoiceList
          choices={entry.event_choices ?? []}
          revealed={pickReveal}
          copyFor={(choice) =>
            historyRoomChoiceCopy(choice, tables, "events", {
              choiceLoc: catalog?.choiceLoc,
              locTables,
              event,
              cardsById,
              relicsById,
              potionsById,
              enchantments,
            })
          }
        />
      </GameRoomChoicePanel>
      <ResultPreview
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
    </EventRoomArt>
  );
}

function AncientScene({
  entry,
  tables,
  pickReveal,
  cardsById,
  relicsById,
  potionsById,
  enchantments,
  serviceLocale,
  catalog,
  locTables,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  pickReveal: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  enchantments?: CodexEnchantment[];
  serviceLocale: ServiceLocale;
  catalog: HistoryLastSceneCatalog | null;
  locTables: HistoryLocTables | null;
  backgroundUrl: string;
}) {
  if (!catalog) {
    return <div className="absolute inset-0 bg-black" data-history-last-scene-loading="ancient" />;
  }

  const modelId = entry.rooms?.[0]?.model_id;
  const ancient = lookupHistoryAncient(catalog.ancients, modelId);
  const title =
    ancient?.name
    ?? localizeGame(tables, "ancients", modelId)
    ?? localizeGame(tables, "events", modelId)
    ?? prettifyId(stripReplayId(modelId ?? "ancient"));
  const choices = entry.ancient_choice ?? [];
  const copyFor = (choice: ReplayChoice) =>
    historyRoomChoiceCopy(choice, tables, "ancients", {
      choiceLoc: catalog?.choiceLoc,
      locTables,
      cardsById,
      relicsById,
      potionsById,
      enchantments,
    });

  const panel = (
    <GameRoomChoicePanel title={title}>
      <GameRoomChoiceList choices={choices} revealed={pickReveal} copyFor={copyFor} />
    </GameRoomChoicePanel>
  );
  const blessingIds = new Set(choices.map((choice) => stripReplayId(choice.id).toUpperCase()));
  const rewardEntry = {
    ...entry,
    relic_choices: (entry.relic_choices ?? []).filter(
      (choice) => !blessingIds.has(stripReplayId(choice.id).toUpperCase()),
    ),
  };
  const extraRewards = (
    <HudSafe>
      <CombatRewardPicks
        entry={rewardEntry}
        tables={tables}
        pickReveal={pickReveal}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
    </HudSafe>
  );

  if (ancient) {
    return (
      <AncientSceneStage ancient={ancient} fill>
        {panel}
        {extraRewards}
      </AncientSceneStage>
    );
  }

  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      {panel}
      {extraRewards}
    </div>
  );
}

function TreasureScene({
  entry,
  tables,
  t,
  pickReveal,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  t: number;
  pickReveal: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
}) {
  const open = t >= 0.28;
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      <SceneArt
        src={CHEST}
        className={cn(
          "absolute bottom-[22%] left-1/2 h-40 w-52 -translate-x-1/2 object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.75)] transition-all duration-500",
          open && "scale-125 opacity-0",
        )}
      />
      <CombatRewardPicks
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
        layout="combat"
      />
    </div>
  );
}

function RestScene({
  entry,
  tables,
  gameLocale,
  pickReveal,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  gameLocale: GameLocale;
  pickReveal: boolean;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
}) {
  const choices = entry.rest_site_choices ?? [];
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      <SceneArt
        src={REST_CAMP}
        className="absolute bottom-[18%] left-[12%] h-44 w-44 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-transparent" />
      <GameRoomChoicePanel>
        <div className="flex w-full flex-col gap-2">
          {choices.map((choice) => (
            <div key={choice} data-history-last-scene-pick={choice} data-picked="true">
              <GameChoiceFrame active={pickReveal}>
                <span className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
                  {restSiteChoiceLabel(choice, gameLocale)}
                </span>
              </GameChoiceFrame>
            </div>
          ))}
        </div>
      </GameRoomChoicePanel>
      <ResultPreview
        entry={entry}
        tables={tables}
        pickReveal={pickReveal}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
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
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  run: ReplayRun;
  tables: GameI18nTables;
  gameLocale: GameLocale;
  deathLabel: string;
  character: string;
  backgroundUrl: string;
}) {
  const salt = Math.round((entry.current_hp ?? 0) + (entry.damage_taken ?? 0) + run.seed.length);
  const banner = gameOverLoseBanner(gameLocale, salt);
  const quote = gameOverQuote(gameLocale, salt + 3);
  const causeId = run.killed_by_encounter ?? run.killed_by_event ?? entry.rooms?.[0]?.model_id;
  const cause =
    localizeGame(tables, "encounters", causeId)
    ?? localizeGame(tables, "events", causeId)
    ?? (causeId ? prettifyId(stripReplayId(causeId)) : deathLabel);
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
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
            <div className="rich-jitter font-game-title text-2xl text-red-100">{banner}</div>
            <div className="font-game-text text-sm text-zinc-100">{cause}</div>
            {quote ? <div className="font-game-text text-xs text-zinc-300">{quote}</div> : null}
          </div>
        </div>
      </HudSafe>
    </div>
  );
}
