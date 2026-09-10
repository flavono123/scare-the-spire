"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import dynamic from "next/dynamic";
import { HistoryLastSceneErrorBoundary } from "@/components/history-course/history-last-scene-error-boundary";
import { CombatLootScreen } from "@/components/history-course/combat-loot-screen";
import { EventRoomArt } from "@/components/history-course/event-room-art";
import {
  GameRoomChoiceList,
  GameRoomChoicePanel,
} from "@/components/history-course/game-room-choice";
import { LastSceneDamageVignette } from "@/components/history-course/last-scene-damage-vignette";
import { LastSceneEnchantAttach } from "@/components/history-course/last-scene-enchant-attach";
import { LastSceneObtainFly, relicTargetSelector } from "@/components/history-course/last-scene-obtain-vfx";
import {
  MerchantShopScreen,
  splitShopCardRows,
} from "@/components/history-course/merchant-shop-screen";
import { RestSiteScreen } from "@/components/history-course/rest-site-screen";
import { RoomResultReceipt } from "@/components/history-course/room-result-receipt";
import {
  characterCombatArtSrc,
  restSitePrompt,
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
  restSiteFireUrl,
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
import { historyRoomChoiceCopy, eventOpeningDescription, eventLastSceneChoices } from "@/lib/history-room-choice";
import { historyEventVfxSlug } from "@/lib/history-event-vfx";
import { getHistoryCourseCatalog } from "@/lib/history-course-catalog";
import { gameOverLoseBanner, gameOverQuote } from "@/lib/game-over-copy";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { useOptionalHistoryCatalogLocale } from "@/hooks/use-history-catalog-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { localizeGame, type GameI18nTables } from "@/lib/sts2-game-i18n";
import { prettifyId } from "@/lib/sts2-i18n";
import type { CodexCard, CodexEnchantment, CodexMonster, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type { ReplayChoice, ReplayHistoryEntry, ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryRelic } from "@/lib/history-relic-lookup";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";
import type { HistoryLocTables } from "@/lib/history-loc-tables";

const EncounterSceneStage = dynamic(
  () => import("@/components/codex/encounter-scene-stage").then((mod) => mod.EncounterSceneStage),
  { ssr: false, loading: () => null },
);
const MonsterSpineStage = dynamic(
  () => import("@/components/codex/monster-spine-stage").then((mod) => mod.MonsterSpineStage),
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
const TreasureRoomStage = dynamic(
  () => import("@/components/history-course/treasure-room-stage").then((mod) => mod.TreasureRoomStage),
  { ssr: false },
);

const MERCHANT = "/images/sts2/npcs/merchant.webp";
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

  if (kind === "stack" || hidden) return null;
  void leftoverGoldLabel;
  const t = clamp01(sceneLocalMs / Math.max(1, sceneDurationMs));
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  const modelId = entry.rooms?.[0]?.model_id;
  const backgroundUrl = lastSceneBackgroundUrl({ kind, modelId, actId });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[18] overflow-hidden bg-black"
      aria-hidden
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
          phase={phase}
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
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
          enchantments={enchantments}
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
          actId={actId}
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
          actId={actId}
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
  const overlayEncounter = Boolean(encounter?.scene && characterRow);
  const formationIndex = encounter
    ? matchEncounterFormationIndex(encounter, roomMonsters)
    : 0;
  const dead = phase.kind !== "alive";
  const loot = combatLootSpecs(entry);
  const cards = entry.card_choices ?? [];
  const skippedCards = cards.length > 0 && !cards.some((choice) => choice.picked);

  return (
    <div className="absolute inset-0">
      <CombatStillFallback
        entry={entry}
        character={character}
        dead={dead}
        holdDeathPose={dead && phase.kind !== "dying"}
        backgroundUrl={backgroundUrl}
        monsters={monsters}
        selectedMoveId={dead ? "DEAD" : null}
        useSpine={!overlayEncounter}
      />
      {overlayEncounter && encounter && characterRow ? (
        <HistoryLastSceneErrorBoundary key={encounter.id} fallback={null}>
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
              holdDeathPose={dead && phase.kind !== "dying"}
              keepFallbackUntilPlayed
              monsterFallbackUrl={(monster) =>
                monster.imageUrl ?? monster.bossImageUrl ?? monsterStillUrl(monster.id)
              }
            />
          </div>
        </HistoryLastSceneErrorBoundary>
      ) : null}
      {phase.kind === "loot" ? (
        <CombatLootScreen
          items={loot}
          resolvedCount={phase.resolvedCount}
          beatProgress={phase.beatProgress}
          entry={entry}
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
          beatProgress={phase.beatProgress}
        />
      ) : null}
    </div>
  );
}

function matchHistoryMonster(monsters: CodexMonster[], id: string): CodexMonster | undefined {
  const key = stripReplayId(id).toUpperCase();
  return monsters.find((monster) => {
    const monsterKey = stripReplayId(monster.id).toUpperCase();
    return monsterKey === key || monster.id.toUpperCase() === key;
  });
}

function CombatStillFallback({
  entry,
  character,
  dead,
  holdDeathPose,
  backgroundUrl,
  monsters,
  selectedMoveId,
  useSpine,
}: {
  entry: ReplayHistoryEntry;
  character: string;
  dead: boolean;
  holdDeathPose: boolean;
  backgroundUrl: string;
  monsters: CodexMonster[];
  selectedMoveId: string | null;
  useSpine: boolean;
}) {
  const roomIds = roomMonsterIds(entry);
  const slots = lastSceneMonsterSlots(entry.rooms?.[0]?.model_id);
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      <SceneArt
        src={characterCombatArtSrc(character)}
        className="absolute bottom-[8%] left-[6%] h-[62%] w-[22%] object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)]"
      />
      {roomIds.map((id, index) => {
        const slot = slots[index];
        const count = Math.max(roomIds.length, 1);
        const monster = matchHistoryMonster(monsters, id);
        const style = slot
          ? {
              left: `${slot.leftPct}%`,
              top: `${slot.topPct}%`,
              opacity: 1,
              transform: dead
                ? "translate(-50%, -100%) scale(0.94)"
                : "translate(-50%, -100%)",
            }
          : {
              left: `${48 + (index * 38) / count}%`,
              bottom: "10%",
              opacity: 1,
              transform: dead ? "scale(0.94)" : "none",
            };
        return (
          <div
            key={`${id}-${index}`}
            className={cn(
              "absolute h-[52%] w-[20%] transition-all duration-500",
              dead && (!useSpine || !monster?.spineAsset) && "grayscale contrast-125",
            )}
            style={style}
          >
            {useSpine && monster?.spineAsset ? (
              <MonsterSpineStage
                asset={monster.spineAsset}
                fallbackImageUrl={monster.imageUrl ?? monsterStillUrl(id)}
                monsterName={monster.name}
                selectedMoveId={selectedMoveId}
                loopSelectedMove={false}
                holdDeathPose={holdDeathPose}
                keepFallbackUntilPlayed
                className="absolute inset-0"
                fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
                showLoadingLabel={false}
                imagePriority={index < 2}
              />
            ) : (
              <SceneArt
                src={monsterStillUrl(id)}
                alt={prettifyId(stripReplayId(id))}
                className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.7)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShopScene({
  entry,
  phase,
  cardsById,
  relicsById,
  potionsById,
  serviceLocale,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  phase: LastScenePhase;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
}) {
  const rows = splitShopCardRows(entry.card_choices ?? [], cardsById);
  const beatProgress = phase.kind === "shop" ? phase.beatProgress : 1;
  const step = phase.kind === "shop" ? phase.step : 0;
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
        entry={entry}
        beatProgress={beatProgress}
        step={step}
      />
    </div>
  );
}

function EventScene({
  entry,
  tables,
  phase,
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
  const revealed = phase.kind === "receipt";
  const beatProgress = phase.kind === "choice" || phase.kind === "receipt" ? phase.beatProgress : 0;
  const choices = eventLastSceneChoices(event, entry.event_choices);
  const enchanted = entry.cards_enchanted?.[0];
  const enchantment = enchanted
    ? enchantments?.find((row) => row.id.toUpperCase() === stripReplayId(enchanted.enchantmentId).toUpperCase())
    : undefined;
  const enchantedCard = enchanted && cardsById
    ? lookupHistoryCard(cardsById, enchanted.cardId)
    : undefined;
  const pickedRelic = (entry.relic_choices ?? []).find((choice) => choice.picked && choice.id);
  const relic = pickedRelic ? lookupHistoryRelic(relicsById, pickedRelic.id) : undefined;
  const relicIcon = relic ? resolveRelicDisplayImage(relic, relic.pool) : null;
  const pickedOption = choices.find((choice) => choice.picked);
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
          choices={choices}
          revealed={revealed}
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
      <LastSceneDamageVignette
        active={revealed && (entry.damage_taken ?? 0) > 0}
        progress={beatProgress}
      />
      {revealed && enchantedCard && enchantment ? (
        <LastSceneEnchantAttach
          card={enchantedCard}
          enchantment={enchantment}
          progress={beatProgress}
          serviceLocale={serviceLocale}
        />
      ) : null}
      {revealed && pickedRelic && relicIcon ? (
        <LastSceneObtainFly
          active
          progress={beatProgress}
          sourceSelector={`[data-history-last-scene-pick="${pickedOption?.id ?? pickedRelic.id}"]`}
          targetSelector={relicTargetSelector(pickedRelic.id)}
          iconUrl={relicIcon}
          kind="relic"
        />
      ) : null}
    </EventRoomArt>
  );
}

function AncientScene({
  entry,
  tables,
  phase,
  cardsById,
  relicsById,
  potionsById,
  enchantments,
  catalog,
  locTables,
  backgroundUrl,
}: {
  entry: ReplayHistoryEntry;
  tables: GameI18nTables;
  phase: LastScenePhase;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  enchantments?: CodexEnchantment[];
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
  const pickedAncientRelic = choices.find((choice) => choice.picked && choice.id);
  const ancientRelic = pickedAncientRelic
    ? lookupHistoryRelic(relicsById, pickedAncientRelic.id)
    : undefined;
  const ancientRelicIcon = ancientRelic
    ? resolveRelicDisplayImage(ancientRelic, ancientRelic.pool)
    : null;
  const overlay = (
    <>
      <GameRoomChoicePanel title={title}>
        <GameRoomChoiceList choices={choices} revealed copyFor={copyFor} />
      </GameRoomChoicePanel>
      {phase.kind === "receipt" && pickedAncientRelic && ancientRelicIcon ? (
        <LastSceneObtainFly
          active
          progress={phase.beatProgress}
          sourceSelector={`[data-history-last-scene-pick="${pickedAncientRelic.id}"]`}
          targetSelector={relicTargetSelector(pickedAncientRelic.id)}
          iconUrl={ancientRelicIcon}
          kind="relic"
        />
      ) : null}
    </>
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
  actId,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  phase: LastScenePhase;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  locTables: HistoryLocTables | null;
  actId: string;
}) {
  const open = phase.kind !== "chest";
  const loot = combatLootSpecs(entry);
  const cards = entry.card_choices ?? [];
  const skippedCards = cards.length > 0 && !cards.some((choice) => choice.picked);
  return (
    <div className="absolute inset-0 bg-black">
      <TreasureRoomStage actId={actId} open={open} />
      {phase.kind === "loot" ? (
        <CombatLootScreen
          items={loot}
          resolvedCount={phase.resolvedCount}
          beatProgress={phase.beatProgress}
          entry={entry}
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
          beatProgress={phase.beatProgress}
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
  actId,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  phase: LastScenePhase;
  cardsById?: Record<string, CodexCard>;
  relicsById?: Record<string, CodexRelic>;
  potionsById?: Record<string, CodexPotion>;
  serviceLocale: ServiceLocale;
  backgroundUrl: string;
  actId: string;
}) {
  const fireUrl = restSiteFireUrl(actId);
  return (
    <div className="absolute inset-0">
      <SceneArt src={backgroundUrl} hideOnError={false} className="absolute inset-0 h-full w-full object-cover" />
      {fireUrl ? (
        <SceneArt
          src={fireUrl}
          className="absolute bottom-[18%] left-1/2 h-[22%] w-[22%] -translate-x-1/2 object-contain mix-blend-screen"
        />
      ) : null}
      {phase.kind === "choice" || phase.kind === "receipt" ? (
        <RestSiteScreen
          entry={entry}
          gameLocale={gameLocale}
          revealed={phase.kind === "receipt"}
          prompt={restSitePrompt(gameLocale)}
        />
      ) : null}
      {phase.kind === "receipt" ? (
        <RoomResultReceipt
          entry={entry}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          cardsById={cardsById}
          relicsById={relicsById}
          potionsById={potionsById}
        />
      ) : null}
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
