"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import dynamic from "next/dynamic";
import { CardRewardScreen } from "@/components/history-course/card-reward-screen";
import { CombatLootScreen } from "@/components/history-course/combat-loot-screen";
import { EventRoomArt } from "@/components/history-course/event-room-art";
import {
  GameRoomChoiceList,
  GameRoomChoicePanel,
} from "@/components/history-course/game-room-choice";
import {
  MerchantShopScreen,
  splitShopCardRows,
} from "@/components/history-course/merchant-shop-screen";
import { RoomResultReceipt } from "@/components/history-course/room-result-receipt";
import {
  characterCombatArtSrc,
  restSiteChoiceLabel,
} from "@/lib/history-party";
import {
  roomMonsterIds,
  stripReplayId,
  type LastSceneKind,
} from "@/lib/history-last-scene";
import {
  combatLootSpecs,
  lastScenePhase,
  type LastScenePhase,
} from "@/lib/history-last-scene-steps";
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
  void leftoverGoldLabel;
  const t = clamp01(sceneLocalMs / Math.max(1, sceneDurationMs));
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  const modelId = entry.rooms?.[0]?.model_id;
  const backgroundUrl = lastSceneBackgroundUrl({ kind, modelId, actId });

  return (
    <div
      className="absolute inset-0 z-[18] overflow-hidden bg-black"
      data-history-last-scene={kind}
      data-history-last-scene-phase={phase.kind}
      data-progress={t.toFixed(2)}
    >
      {kind === "combat" ? (
        <CombatScene
          entry={entry}
          gameLocale={gameLocale}
          phase={phase}
          character={character}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          catalog={sceneCatalog}
          locTables={locTables}
          monsters={monsters}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "shop" ? (
        <ShopScene
          entry={entry}
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
          phase={phase}
          gameLocale={gameLocale}
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
          phase={phase}
          gameLocale={gameLocale}
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
          gameLocale={gameLocale}
          phase={phase}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          serviceLocale={serviceLocale}
          locTables={locTables}
          backgroundUrl={backgroundUrl}
        />
      ) : null}
      {kind === "rest" ? (
        <RestScene
          entry={entry}
          gameLocale={gameLocale}
          phase={phase}
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

function CombatScene({
  entry,
  gameLocale,
  phase,
  character,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  catalog,
  locTables,
  monsters,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  phase: LastScenePhase;
  character: string;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  catalog: HistoryLastSceneCatalog | null;
  locTables: HistoryLocTables | null;
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
  const dead = phase.kind !== "alive";
  const loot = combatLootSpecs(entry);
  const cards = entry.card_choices ?? [];
  const skippedCards = cards.length > 0 && !cards.some((choice) => choice.picked);

  if (!catalog) {
    return <div className="absolute inset-0 bg-black" data-history-last-scene-loading="combat" />;
  }

  return (
    <div className="absolute inset-0">
      {canUseEncounterStage && encounter && characterRow ? (
        <div className="absolute inset-0">
          <EncounterSceneStage
            encounter={encounter}
            character={characterRow}
            monsters={monsters}
            serviceLocale={serviceLocale}
            interactive={false}
            showCharacter
            fill
            lockedFormationIndex={formationIndex}
            selectedMoveId={dead ? "DEAD" : null}
            loopSelectedMove={false}
          />
        </div>
      ) : (
        <CombatStillFallback
          entry={entry}
          character={character}
          dead={dead}
          backgroundUrl={backgroundUrl}
        />
      )}
      {phase.kind === "loot" ? (
        <CombatLootScreen
          items={loot}
          revealedCount={phase.revealedCount}
          gameLocale={gameLocale}
          locTables={locTables}
          relicsById={relicsById}
          potionsById={potionsById}
        />
      ) : null}
      {phase.kind === "cards" ? (
        <CardRewardScreen
          choices={cards}
          cardsById={cardsById}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          locTables={locTables}
          skipped={skippedCards}
        />
      ) : null}
    </div>
  );
}

function CombatStillFallback({
  entry,
  character,
  dead,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  character: string;
  dead: boolean;
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
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
}) {
  const rows = splitShopCardRows(entry.card_choices ?? [], cardsById);
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      <SceneArt
        src={MERCHANT}
        className="absolute bottom-[4%] right-[2%] h-[82%] w-[42%] object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,0.7)]"
      />
      <MerchantShopScreen
        characterCards={rows.characterCards}
        colorlessCards={rows.colorlessCards}
        relics={(entry.relic_choices ?? []).filter((choice) => choice.id)}
        potions={(entry.potion_choices ?? []).filter((choice) => choice.id)}
        removalUsed={(entry.cards_removed ?? []).some((card) => card.id)}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        serviceLocale={serviceLocale}
      />
    </div>
  );
}

function EventScene({
  entry,
  tables,
  phase,
  gameLocale,
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
  phase: LastScenePhase;
  gameLocale: GameLocale;
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
  const choicePhase = phase.kind === "choice";
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
      {choicePhase ? (
        <GameRoomChoicePanel title={title} body={eventOpeningDescription(event)}>
          <GameRoomChoiceList
            choices={entry.event_choices ?? []}
            revealed
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
      ) : (
        <RoomResultReceipt
          entry={entry}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
        />
      )}
    </EventRoomArt>
  );
}

function AncientScene({
  entry,
  tables,
  phase,
  gameLocale,
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
  phase: LastScenePhase;
  gameLocale: GameLocale;
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
  const blessingIds = new Set(choices.map((choice) => stripReplayId(choice.id).toUpperCase()));
  const overlay = phase.kind === "choice" ? (
    <GameRoomChoicePanel title={title}>
      <GameRoomChoiceList choices={choices} revealed copyFor={copyFor} />
    </GameRoomChoicePanel>
  ) : (
    <RoomResultReceipt
      entry={entry}
      gameLocale={gameLocale}
      serviceLocale={serviceLocale}
      cardsById={cardsById}
      relicsById={relicsById}
      potionsById={potionsById}
      excludeRelicIds={blessingIds}
      includeHeal={false}
    />
  );

  if (ancient) {
    return (
      <AncientSceneStage ancient={ancient} fill>
        {overlay}
      </AncientSceneStage>
    );
  }

  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      {overlay}
    </div>
  );
}

function TreasureScene({
  entry,
  gameLocale,
  phase,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  locTables,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  phase: LastScenePhase;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  locTables: HistoryLocTables | null;
  backgroundUrl: string;
}) {
  const open = phase.kind !== "chest";
  const loot = combatLootSpecs(entry);
  const cards = entry.card_choices ?? [];
  const skippedCards = cards.length > 0 && !cards.some((choice) => choice.picked);
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
      {phase.kind === "loot" ? (
        <CombatLootScreen
          items={loot}
          revealedCount={phase.revealedCount}
          gameLocale={gameLocale}
          locTables={locTables}
          relicsById={relicsById}
          potionsById={potionsById}
        />
      ) : null}
      {phase.kind === "cards" ? (
        <CardRewardScreen
          choices={cards}
          cardsById={cardsById}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          locTables={locTables}
          skipped={skippedCards}
        />
      ) : null}
    </div>
  );
}

function RestScene({
  entry,
  gameLocale,
  phase,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  phase: LastScenePhase;
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
      {phase.kind === "choice" ? (
        <GameRoomChoicePanel>
          <div className="flex w-full flex-col gap-2">
            {choices.map((choice) => (
              <div key={choice} data-history-last-scene-pick={choice} data-picked="true">
                <GameChoiceFrame active>
                  <span className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
                    {restSiteChoiceLabel(choice, gameLocale)}
                  </span>
                </GameChoiceFrame>
              </div>
            ))}
          </div>
        </GameRoomChoicePanel>
      ) : (
        <RoomResultReceipt
          entry={entry}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
        />
      )}
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
