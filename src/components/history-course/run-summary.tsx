"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CardActionIcon } from "@/components/history-course/card-action-icon";
import { localize } from "@/lib/sts2-i18n";
import gameOverQuotes from "@/lib/sts2-game-over-quotes-ko.json";
import type { CodexCard } from "@/lib/codex-types";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
  ReplayRun,
} from "@/lib/sts2-run-replay";
import type { TopbarState } from "@/components/history-course/topbar-state";
import { cn } from "@/lib/utils";

// ============================================================================
// End-of-run summary, mirroring `MegaCrit.Sts2.Core.Nodes.Screens.RunHistoryScreen.NRunHistory`.
// Two phases:
//   1. enter (1500ms) — death backstop: two crimson half-screen layers
//      slide in from top/bottom, then crossfade to the panel backdrop.
//      Approximation of the game's shader threshold tween (0→1 InOutSine,
//      1.5s) — without the shader source on hand, two stacked layers do
//      the same job to the eye.
//   2. shown — full panel: top-bar mirror, quote, per-act node icon row,
//      relic strip, deck card grid.
// ============================================================================

const ENTER_MS = 1500;
const FADE_TO_PANEL_MS = 500;

// Same character helpers used by the on-map marker — duplicated so this
// component stays self-contained.
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

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

interface Props {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
  visible: boolean;
}

export function RunSummary({
  run,
  acts,
  topbarState,
  cardsById,
  visible,
}: Props) {
  const [phase, setPhase] = useState<"hidden" | "enter" | "shown">("hidden");

  useEffect(() => {
    if (!visible) {
      setPhase("hidden");
      return;
    }
    setPhase("enter");
    const t = window.setTimeout(() => setPhase("shown"), ENTER_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (phase === "hidden") return null;

  return (
    <div
      data-testid="run-summary-overlay"
      className="pointer-events-auto absolute inset-0 z-50 overflow-hidden"
    >
      <DeathBackstop phase={phase} />
      {phase === "shown" && (
        <SummaryPanel
          run={run}
          acts={acts}
          topbarState={topbarState}
          cardsById={cardsById}
        />
      )}
    </div>
  );
}

/** Death backstop — two crimson layers close in vertically with hand-built
 *  drip silhouettes along the seam. CSS keyframes drive the slide-in once
 *  on mount so we don't have to fight React's "transitions only fire on
 *  prop change" behaviour. Mirrors the visual feel of the game's shader
 *  threshold tween (0→1 InOutSine, 1.5s). */
function DeathBackstop({ phase }: { phase: "enter" | "shown" }) {
  return (
    <>
      <style>{`
        @keyframes hc-blood-slide-down {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
        @keyframes hc-blood-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      <div
        aria-hidden
        data-testid="hc-blood-top"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: "60%",
          animation:
            "hc-blood-slide-down 1100ms cubic-bezier(0.6, 0, 0.4, 1) both",
        }}
      >
        <BloodHalfSvg variant="top" />
      </div>
      <div
        aria-hidden
        data-testid="hc-blood-bottom"
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: "60%",
          animation:
            "hc-blood-slide-up 1100ms cubic-bezier(0.6, 0, 0.4, 1) both",
        }}
      >
        <BloodHalfSvg variant="bottom" />
      </div>
      {/* Once the bands have closed in, fade to the panel backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-zinc-950"
        style={{
          opacity: phase === "shown" ? 0.92 : 0,
          transition: `opacity ${FADE_TO_PANEL_MS}ms ease-out`,
        }}
      />
    </>
  );
}

/** SVG silhouette for one crimson half — a deterministic procedural drip
 *  edge along the inside seam. Two stable seeds differentiate top vs.
 *  bottom so the seam reads as two interleaving streams rather than one
 *  mirrored line. preserveAspectRatio=none lets the path stretch to fill
 *  the wrapping div across any container width. */
function BloodHalfSvg({ variant }: { variant: "top" | "bottom" }) {
  const w = 1000;
  const h = 600;
  // Solid crimson body height (everything above this is filled), drip
  // tendrils dangle down past it on the seam. For "top" the drips hang
  // down; for "bottom" they hang up.
  const baseY = 460;
  const drips = buildDripPath(variant, w, h, baseY);
  const gradId = variant === "top" ? "hc-blood-grad-top" : "hc-blood-grad-bot";
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {variant === "top" ? (
            <>
              <stop offset="0%" stopColor="rgba(38,3,6,0.98)" />
              <stop offset="55%" stopColor="rgba(150,10,18,1)" />
              <stop offset="100%" stopColor="rgba(210,28,36,1)" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="rgba(210,28,36,1)" />
              <stop offset="45%" stopColor="rgba(150,10,18,1)" />
              <stop offset="100%" stopColor="rgba(38,3,6,0.98)" />
            </>
          )}
        </linearGradient>
      </defs>
      <path d={drips} fill={`url(#${gradId})`} />
    </svg>
  );
}

/** Build a closed crimson silhouette path with drip tendrils on the seam
 *  edge. `variant=top` builds a region that fills 0..baseY across the
 *  whole width and dangles drips downward to baseY+depth; `variant=bottom`
 *  is the vertical mirror so its drips dangle upward into the seam. */
function buildDripPath(
  variant: "top" | "bottom",
  w: number,
  h: number,
  baseY: number,
): string {
  // Deterministic per-variant drip seeds. Different counts/widths give
  // an asymmetric seam.
  const drips =
    variant === "top"
      ? [
          { x: 60, depth: 92, width: 38 },
          { x: 145, depth: 48, width: 28 },
          { x: 215, depth: 132, width: 44 },
          { x: 305, depth: 70, width: 30 },
          { x: 385, depth: 110, width: 36 },
          { x: 470, depth: 56, width: 26 },
          { x: 545, depth: 100, width: 42 },
          { x: 625, depth: 78, width: 32 },
          { x: 705, depth: 124, width: 40 },
          { x: 790, depth: 60, width: 28 },
          { x: 860, depth: 96, width: 34 },
          { x: 935, depth: 70, width: 30 },
        ]
      : [
          { x: 30, depth: 76, width: 30 },
          { x: 110, depth: 118, width: 42 },
          { x: 180, depth: 60, width: 28 },
          { x: 260, depth: 102, width: 38 },
          { x: 350, depth: 66, width: 30 },
          { x: 425, depth: 130, width: 44 },
          { x: 510, depth: 80, width: 32 },
          { x: 600, depth: 110, width: 40 },
          { x: 680, depth: 54, width: 26 },
          { x: 770, depth: 92, width: 36 },
          { x: 855, depth: 120, width: 42 },
          { x: 940, depth: 64, width: 28 },
        ];

  // Mirror Y for the bottom variant — so its body fills h..(h-baseY) and
  // drips reach up into the seam.
  const flip = (y: number) => (variant === "top" ? y : h - y);

  // Start at top-left of the body, sweep along the body's seam edge while
  // dropping smooth teardrop tendrils, then close back along the outer
  // top.
  const parts: string[] = [];
  parts.push(`M 0 ${flip(0)}`);
  parts.push(`L ${w} ${flip(0)}`);
  parts.push(`L ${w} ${flip(baseY)}`);
  // Sort right to left so we walk the seam in one direction.
  const sorted = [...drips].sort((a, b) => b.x - a.x);
  for (const d of sorted) {
    const left = d.x - d.width / 2;
    const right = d.x + d.width / 2;
    parts.push(`L ${right} ${flip(baseY)}`);
    // Smooth teardrop — wide shoulders that swell slightly past the
    // base, narrowing to a rounded tip. Two cubic Beziers, one per side.
    //   right shoulder → tip:
    //     C right(swell)              right(belly)         tip
    //   tip → left shoulder:
    //     C left(belly)               left(swell)          left
    const tipX = d.x;
    const tipY = flip(baseY + d.depth);
    const swellOut = d.width * 0.42; // bulge outward at the shoulders
    const shoulderSwell = baseY + d.depth * 0.18;
    const bellyY = baseY + d.depth * 0.62;
    parts.push(
      `C ${right + swellOut} ${flip(shoulderSwell)} ${tipX + d.width * 0.18} ${flip(bellyY)} ${tipX} ${tipY}`,
    );
    parts.push(
      `C ${tipX - d.width * 0.18} ${flip(bellyY)} ${left - swellOut} ${flip(shoulderSwell)} ${left} ${flip(baseY)}`,
    );
  }
  // Close back to the left edge along the seam, then up along the outer
  // edge to the start.
  parts.push(`L 0 ${flip(baseY)}`);
  parts.push("Z");
  return parts.join(" ");
}

/** Panel content — mirrors NRunHistory's body. */
function SummaryPanel({
  run,
  acts,
  topbarState,
  cardsById,
}: {
  run: ReplayRun;
  acts: ReplayActAnalysis[];
  topbarState: TopbarState;
  cardsById: Record<string, CodexCard>;
}) {
  const character = run.players[0]?.character ?? "CHARACTER.IRONCLAD";
  const charLabel = characterLabel(character);
  const charIcon = characterIconSrc(character);
  const finalFloor = topbarState.currentFloor;

  // Run time — total seconds from run.run_time.
  const runTimeStr = formatRunTime(run.run_time ?? 0);

  // Date — fall back to current date if not present.
  const dateStr = formatRunDate(run.start_time);

  return (
    <div
      data-testid="summary-panel"
      className="absolute inset-0 flex items-start justify-center overflow-y-auto px-6 py-8"
      style={{ animation: "summary-fade-in 600ms ease-out both" }}
    >
      <style>{`
        @keyframes summary-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="w-full max-w-[1100px] text-zinc-100">
        {/* ----- Top mirror row — character / hp / gold / ascension /
                potion slots / time / date / seed / build ----- */}
        <header className="flex flex-wrap items-center gap-3 border-b border-amber-500/20 pb-3">
          <CharacterChip iconSrc={charIcon} label={charLabel} />
          <HpChip hp={topbarState.hp} maxHp={topbarState.maxHp} />
          <GoldChip gold={topbarState.gold} />
          <PotionStrip slots={topbarState.potionSlots} />
          <AscensionChip ascension={run.ascension} />
          <ScoreChip win={run.win} floor={finalFloor} />
          <TimeChip runTime={runTimeStr} />
          <div className="ml-auto text-right text-[11px] leading-snug text-zinc-400">
            <div>{dateStr}</div>
            <div>시드: {run.seed}</div>
            <div className="text-amber-200/80">
              {run.win ? "승리" : "패배"} · {finalFloor}층
            </div>
            <div className="text-zinc-500">v{run.build_id}</div>
          </div>
        </header>

        {/* ----- Banner (BANNER.lose* / BANNER.trueWin) + mood quote
                (QUOTES.* / MAP_POINT_HISTORY.falseVictory.*) — both
                deterministic per seed. ----- */}
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

        {/* ----- Three act rows ----- */}
        <section className="mt-5 space-y-2">
          {acts.map((act) => (
            <ActRow key={`${act.actId}-${act.actIndex}`} act={act} />
          ))}
        </section>

        {/* ----- Relics ----- */}
        <section className="mt-6">
          <RelicSection relics={topbarState.relics} run={run} />
        </section>

        {/* ----- Deck cards ----- */}
        <section className="mt-6 mb-8">
          <DeckSection
            deck={topbarState.deck}
            cardsById={cardsById}
            run={run}
          />
        </section>
      </div>
    </div>
  );
}

// ----- Top mirror chips ------------------------------------------------------

function CharacterChip({
  iconSrc,
  label,
}: {
  iconSrc: string;
  label: string;
}) {
  return (
    <div
      className="relative h-12 w-12 shrink-0"
      title={label}
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
    </div>
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

function PotionStrip({ slots }: { slots: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className="h-6 w-4 rounded-full border border-zinc-600 bg-zinc-900/60"
          aria-hidden
        />
      ))}
    </div>
  );
}

function AscensionChip({ ascension }: { ascension: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-300">
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        width={22}
        height={22}
        className="h-5 w-5 object-contain"
        unoptimized
      />
      <span className="font-bold tabular-nums">A{ascension}</span>
    </div>
  );
}

function ScoreChip({ win, floor }: { win: boolean; floor: number }) {
  // The game shows a numeric "score" — without the score formula on hand
  // we settle for a `f${floor}` indicator that reads like the topbar
  // floor count. Keep it minimal so the space stays tight.
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
    <div className="flex items-center gap-1 text-zinc-300">
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

function ActRow({ act }: { act: ReplayActAnalysis }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-zinc-900/40 px-3 py-2">
      <span className="w-20 shrink-0 text-sm font-bold text-amber-100">
        {act.actLabel}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {act.history.map((entry, i) => {
          /* eslint-disable @next/next/no-img-element */
          return (
            <img
              key={i}
              src={nodeSpriteSrc(entry)}
              alt=""
              className="h-6 w-6 select-none object-contain"
              draggable={false}
            />
          );
          /* eslint-enable @next/next/no-img-element */
        })}
      </div>
    </div>
  );
}

// ----- Relics ----------------------------------------------------------------

function RelicSection({
  relics,
  run,
}: {
  relics: TopbarState["relics"];
  run: ReplayRun;
}) {
  // Bucket by source (rough rarity grouping the game uses on the panel).
  // We don't ship per-relic rarity metadata, so this is a lightweight
  // approximation derived from floor of acquisition.
  const total = relics.length;
  const counts = countRelicsByFloor(relics);
  void run;
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        유물 ({total}):{" "}
        <span className="text-zinc-300 font-normal">
          {counts.starter}개 시작 · {counts.gained}개 획득
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {relics.map((r) => (
          <div
            key={r.id}
            title={localize("relics", r.id) ?? r.id}
            className="relative h-10 w-10 shrink-0"
          >
            <Image
              src={relicIconSrc(r.id)}
              alt=""
              fill
              sizes="40px"
              className="object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
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
  run,
}: {
  deck: TopbarState["deck"];
  cardsById: Record<string, CodexCard>;
  run: ReplayRun;
}) {
  const total = deck.reduce((acc, e) => acc + e.count, 0);
  const counts = countDeckByRarity(deck, cardsById);
  void run;
  return (
    <div>
      <p className="text-xs font-bold text-amber-200">
        카드 ({total}):{" "}
        <span className="text-zinc-300 font-normal">
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
          />
        ))}
      </div>
    </div>
  );
}

function DeckEntry({
  entry,
  cardsById,
}: {
  entry: TopbarState["deck"][number];
  cardsById: Record<string, CodexCard>;
}) {
  const card = cardsById[entry.id];
  const label = card
    ? localize("cards", entry.id) ?? card.name
    : entry.id.split(".").pop() ?? "?";
  const upgraded = entry.upgradeCount > 0;
  const enchanted = false; // No per-card enchantment tracking on hand.
  return (
    <div className="flex items-center gap-1.5">
      {card ? (
        <CardActionIcon card={card} width={22} />
      ) : (
        <div aria-hidden className="h-[22px] w-[22px] shrink-0" />
      )}
      <span
        className={cn(
          "truncate text-xs",
          upgraded
            ? "text-emerald-300"
            : enchanted
              ? "text-violet-300"
              : "text-zinc-200",
        )}
      >
        {entry.count > 1 && (
          <span className="text-zinc-400">{entry.count}× </span>
        )}
        {label}
        {upgraded && <span className="text-emerald-300">+</span>}
      </span>
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

// ---- Banner + quote pickers, mirroring NGameOverScreen + NRunHistory ------
//
// NGameOverScreen.InitializeBannerAndQuote:
//   if win  → BANNER.trueWin + (banner falseWin used inside game for false-win)
//   if lose → random pick from BANNER.lose0..7 + random pick from QUOTES.0..16
//
// NRunHistory.LoadDeathQuote (the historical-view quote, also the encounter
// quote shown after the user clicks Continue):
//   win     → random pick from MAP_POINT_HISTORY.falseVictory.0..1
//   abandon → random pick from MAP_POINT_HISTORY.abandon.0..2
//   loss    → encounter-specific (skipped — we don't carry encounter death
//             metadata for replay fixtures yet)
//
// Both pickers use Rng(StringHelper.GetDeterministicHashCode(history.Seed)).
// We reproduce the determinism with a simple stable hash on the seed.

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

function quoteFor(
  seed: string,
  character: string,
  win: boolean,
): string {
  // Win: "false victory" line interpolated with character title.
  if (win) {
    const tmpl = pickByPrefix("MAP_POINT_HISTORY.falseVictory.", seed);
    if (tmpl) return interpolateCharacter(tmpl, character);
    return "";
  }
  // Loss: opening mood quote (QUOTES.*). Encounter-specific death lines
  // require encounter metadata we don't carry, so we surface the same
  // generic mood quote NGameOverScreen shows on the death entry tween.
  return pickByPrefix("QUOTES.", seed) ?? "";
}

function interpolateCharacter(template: string, character: string): string {
  // The game uses {character} / {possessiveAdjective} inside the false-
  // victory templates. We only replace {character} (subject form) — the
  // possessive in our localised set always reads correctly without a
  // gendered adjective in Korean.
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
