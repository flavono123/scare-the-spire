"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CardActionIcon } from "@/components/history-course/card-action-icon";
import { NodeTooltip } from "@/components/history-course/node-tooltip";
import {
  EntityPreview,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import { localize } from "@/lib/sts2-i18n";
import gameOverQuotes from "@/lib/sts2-game-over-quotes-ko.json";
import type { CodexCard, CodexRelic } from "@/lib/codex-types";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
  ReplayRun,
} from "@/lib/sts2-run-replay";
import type { TopbarState } from "@/components/history-course/topbar-state";
import { cn } from "@/lib/utils";

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

const KNOWN_CHARACTERS = new Set([
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
]);

function characterIconSrc(character: string): string {
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  const safe = KNOWN_CHARACTERS.has(slug) ? slug : "ironclad";
  return `/images/sts2/characters/character_icon_${safe}.webp`;
}

function characterLabel(character: string): string {
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  return (
    {
      ironclad: "아이언클래드",
      silent: "사일런트",
      defect: "디펙트",
      necrobinder: "네크로바인더",
      regent: "리젠트",
    }[slug] ?? slug
  );
}

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

// Outline asset alongside each node sprite — see `public/images/sts2/run-history/*_outline.png`.
// Returns the outline path matching the node's primary sprite. Boss nodes use
// boss portraits (no matching outline), so we fall back to the generic monster
// outline for those. Returns null when the entry has no outline at all.
function nodeOutlineSrc(entry: ReplayHistoryEntry): string | null {
  const modelId = entry.rooms?.[0]?.model_id ?? null;
  if (entry.map_point_type === "ancient") {
    if (modelId) {
      const m = modelId.match(/^EVENT\.(.+)$/);
      if (m && ANCIENT_KEYS.has(m[1])) {
        return `/images/sts2/run-history/${m[1].toLowerCase()}_outline.png`;
      }
    }
    return "/images/sts2/run-history/ancient.png";
  }
  if (modelId === "EVENT.NEOW") return "/images/sts2/run-history/neow_outline.png";
  if (entry.map_point_type === "boss") {
    const bossKey = bossKeyFromEntry(entry);
    if (bossKey) return `/images/sts2/run-history/${bossKey.toLowerCase()}_outline.png`;
    return null;
  }
  switch (entry.map_point_type) {
    case "monster":
      return "/images/sts2/run-history/monster_outline.png";
    case "elite":
      return "/images/sts2/run-history/elite_outline.png";
    case "rest_site":
      return "/images/sts2/run-history/rest_site_outline.png";
    case "treasure":
      return "/images/sts2/run-history/treasure_outline.png";
    case "shop":
      return "/images/sts2/run-history/shop_outline.png";
    case "unknown":
      return "/images/sts2/run-history/event_outline.png";
    default:
      return null;
  }
}

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

// Build the minimal EntityInfo a relic icon needs to drive an EntityPreview
// (rich tooltip + click-through to the codex relic page).
function buildRelicEntityInfo(
  replayId: string,
  relic: CodexRelic | undefined,
): EntityInfo | null {
  if (!relic) return null;
  return {
    id: relic.id,
    nameEn: relic.nameEn,
    nameKo: relic.name,
    imageUrl: relic.imageUrl,
    color: relic.pool,
    type: "relic",
    relicData: relic,
  };
}

function buildCardEntityInfo(card: CodexCard | undefined): EntityInfo | null {
  if (!card) return null;
  return {
    id: card.id,
    nameEn: card.nameEn,
    nameKo: card.name,
    imageUrl: card.imageUrl,
    color: card.color,
    type: "card",
    cardData: card,
  };
}

interface Props {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
  relicsById: Record<string, CodexRelic>;
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
  open,
  ended,
  currentActIndex,
  currentStep,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <div
      data-testid="run-summary-overlay"
      className="pointer-events-auto absolute inset-0 z-50 overflow-y-auto bg-zinc-950/96"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <SummaryPanel
        run={run}
        acts={acts}
        topbarState={topbarState}
        cardsById={cardsById}
        relicsById={relicsById}
        ended={ended}
        currentActIndex={currentActIndex}
        currentStep={currentStep}
      />
      <BackButton onClose={onClose} />
    </div>
  );
}

// ----- Banner + quote pickers (see `data/sts2/kor/game_over_screen.json`) ---
//
// NGameOverScreen.InitializeBannerAndQuote + NRunHistory.LoadDeathQuote.
// Win  → BANNER.trueWin + MAP_POINT_HISTORY.falseVictory.* (with character
//        substituted in).
// Loss → random BANNER.lose0..7 + random QUOTES.00..16. Deterministic on
//        the run seed.

const QUOTES_TABLE = gameOverQuotes as Record<string, string>;

function stableHashFromSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickByPrefix(prefix: string, seed: string): string | null {
  const keys = Object.keys(QUOTES_TABLE)
    .filter((k) => k.startsWith(prefix))
    .sort();
  if (keys.length === 0) return null;
  const idx = stableHashFromSeed(prefix + ":" + seed) % keys.length;
  return QUOTES_TABLE[keys[idx]] ?? null;
}

function bannerFor(seed: string, win: boolean): string {
  if (win) return QUOTES_TABLE["BANNER.trueWin"] ?? "승리";
  return pickByPrefix("BANNER.lose", seed) ?? "패배";
}

function quoteFor(seed: string, character: string, win: boolean): string {
  if (win) {
    const tmpl = pickByPrefix("MAP_POINT_HISTORY.falseVictory.", seed);
    if (tmpl) return interpolateCharacter(tmpl, character);
    return "";
  }
  return pickByPrefix("QUOTES.", seed) ?? "";
}

function interpolateCharacter(template: string, character: string): string {
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  const label =
    {
      ironclad: "아이언클래드",
      silent: "사일런트",
      defect: "디펙트",
      necrobinder: "네크로바인더",
      regent: "리젠트",
    }[slug] ?? slug;
  return template
    .replace(/\{character\}/g, label)
    .replace(/\{possessiveAdjective\}/g, "그의");
}

// ----- Panel body -----------------------------------------------------------

function SummaryPanel({
  run,
  acts,
  topbarState,
  cardsById,
  relicsById,
  ended,
  currentActIndex,
  currentStep,
}: {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
  relicsById: Record<string, CodexRelic>;
  ended: boolean;
  currentActIndex: number;
  currentStep: number;
}) {
  const character = run.players[0]?.character ?? "CHARACTER.IRONCLAD";
  const charLabel = characterLabel(character);
  const charIcon = characterIconSrc(character);
  const finalFloor = topbarState.currentFloor;
  const runTimeStr = formatRunTime(run.run_time ?? 0);
  const dateStr = formatRunDate(run.start_time);

  // Cross-section hover state. Hovering a relic / deck card sets the
  // floor at which it was acquired; the act rows then highlight that
  // floor's node. Null means nothing is being hovered.
  const [highlightedFloor, setHighlightedFloor] = useState<number | null>(null);

  // Truncate per current playback position. Past acts render fully; the
  // current act stops at `currentStep`; future acts disappear.
  const visibleActs = acts
    .map((act, idx) => {
      if (idx < currentActIndex) return { act, history: act.history };
      if (idx === currentActIndex) {
        return { act, history: act.history.slice(0, Math.max(0, currentStep)) };
      }
      return null;
    })
    .filter((x): x is { act: ReplayActAnalysis; history: ReplayHistoryEntry[] } => x !== null);

  return (
    <div
      data-testid="summary-panel"
      className="mx-auto w-full max-w-[1100px] px-6 py-8 text-zinc-100"
      style={{ animation: "summary-fade-in 280ms ease-out both" }}
    >
      <style>{`
        @keyframes summary-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="flex flex-wrap items-center gap-3 border-b border-amber-500/20 pb-3">
        <CharacterChip
          iconSrc={charIcon}
          label={charLabel}
          ascension={run.ascension}
        />
        <HpChip hp={topbarState.hp} maxHp={topbarState.maxHp} />
        <GoldChip gold={topbarState.gold} />
        <PotionStrip slots={topbarState.potionSlots} />
        <ScoreChip win={run.win && ended} floor={finalFloor} />
        <TimeChip runTime={runTimeStr} />
        <div className="ml-auto text-right text-[11px] leading-snug text-zinc-400">
          {dateStr && <div>{dateStr}</div>}
          <div>시드: {run.seed}</div>
          <div className="text-amber-200/80">
            {ended ? (run.win ? "승리" : "패배") : "진행 중"} · {finalFloor}층
          </div>
          <div className="text-zinc-500">v{run.build_id}</div>
        </div>
      </header>

      {/* Banner / quote — only after the run actually ends. Mid-run the
       *  panel reads as a "current state" view, so emotional copy is
       *  inappropriate. */}
      {ended && (
        <div className="mt-4 text-center">
          <h2
            className="text-3xl font-black tracking-tight"
            style={{
              color: run.win ? "#fbbf24" : "#fca5a5",
              textShadow: "0 2px 12px rgba(0,0,0,0.85)",
            }}
          >
            {bannerFor(run.seed, run.win)}
          </h2>
          {(() => {
            const q = quoteFor(run.seed, character, run.win);
            if (!q) return null;
            return (
              <p className="mt-2 text-sm italic text-zinc-300">
                {QUOTES_TABLE["ENCOUNTER_QUOTE_LEFT"] ?? "「"}
                {q}
                {QUOTES_TABLE["ENCOUNTER_QUOTE_RIGHT"] ?? "」"}
              </p>
            );
          })()}
        </div>
      )}

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

function CharacterChip({
  iconSrc,
  label,
  ascension,
}: {
  iconSrc: string;
  label: string;
  ascension: number;
}) {
  return (
    <div
      className="relative h-12 w-12 shrink-0"
      title={ascension > 0 ? `${label} · 승천 ${ascension}` : label}
      style={{
        backgroundImage: "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-1 overflow-hidden">
        <Image
          src={iconSrc}
          alt={label}
          fill
          sizes="44px"
          className="object-contain"
          unoptimized
        />
      </div>
      {ascension > 0 && <AscensionBadge ascension={ascension} />}
    </div>
  );
}

function AscensionBadge({ ascension }: { ascension: number }) {
  return (
    <span
      className="pointer-events-none absolute -bottom-0.5 -right-1 flex h-7 w-7 items-end justify-center"
      aria-label={`승천 ${ascension}`}
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        fill
        sizes="28px"
        className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        unoptimized
      />
      <span className="relative z-10 mb-0.5 text-[13px] font-bold leading-none text-white">
        {ascension}
      </span>
    </span>
  );
}

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
function PotionStrip({ slots }: { slots: number }) {
  return (
    <div
      title={`포션 슬롯 ${slots}개`}
      className="relative inline-flex items-center gap-1 px-1"
      style={{
        borderImage:
          "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png) 28 fill / 8px / 0 stretch",
        borderStyle: "solid",
        borderWidth: "8px",
      }}
    >
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} className="relative h-6 w-5">
          <Image
            src="/images/sts2/ui/topbar/potion_placeholder.png"
            alt=""
            fill
            sizes="20px"
            className="object-contain opacity-90"
            unoptimized
          />
        </div>
      ))}
    </div>
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
  const outline = nodeOutlineSrc(entry);

  return (
    <span
      className="relative inline-flex h-6 w-6 items-center justify-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Outline + scale pop on hover. The outline asset is the matching
       *  *_outline.png shipped alongside each node sprite — desaturated to
       *  read as a neutral grey ring instead of competing with the colored
       *  fill. */}
      <span
        className={cn(
          "absolute inset-0 transition-transform duration-150",
          (hover || isHighlighted) && "scale-[1.6]",
        )}
      >
        {outline && (hover || isHighlighted) && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={outline}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain opacity-90"
            style={{
              filter:
                "brightness(0) invert(0.85) drop-shadow(0 0 2px rgba(255,255,255,0.45))",
            }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nodeSpriteSrc(entry)}
          alt=""
          className="relative h-full w-full select-none object-contain"
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
  const total = relics.length;
  const counts = countRelicsByFloor(relics);
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        유물 ({total}):{" "}
        <span className="font-normal text-zinc-300">
          {counts.starter}개 시작 · {counts.gained}개 획득
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
  const entity = buildRelicEntityInfo(replayId, relic);
  const label = relic?.name ?? localize("relics", replayId) ?? replayId;

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

  const iconNode = (
    <span className="relative block h-10 w-10 shrink-0">
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
        className="inline-block"
        title={`${label} · ${floor > 0 ? `${floor}층 획득` : "시작 유물"}`}
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
      title={`${label} · ${floor > 0 ? `${floor}층 획득` : "시작 유물"}`}
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
  const total = deck.reduce((acc, e) => acc + e.count, 0);
  const counts = countDeckByRarity(deck, cardsById);
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        카드 ({total}):{" "}
        <span className="font-normal text-zinc-300">
          {counts.rare}개 희귀 · {counts.uncommon}개 고급 · {counts.common}개
          일반 · {counts.curse}개 저주 · {counts.starter}개 시작
        </span>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {deck.map((entry) => (
          <DeckEntry
            key={`${entry.id}-${entry.firstFloor}`}
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
  const card = cardsById[entry.id];
  const label = card
    ? localize("cards", entry.id) ?? card.name
    : entry.id.split(".").pop() ?? "?";
  const upgraded = entry.upgradeCount > 0;
  const entity = buildCardEntityInfo(card);
  const tracksFloor = entry.firstFloor > 0;

  const hoverHandlers = {
    onMouseEnter: () => onHoverFloor(entry.firstFloor),
    onMouseLeave: () => onHoverFloor(null),
  };

  // Card name + icon both lead to the codex card page. The icon renders the
  // CardActionIcon (action-typed glyph) so the row stays scannable; the name
  // is the textual link with the rarity color.
  const labelNode = (
    <span className={cn("truncate", upgraded ? "text-emerald-300" : "text-zinc-200")}>
      {entry.count > 1 && (
        <span className="text-zinc-400">{entry.count}× </span>
      )}
      {label}
      {upgraded && <span className="text-emerald-300">+</span>}
    </span>
  );

  const iconNode = card ? (
    <CardActionIcon card={card} width={22} />
  ) : (
    <div aria-hidden className="h-[22px] w-[22px] shrink-0" />
  );

  if (!entity) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs"
        {...(tracksFloor ? hoverHandlers : {})}
      >
        {iconNode}
        {labelNode}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      {...(tracksFloor ? hoverHandlers : {})}
    >
      <Link
        href={`/codex/cards?card=${entity.id.toLowerCase()}`}
        className="shrink-0"
        aria-label={`${entity.nameKo} 카드 페이지`}
      >
        {iconNode}
      </Link>
      <EntityPreview entity={entity} linkClassName="cursor-pointer hover:text-amber-200 transition-colors">
        {labelNode}
      </EntityPreview>
    </div>
  );
}

function countDeckByRarity(
  deck: TopbarState["deck"],
  cardsById: Record<string, CodexCard>,
) {
  let rare = 0;
  let uncommon = 0;
  let common = 0;
  let curse = 0;
  let starter = 0;
  for (const entry of deck) {
    const card = cardsById[entry.id];
    const rarity = card?.rarity ?? "기본";
    const n = entry.count;
    if (rarity === "희귀") rare += n;
    else if (rarity === "고급") uncommon += n;
    else if (rarity === "일반") common += n;
    else if (rarity === "저주") curse += n;
    else starter += n;
  }
  return { rare, uncommon, common, curse, starter };
}

// ----- Helpers ---------------------------------------------------------------

function formatRunTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "0:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatRunDate(startTime: number | string | null | undefined): string {
  if (!startTime) return "";
  const date =
    typeof startTime === "number"
      ? new Date(startTime * 1000)
      : new Date(startTime);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${y}년 ${m}월 ${d}일 ${hh}:${mm}`;
}

// ----- Back button -----------------------------------------------------------

/** Mirrors the codex back button so the replay panel feels like a fellow
 *  destination on the site, not a modal. Stays pinned to the bottom-left
 *  even as the panel scrolls. */
function BackButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="group fixed bottom-8 left-0 z-[60]"
      aria-label="리플레이로 돌아가기"
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
            alt="뒤로가기"
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
