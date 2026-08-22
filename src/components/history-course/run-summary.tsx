"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { HistoryTinyCardIcon } from "@/components/history-course/card-action-icon";
import { NodeTooltip } from "@/components/history-course/node-tooltip";
import { RunBadgeStrip } from "@/components/history-course/run-badge-strip";
import {
  EntityPreview,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import { DescriptionText } from "@/components/codex/codex-description";
import { GameHoverTip } from "@/components/codex/hover-tip";
import { PortaledHoverTipLayer } from "@/components/codex/card-keyword-tip-stack";
import { GameScrollArea } from "@/components/game-scroll-area";
import { useGameI18n } from "@/hooks/use-game-i18n";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { localizeGame, gameUi, formatGameTemplate, type GameI18nTables } from "@/lib/sts2-game-i18n";
import {
  historyCardDisplayName,
  lookupHistoryCard,
} from "@/lib/history-card-lookup";
import { historyCardEnchantmentTileProps } from "@/lib/history-enchantments";
import { historyStaticHoverTip } from "@/lib/history-static-hover-tips";
import {
  buildPotionEntityInfo,
  lookupHistoryPotion,
} from "@/lib/history-potion-lookup";
import { buildRelicEntityInfo } from "@/lib/history-relic-lookup";
import { lookupHistoryCardVisual } from "@/lib/history-card-visuals";
import { TEXT_CREAM, TEXT_GREEN, TEXT_PURPLE } from "@/lib/sts2-card-style";
import { TOYBOX_WIDE_MAX_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";
import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
  ReplayRun,
} from "@/lib/sts2-run-replay";
import { historyEntryForPlayer } from "@/lib/sts2-run-replay";
import {
  getMadScienceVariantId,
  getMadScienceVariantPartsFromId,
} from "@/lib/tinker-time";
import type { TopbarState } from "@/components/history-course/topbar-state";
import { visibleRunBadgesAtFloor } from "@/lib/run-badge-timing";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PartyPortraitStack } from "@/components/history-course/party-portrait-stack";

// ============================================================================
// Run summary panel — port of
// `MegaCrit.Sts2.Core.Nodes.Screens.RunHistoryScreen.NRunHistory`.
//
// Two ways to open:
//   * Mid-run, user clicks the topbar cog → panel opens with everything
//     traversed so far (partial). Future acts and yet-to-visit nodes
//     within the current act are hidden.
//   * Run ends (globalMs reaches totalMs) → panel auto-opens, no death
//     animation in front. The user can dismiss the panel via the back
//     button and keep scrubbing the playback at the final node.
// ============================================================================

const ANCIENT_KEYS = new Set([
  "NEOW",
  "TEZCATARA",
  "VAKUU",
  "OROBAS",
  "PAEL",
  "DARV",
  "NONUPEIPE",
  "TANX",
]);

function ancientSpriteSrc(modelId: string | null): string | null {
  if (!modelId) return null;
  const m = modelId.match(/^EVENT\.(.+)$/);
  if (!m) return null;
  if (!ANCIENT_KEYS.has(m[1])) return null;
  return `/images/sts2/run-history/${m[1].toLowerCase()}.png`;
}

function bossKeyFromEntry(entry: ReplayHistoryEntry): string | null {
  const id = entry.rooms?.[0]?.model_id;
  if (!id) return null;
  const match = id.match(/^ENCOUNTER\.(.+_BOSS)$/);
  return match ? match[1] : null;
}

function nodeSpriteSrc(entry: ReplayHistoryEntry): string {
  const modelId = entry.rooms?.[0]?.model_id ?? null;
  if (entry.map_point_type === "ancient") {
    return ancientSpriteSrc(modelId) ?? "/images/sts2/run-history/ancient.png";
  }
  if (modelId === "EVENT.NEOW") return "/images/sts2/run-history/neow.png";
  if (modelId === "ROOM.ANCIENT") return "/images/sts2/run-history/ancient.png";
  if (entry.map_point_type === "boss") {
    const bossKey = bossKeyFromEntry(entry);
    if (bossKey) return `/images/sts2/bosses/${bossKey.toLowerCase()}.webp`;
    return "/images/sts2/run-history/monster.png";
  }
  switch (entry.map_point_type) {
    case "monster":
      return "/images/sts2/run-history/monster.png";
    case "elite":
      return "/images/sts2/run-history/elite.png";
    case "rest_site":
      return "/images/sts2/run-history/rest_site.png";
    case "treasure":
      return "/images/sts2/run-history/treasure.png";
    case "shop":
      return "/images/sts2/run-history/shop.png";
    case "unknown":
      return "/images/sts2/run-history/event.png";
    default:
      return "/images/sts2/run-history/monster.png";
  }
}

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

function potionIconSrc(id: string): string {
  const slug = id.replace(/^POTION\./, "").toLowerCase();
  return `/images/sts2/potions/${slug}.webp`;
}

function buildCardEntityInfo(
  card: CodexCard | undefined,
  opts?: {
    upgradeLevel?: number;
    enchantmentId?: string | null;
    enchantmentAmount?: number;
    locale?: GameLocale | ServiceLocale;
  },
): EntityInfo | null {
  if (!card) return null;
  const madScienceParts = getMadScienceVariantPartsFromId(card.id);
  const linkId = madScienceParts
    ? getMadScienceVariantId(madScienceParts.cardType)
    : card.id;
  const upgradeLevel = opts?.upgradeLevel ?? 0;
  const enchant = historyCardEnchantmentTileProps(
    opts?.enchantmentId,
    opts?.enchantmentAmount,
    opts?.locale ?? "kor",
  );
  return {
    id: linkId,
    nameEn: card.nameEn,
    nameKo: card.name,
    imageUrl: card.imageUrl,
    href: buildCompendiumResourceHref("card", linkId),
    color: card.color,
    type: "card",
    cardData: card,
    cardPreviewUpgradeLevel: upgradeLevel > 0 ? upgradeLevel : undefined,
    cardPreviewEnchantment: enchant,
  };
}

interface Props {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
  relicsById: Record<string, CodexRelic>;
  potionsById: Record<string, CodexPotion>;
  /** Whether the panel is mounted/visible. */
  open: boolean;
  /** True when the run has reached its final node (globalMs ≥ totalMs).
   *  When the panel is opened mid-run this is false; the banner / quote
   *  hold off until the run actually finishes. */
  ended: boolean;
  /** Index of the currently-rendered act (0-based). The panel truncates
   *  the act-row sequences accordingly: past acts render fully, the
   *  current act renders only up to `currentStep`, future acts are
   *  hidden entirely. */
  currentActIndex: number;
  currentStep: number;
  focusedPlayerIndex?: number;
  onFocusPlayer?: (index: number) => void;
  /** Back button — when present a codex-style return chip is rendered
   *  in the bottom-left and `onClose` fires on click / Escape. The
   *  topbar cog also drives this same close path. */
  onClose: () => void;
}

export function RunSummary({
  run,
  acts,
  topbarState,
  cardsById,
  relicsById,
  potionsById,
  open,
  ended,
  currentActIndex,
  currentStep,
  focusedPlayerIndex = 0,
  onFocusPlayer,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <div
      data-testid="run-summary-overlay"
      className="pointer-events-auto absolute inset-0 z-50 bg-zinc-950/96"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <GameScrollArea className="h-full" size="large">
      <SummaryPanel
        run={run}
        acts={acts}
        topbarState={topbarState}
        cardsById={cardsById}
        relicsById={relicsById}
        potionsById={potionsById}
        ended={ended}
        currentActIndex={currentActIndex}
        currentStep={currentStep}
        focusedPlayerIndex={focusedPlayerIndex}
        onFocusPlayer={onFocusPlayer}
      />
      <BackButton onClose={onClose} />
      </GameScrollArea>
    </div>
  );
}

// ----- Panel body -----------------------------------------------------------

function SummaryPanel({
  run,
  acts,
  topbarState,
  cardsById,
  relicsById,
  potionsById,
  ended,
  currentActIndex,
  currentStep,
  focusedPlayerIndex,
  onFocusPlayer,
}: {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
  relicsById: Record<string, CodexRelic>;
  potionsById: Record<string, CodexPotion>;
  ended: boolean;
  currentActIndex: number;
  currentStep: number;
  focusedPlayerIndex: number;
  onFocusPlayer?: (index: number) => void;
}) {
  const serviceLocale = useServiceLocale();
  const playback = serviceMessages[serviceLocale].historyCourse.detail.playback;
  const badges = run.players[focusedPlayerIndex]?.badges ?? [];
  const finalFloor = topbarState.currentFloor;
  const visibleBadges = ended
    ? badges
    : visibleRunBadgesAtFloor(run, finalFloor, ended, focusedPlayerIndex);
  const runTimeStr = formatRunTime(run.run_time ?? 0);
  const dateStr = formatRunDate(run.start_time, serviceLocale);

  // Cross-section hover state. Hovering a relic / deck card sets the
  // floor at which it was acquired; the act rows then highlight that
  // floor's node. Null means nothing is being hovered.
  const [highlightedFloor, setHighlightedFloor] = useState<number | null>(null);

  // Truncate per current playback position. Past acts render fully; the
  // current act stops at `currentStep`; future acts disappear.
  const visibleActs = acts
    .map((act, idx) => {
      if (idx < currentActIndex) {
        return {
          act,
          history: act.history.map((entry) =>
            historyEntryForPlayer(entry, focusedPlayerIndex),
          ),
        };
      }
      if (idx === currentActIndex) {
        return {
          act,
          history: act.history
            .slice(0, Math.max(0, currentStep))
            .map((entry) => historyEntryForPlayer(entry, focusedPlayerIndex)),
        };
      }
      return null;
    })
    .filter((x): x is { act: ReplayActAnalysis; history: ReplayHistoryEntry[] } => x !== null);

  return (
    <div
      data-testid="summary-panel"
      className={`${TOYBOX_WIDE_MAX_CLASS} px-4 py-8 text-zinc-100`}
      style={{ animation: "summary-fade-in 280ms ease-out both" }}
    >
      <style>{`
        @keyframes summary-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="flex flex-wrap items-center gap-3 border-b border-amber-500/20 pb-3">
        <PartyPortraitStack
          run={run}
          focusedIndex={focusedPlayerIndex}
          onFocus={onFocusPlayer}
          size="summary"
        />
        <HpChip hp={topbarState.hp} maxHp={topbarState.maxHp} />
        <GoldChip gold={topbarState.gold} />
        <PotionStrip
          slots={topbarState.potionSlots}
          potions={topbarState.potions}
          potionsById={potionsById}
        />
        <ScoreChip win={run.win && ended} floor={finalFloor} />
        <TimeChip runTime={runTimeStr} />
        <div className="ml-auto flex min-w-[190px] flex-col items-end gap-1.5 text-right text-[11px] leading-snug text-zinc-400">
          {dateStr && <div>{dateStr}</div>}
          <div>{playback.seed.replace("{seed}", run.seed)}</div>
          <div className="text-amber-200/80">
            {ended
              ? run.win
                ? playback.victory
                : playback.defeat
              : playback.inProgress}{" "}
            · {playback.floorOnly.replace("{floor}", String(finalFloor))}
          </div>
          <div className="text-zinc-500">v{run.build_id}</div>
          <RunBadgeStrip
            badges={visibleBadges}
            serviceLocale={serviceLocale}
            size="lg"
            tipPlacement="below-right"
            className="justify-end pt-1"
          />
        </div>
      </header>

      <section className="mt-5 space-y-2">
        {visibleActs.map(({ act, history }) => (
          <ActRow
            key={`${act.actId}-${act.actIndex}`}
            act={act}
            history={history}
            highlightedFloor={highlightedFloor}
          />
        ))}
      </section>

      <section className="mt-6">
        <RelicSection
          relics={topbarState.relics}
          relicsById={relicsById}
          onHoverFloor={setHighlightedFloor}
        />
      </section>

      <section className="mt-6 mb-24">
        <DeckSection
          deck={topbarState.deck}
          cardsById={cardsById}
          onHoverFloor={setHighlightedFloor}
        />
      </section>
    </div>
  );
}

// ----- Top mirror chips ------------------------------------------------------

function HpChip({
  hp,
  maxHp,
}: {
  hp: number | null;
  maxHp: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5 text-rose-200">
      <Image
        src="/images/sts2/ui/topbar/top_bar_heart.png"
        alt=""
        width={26}
        height={26}
        className="h-6 w-6 object-contain"
        unoptimized
      />
      <span className="font-bold tabular-nums">
        {hp ?? "?"}/{maxHp ?? "?"}
      </span>
    </div>
  );
}

function GoldChip({ gold }: { gold: number | null }) {
  return (
    <div className="flex items-center gap-1.5 text-amber-200">
      <Image
        src="/images/sts2/ui/topbar/top_bar_gold.png"
        alt=""
        width={22}
        height={22}
        className="h-5 w-5 object-contain"
        unoptimized
      />
      <span className="font-bold tabular-nums">{gold ?? 0}</span>
    </div>
  );
}

// Mirrors the topbar's PotionSlots — same nine-slice frame and placeholder
// sprite so the summary header reads as the same widget the player saw mid-run.
function PotionStrip({
  slots,
  potions,
  potionsById,
}: {
  slots: number;
  potions: (string | null)[];
  potionsById: Record<string, CodexPotion>;
}) {
  const tables = useGameI18n();
  const gameLocale = useGameLocale();
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  const emptyTip = historyStaticHoverTip("POTION_SLOT", gameLocale);
  return (
    <div
      aria-label={playback.potionSlots.replace("{count}", String(slots))}
      className="relative inline-flex items-center gap-1 px-1"
      style={{
        borderImage:
          "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png) 28 fill / 8px / 0 stretch",
        borderStyle: "solid",
        borderWidth: "8px",
      }}
    >
      {Array.from({ length: slots }).map((_, i) => {
        const potionId = potions[i] ?? null;
        const potion = potionId ? lookupHistoryPotion(potionsById, potionId) : undefined;
        const entity = buildPotionEntityInfo(potion);
        const label = potionId
          ? localizeGame(tables, "potions", potionId) ?? potion?.name ?? potionId
          : emptyTip.title;
        const slot = (
          <span className="relative block h-6 w-5">
            <Image
              src="/images/sts2/ui/topbar/potion_placeholder.png"
              alt=""
              fill
              sizes="20px"
              className="object-contain opacity-90"
              unoptimized
            />
            {potionId && (
              <Image
                src={potionIconSrc(potionId)}
                alt={label}
                fill
                sizes="20px"
                className="object-contain drop-shadow-[0_0_6px_rgba(103,232,249,0.75)]"
                unoptimized
              />
            )}
          </span>
        );
        if (entity) {
          return (
            <EntityPreview key={i} entity={entity} linkClassName="block">
              {slot}
            </EntityPreview>
          );
        }
        return (
          <PotionSlotHoverTip key={i} title={emptyTip.title} description={emptyTip.description}>
            {slot}
          </PotionSlotHoverTip>
        );
      })}
    </div>
  );
}

function PotionSlotHoverTip({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <span
          className="pointer-events-none absolute left-1/2 top-full"
          style={{ transform: "translate(-50%, 8px)" }}
        >
          <PortaledHoverTipLayer>
            <GameHoverTip title={title} style={{ minWidth: 220, maxWidth: 280 }}>
              <DescriptionText description={description} className="block text-left" />
            </GameHoverTip>
          </PortaledHoverTipLayer>
        </span>
      )}
    </span>
  );
}

function ScoreChip({ win, floor }: { win: boolean; floor: number }) {
  return (
    <div className="flex items-center gap-1 text-zinc-300">
      <Image
        src="/images/sts2/ui/topbar/top_bar_floor.png"
        alt=""
        width={22}
        height={22}
        className="h-5 w-5 object-contain"
        unoptimized
      />
      <span className="font-bold tabular-nums">{floor}</span>
      {win && <span className="ml-1 text-[10px] text-amber-200">★</span>}
    </div>
  );
}

function TimeChip({ runTime }: { runTime: string }) {
  return (
    <div className="flex items-center gap-1 text-amber-200">
      <Image
        src="/images/sts2/ui/topbar/timer_icon.png"
        alt=""
        width={22}
        height={22}
        className="h-5 w-5 object-contain"
        unoptimized
      />
      <span className="font-bold tabular-nums">{runTime}</span>
    </div>
  );
}

// ----- Act row ---------------------------------------------------------------

function ActRow({
  act,
  history,
  highlightedFloor,
}: {
  act: ReplayActAnalysis;
  history: ReplayHistoryEntry[];
  highlightedFloor: number | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-zinc-900/40 px-3 py-2">
      <span className="w-20 shrink-0 text-sm font-bold text-amber-100">
        {act.actLabel}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {history.map((entry, i) => {
          const floor = act.baseFloor + i;
          const isHighlighted = highlightedFloor === floor;
          return (
            <ActNode
              key={i}
              act={act}
              entry={entry}
              stepIndex={i}
              isHighlighted={isHighlighted}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActNode({
  act,
  entry,
  stepIndex,
  isHighlighted,
}: {
  act: ReplayActAnalysis;
  entry: ReplayHistoryEntry;
  stepIndex: number;
  isHighlighted: boolean;
}) {
  const [hover, setHover] = useState(false);
  const lit = hover || isHighlighted;

  return (
    <span
      className="relative inline-flex h-6 w-6 items-center justify-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ zIndex: lit ? 20 : undefined }}
    >
      <span
        className={cn(
          "block h-full w-full transition-transform duration-150",
          lit && "scale-[1.6]",
        )}
        style={{
          // Cheap halo via stacked drop-shadows. The map's outline assets are
          // dark silhouette shadows (designed for the game's shaded layering),
          // not edge rings — using them as a "grey outline" looks wrong. CSS
          // drop-shadow gives a real edge ring around any sprite shape.
          filter: lit
            ? "drop-shadow(0 0 1px rgba(220,220,220,0.95)) drop-shadow(0 0 2px rgba(220,220,220,0.85)) drop-shadow(0 0 4px rgba(180,180,180,0.7))"
            : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nodeSpriteSrc(entry)}
          alt=""
          className="h-full w-full select-none object-contain"
          draggable={false}
        />
      </span>
      {hover && (
        <NodeTooltip act={act} stepIndex={stepIndex} entry={entry} />
      )}
    </span>
  );
}

// ----- Relics ----------------------------------------------------------------

function RelicSection({
  relics,
  relicsById,
  onHoverFloor,
}: {
  relics: TopbarState["relics"];
  relicsById: Record<string, CodexRelic>;
  onHoverFloor: (floor: number | null) => void;
}) {
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  const total = relics.length;
  const counts = countRelicsByFloor(relics);
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        {playback.relics.replace("{total}", String(total))}{" "}
        <span className="font-normal text-zinc-300">
          {playback.relicSplit
            .replace("{starter}", String(counts.starter))
            .replace("{gained}", String(counts.gained))}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {relics.map((r) => (
          <RelicIcon
            key={r.id}
            replayId={r.id}
            floor={r.floor}
            relic={relicsById[r.id]}
            onHoverFloor={onHoverFloor}
          />
        ))}
      </div>
    </div>
  );
}

function RelicIcon({
  replayId,
  floor,
  relic,
  onHoverFloor,
}: {
  replayId: string;
  floor: number;
  relic: CodexRelic | undefined;
  onHoverFloor: (floor: number | null) => void;
}) {
  const tables = useGameI18n();
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  const entity = buildRelicEntityInfo(relic);
  const label =
    localizeGame(tables, "relics", replayId) ?? relic?.name ?? replayId;

  // Hover binds two effects:
  //   1) entity preview tooltip (handled inside EntityPreview)
  //   2) the floor highlight upstream so the act-row lights the
  //      acquisition node
  const hoverHandlers = {
    onMouseEnter: () => onHoverFloor(floor),
    onMouseLeave: () => onHoverFloor(null),
  };

  // Starter relics (floor <= 0) carry no acquisition node, so we render a
  // bare icon without the floor-highlight binding.
  const tracksFloor = floor > 0;

  // The icon scales up on hover so the user sees the token grow even before
  // chasing the act-row highlight. Origin is the icon's own center so it
  // pops in place rather than displacing siblings.
  const iconNode = (
    <span className="relative block h-10 w-10 shrink-0 transition-transform duration-150 hover:z-20 hover:scale-[1.4]">
      <Image
        src={relicIconSrc(replayId)}
        alt={label}
        fill
        sizes="40px"
        className="object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        unoptimized
      />
    </span>
  );

  if (entity) {
    return (
      <span
        className="relative inline-block"
        title={`${label} · ${floor > 0 ? playback.floorGained.replace("{floor}", String(floor)) : playback.starterRelic}`}
        {...(tracksFloor ? hoverHandlers : {})}
      >
        <EntityPreview entity={entity} linkClassName="block">
          {iconNode}
        </EntityPreview>
      </span>
    );
  }

  // No codex match — fall back to an inert icon.
  return (
    <span
      className="relative inline-block"
      title={`${label} · ${floor > 0 ? playback.floorGained.replace("{floor}", String(floor)) : playback.starterRelic}`}
      {...(tracksFloor ? hoverHandlers : {})}
    >
      {iconNode}
    </span>
  );
}

function countRelicsByFloor(relics: TopbarState["relics"]) {
  let starter = 0;
  let gained = 0;
  for (const r of relics) {
    if (r.floor <= 0) starter += 1;
    else gained += 1;
  }
  return { starter, gained };
}

// ----- Deck ------------------------------------------------------------------

function DeckSection({
  deck,
  cardsById,
  onHoverFloor,
}: {
  deck: TopbarState["deck"];
  cardsById: Record<string, CodexCard>;
  onHoverFloor: (floor: number | null) => void;
}) {
  const tables = useGameI18n();
  const total = deck.reduce((acc, e) => acc + e.count, 0);
  const categories = formatDeckHistoryCategories(deck, tables);
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        {formatGameTemplate(gameUi(tables, "deckHeader", "Cards ({totalCards}):"), {
          totalCards: total,
        })}
        {categories ? (
          <span className="font-normal text-zinc-300"> {categories}</span>
        ) : null}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {deck.map((entry, index) => (
          <DeckEntry
            key={`${entry.id}-${entry.upgradeCount}-${entry.enchantmentId ?? ""}-${entry.enchantmentAmount ?? ""}-${index}`}
            entry={entry}
            cardsById={cardsById}
            onHoverFloor={onHoverFloor}
          />
        ))}
      </div>
    </div>
  );
}

function DeckEntry({
  entry,
  cardsById,
  onHoverFloor,
}: {
  entry: TopbarState["deck"][number];
  cardsById: Record<string, CodexCard>;
  onHoverFloor: (floor: number | null) => void;
}) {
  const tables = useGameI18n();
  const gameLocale = useGameLocale();
  const card = lookupHistoryCard(cardsById, entry.id);
  const baseName = historyCardDisplayName(entry.id, tables, card);
  const title = historyDeckCardTitle(baseName, entry.upgradeCount, card?.maxUpgradeLevel ?? 1);
  const label = entry.count > 1 ? `${entry.count}x ${title}` : title;
  const enchanted = Boolean(entry.enchantmentId);
  const upgraded = entry.upgradeCount > 0;
  const entity = buildCardEntityInfo(card, {
    upgradeLevel: entry.upgradeCount,
    enchantmentId: entry.enchantmentId,
    enchantmentAmount: entry.enchantmentAmount,
    locale: gameLocale,
  });
  const tracksFloor = entry.firstFloor > 0;
  const titleColor = enchanted ? TEXT_PURPLE : upgraded ? TEXT_GREEN : TEXT_CREAM;

  const hoverHandlers = {
    onMouseEnter: () => onHoverFloor(entry.firstFloor),
    onMouseLeave: () => onHoverFloor(null),
  };

  const labelNode = (
    <span className="min-w-0 truncate" style={{ color: titleColor }}>
      {label}
    </span>
  );

  const iconNode = (
    <HistoryTinyCardIcon
      id={entry.id}
      width={22}
      enchantmentId={entry.enchantmentId}
    />
  );

  const rowClass = cn(
    "flex items-center gap-1.5 text-xs origin-left transition-transform duration-150",
    "hover:z-20 hover:scale-110",
  );

  if (!entity) {
    return (
      <div className={rowClass} {...(tracksFloor ? hoverHandlers : {})}>
        {iconNode}
        {labelNode}
      </div>
    );
  }

  return (
    <div
      className={cn("relative", rowClass)}
      {...(tracksFloor ? hoverHandlers : {})}
    >
      <EntityPreview
        entity={entity}
        linkClassName="inline-flex min-w-0 max-w-full items-center gap-1.5 cursor-pointer hover:text-amber-200 transition-colors"
      >
        <span className="shrink-0">{iconNode}</span>
        {labelNode}
      </EntityPreview>
    </div>
  );
}

function historyDeckCardTitle(
  name: string,
  upgradeLevel: number,
  maxUpgradeLevel: number,
): string {
  if (upgradeLevel < 1) return name;
  if (maxUpgradeLevel > 1) return `${name}+${upgradeLevel}`;
  return `${name}+`;
}

const DECK_HISTORY_RARITY_ORDER = [
  { rarity: "퀘스트", uiKey: "cardRarityQuest", fallback: "Quest" },
  { rarity: "이벤트", uiKey: "cardRarityEvent", fallback: "Event" },
  { rarity: "희귀", uiKey: "cardRarityRare", fallback: "Rare" },
  { rarity: "고급", uiKey: "cardRarityUncommon", fallback: "Uncommon" },
  { rarity: "일반", uiKey: "cardRarityCommon", fallback: "Common" },
  { rarity: "저주", uiKey: "cardRarityCurse", fallback: "Curse" },
  { rarity: "기본", uiKey: "cardRarityBasic", fallback: "Starter" },
] as const;

function formatDeckHistoryCategories(
  deck: TopbarState["deck"],
  tables: GameI18nTables,
): string {
  const counts = new Map<string, number>();
  for (const entry of deck) {
    const rarity = lookupHistoryCardVisual(entry.id)?.rarity ?? "기본";
    counts.set(rarity, (counts.get(rarity) ?? 0) + entry.count);
  }
  return DECK_HISTORY_RARITY_ORDER.flatMap(({ rarity, uiKey, fallback }) => {
    const n = counts.get(rarity) ?? 0;
    if (n <= 0) return [];
    return [`${n} ${gameUi(tables, uiKey, fallback)}`];
  }).join(", ");
}

// ----- Helpers ---------------------------------------------------------------

function formatRunTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "0:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatRunDate(
  startTime: number | string | null | undefined,
  serviceLocale: "ko" | "en",
): string {
  if (!startTime) return "";
  const date =
    typeof startTime === "number"
      ? new Date(startTime * 1000)
      : new Date(startTime);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(serviceLocale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// ----- Back button -----------------------------------------------------------

/** Mirrors the codex back button so the replay panel feels like a fellow
 *  destination on the site, not a modal. Stays pinned to the bottom-left
 *  even as the panel scrolls. */
function BackButton({ onClose }: { onClose: () => void }) {
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  return (
    <button
      type="button"
      onClick={onClose}
      className="group fixed bottom-8 left-0 z-[60]"
      aria-label={playback.backToReplay}
    >
      <div className="relative h-[80px] w-[160px]">
        {/* Shadow layer */}
        <Image
          src="/images/sts2/ui/back_button.png"
          alt=""
          fill
          sizes="160px"
          className="translate-x-[-2px] translate-y-[2px] object-contain opacity-25 blur-[1px]"
          aria-hidden
          unoptimized
        />
        {/* Outline (visible on hover) */}
        <Image
          src="/images/sts2/ui/back_button_outline.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain opacity-0 mix-blend-screen transition-opacity duration-200 group-hover:opacity-80"
          aria-hidden
          unoptimized
        />
        {/* Main button body */}
        <Image
          src="/images/sts2/ui/back_button.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain transition-all duration-200 group-hover:brightness-125"
          aria-hidden
          unoptimized
        />
        <div className="absolute inset-0 flex items-center justify-center pl-4">
          <Image
            src="/images/sts2/ui/back_button_arrow.png"
            alt=""
            width={48}
            height={40}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-110"
            unoptimized
          />
        </div>
      </div>
    </button>
  );
}
