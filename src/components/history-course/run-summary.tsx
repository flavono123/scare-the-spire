"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CardActionIcon } from "@/components/history-course/card-action-icon";
import { localize } from "@/lib/sts2-i18n";
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

/** Death backstop — two crimson layers close in vertically, then crossfade
 *  to a near-black panel backdrop. Approximates the game's shader threshold
 *  tween (0→1 InOutSine, 1.5s). */
function DeathBackstop({ phase }: { phase: "enter" | "shown" }) {
  const inEnter = phase === "enter";
  return (
    <>
      {/* Top crimson half — slides down from -100% to 0. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-0 h-1/2"
        style={{
          background:
            "linear-gradient(to bottom, rgba(40,5,8,0.96) 0%, rgba(120,10,18,0.92) 75%, rgba(160,18,26,0.85) 100%)",
          transform: inEnter ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 900ms cubic-bezier(0.6, 0, 0.4, 1)",
        }}
      />
      {/* Bottom crimson half — slides up from 100% to 0. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(to top, rgba(40,5,8,0.96) 0%, rgba(120,10,18,0.92) 75%, rgba(160,18,26,0.85) 100%)",
          transform: inEnter ? "translateY(100%)" : "translateY(0)",
          transition: "transform 900ms cubic-bezier(0.6, 0, 0.4, 1)",
        }}
      />
      {/* Once the bands meet, fade to the panel backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-zinc-950"
        style={{
          opacity: inEnter ? 0 : 0.92,
          transition: `opacity ${FADE_TO_PANEL_MS}ms ease-out`,
        }}
      />
    </>
  );
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

        {/* ----- Quote (mood line) ----- */}
        <p className="mt-4 text-center text-sm italic text-zinc-400">
          「{deathQuoteFor(character, run.win)}」
        </p>

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

function deathQuoteFor(character: string, win: boolean): string {
  if (win) return "정상에 오른 자, 자유로워지는가.";
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  // Mood lines per character — short approximations of the game's
  // QUOTES.* loc strings. Stable rather than random for now.
  return (
    {
      ironclad: "분노만으로는 충분치 않았다.",
      silent: "그림자조차 그를 가릴 수 없었다.",
      defect: "디펙트는 정상에 오른 것일까요?",
      necrobinder: "결속은 끊어지고, 영혼은 흩어진다.",
      regent: "왕좌는 비어 있다. 또다시.",
    }[slug] ?? "여정은 여기서 끝난다."
  );
}
