"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { HoverTip } from "@/components/codex/hover-tip";
import { localize } from "@/lib/sts2-i18n";
import {
  type ReplayActAnalysis,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import {
  type AncientInfo,
  type BossInfo,
  type RelicAtFloor,
  type TopbarState,
} from "./topbar-state";

const CHARACTER_ICON: Record<string, string> = {
  "CHARACTER.IRONCLAD": "/images/sts2/characters/character_icon_ironclad.webp",
  "CHARACTER.SILENT": "/images/sts2/characters/character_icon_silent.webp",
  "CHARACTER.DEFECT": "/images/sts2/characters/character_icon_defect.webp",
  "CHARACTER.NECROBINDER":
    "/images/sts2/characters/character_icon_necrobinder.webp",
  "CHARACTER.REGENT": "/images/sts2/characters/character_icon_regent.webp",
};

const CHARACTER_LABEL: Record<string, string> = {
  "CHARACTER.IRONCLAD": "아이언클래드",
  "CHARACTER.SILENT": "사일런트",
  "CHARACTER.DEFECT": "디펙트",
  "CHARACTER.NECROBINDER": "네크로바인더",
  "CHARACTER.REGENT": "리젠트",
};

// Each node type maps to a run-history sprite name. `unknown` resolves
// further once the room contents are known so the player sees the
// revealed-room variant (`unknown_<roomType>`) rather than a generic ?.
const NODE_SPRITE_NAME: Record<string, string> = {
  monster: "monster",
  elite: "elite",
  rest_site: "rest_site",
  shop: "shop",
  treasure: "treasure",
  unknown: "event",
};

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

function bossIconSrc(id: string): string {
  return `/images/sts2/bosses/${id.toLowerCase()}.webp`;
}

function bossLabel(id: string | null): string {
  if (!id) return "?";
  return localize("encounters", id) ?? id.replace(/_BOSS$/, "");
}

function nodeLabel(entry: ReplayHistoryEntry | null): string {
  if (!entry) return "—";
  switch (entry.map_point_type) {
    case "monster":
      return "몬스터";
    case "elite":
      return "엘리트";
    case "boss":
      return "보스";
    case "rest_site":
      return "휴식";
    case "treasure":
      return "보물";
    case "shop":
      return "상점";
    case "unknown":
      return "미지";
    case "ancient":
      return "고대";
    default:
      return "—";
  }
}

function formatHms(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TopBarProps {
  run: ReplayRun;
  act: ReplayActAnalysis;
  state: TopbarState;
  /** Cumulative replay elapsed across all acts. Drives the clock chip. */
  cumulativeElapsedMs: number;
  /** Total replay length across all acts (used to scale the fake clock to
   *  the real run_time as a tooltip-only baseline). */
  totalRunMs: number;
  /** Relic IDs that are mid-flight from a node — hide their slot so the
   * fly-out lands into an empty spot instead of stacking on top of an
   * already-rendered icon. */
  hidingRelicIds?: ReadonlySet<string>;
  onOpenDeck: () => void;
  onOpenInfo: () => void;
}

export function TopBar({
  run,
  act,
  state,
  cumulativeElapsedMs,
  totalRunMs,
  hidingRelicIds,
  onOpenDeck,
  onOpenInfo,
}: TopBarProps) {
  const character = run.players[0]?.character ?? "CHARACTER.IRONCLAD";
  const isFinalAct = act.actIndex === run.acts.length - 1;
  const showSecondBoss =
    isFinalAct && run.ascension >= 10 && state.bossInfo.secondBoss !== null;

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 pb-3 text-zinc-100">
      <div
        className="topbar-row flex items-center gap-x-5 gap-y-1.5 px-5 pb-5 pt-1 text-[20px] font-bold leading-none"
        style={{
          backgroundImage: "url(/images/sts2/ui/topbar/top_bar.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <CharacterChip
            character={character}
            ascension={run.ascension}
          />
          <HpChip hp={state.hp} maxHp={state.maxHp} />
          <GoldChip gold={state.gold} />
          <PotionSlots count={state.potionSlots} />
          <CurrentNodeChip
            entry={state.currentEntry}
            ancientInfo={state.ancientInfo}
            bossInfo={state.bossInfo}
            showSecondBoss={showSecondBoss}
          />
          <FloorChip floor={state.currentFloor} />
          <BossChip
            info={state.bossInfo}
            showSecond={showSecondBoss}
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <TimerChip
            elapsedMs={cumulativeElapsedMs}
            totalRunMs={totalRunMs}
            realRunSeconds={run.run_time ?? null}
          />
          <DeckChip count={state.deckCount} onOpen={onOpenDeck} />
          <HistoryListButton />
          <SettingsButton onClick={onOpenInfo} />
        </div>
      </div>
      <RelicRow relics={state.relics} hidingRelicIds={hidingRelicIds} />
    </div>
  );
}

interface TipContent {
  title: string;
  body?: ReactNode;
}

type TipPlacement = "below" | "below-right" | "below-left";

// Wraps a topbar element with the same hover tip that node tooltips use.
// React's onMouseEnter/Leave fire instantly — much faster than the browser
// title-attribute delay — so chips reveal their info on first hover.
function HoverTipWrap({
  tip,
  children,
  className,
  width = 240,
  placement = "below",
}: {
  tip: TipContent;
  children: ReactNode;
  className?: string;
  width?: number;
  placement?: TipPlacement;
}) {
  const [hovered, setHovered] = useState(false);
  // The stage clips overflow, so chips near the right edge anchor their
  // popover to the right-edge of the trigger instead of centering it.
  const anchorStyle: React.CSSProperties = (() => {
    switch (placement) {
      case "below-right":
        return { right: 0, top: "100%", transform: "translateY(8px)" };
      case "below-left":
        return { left: 0, top: "100%", transform: "translateY(8px)" };
      case "below":
      default:
        return { left: "50%", top: "100%", transform: "translate(-50%, 8px)" };
    }
  })();
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <span
          className="pointer-events-none absolute z-50"
          style={{
            ...anchorStyle,
            width: "max-content",
            maxWidth: width,
          }}
        >
          <HoverTip title={tip.title}>{tip.body}</HoverTip>
        </span>
      )}
    </span>
  );
}

function Chip({
  children,
  tip,
  tipWidth,
  tipPlacement,
  onClick,
  className,
  as = "div",
}: {
  children: ReactNode;
  tip?: TipContent;
  tipWidth?: number;
  tipPlacement?: TipPlacement;
  onClick?: () => void;
  className?: string;
  as?: "div" | "button";
}) {
  // Frameless: chips sit on the stone panel like the relics do, no
  // background or ring. Buttons get a subtle hover lift only. The
  // -translate-y-px nudges every chip 1px above row center so glyphs
  // sit on the stone band instead of the bottom shadow.
  const baseClass = cn(
    "inline-flex items-center gap-1.5 text-white -translate-y-px",
    className,
  );
  const inner =
    as === "button" ? (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClass,
          "transition hover:brightness-125 focus:outline-none focus-visible:brightness-125",
        )}
      >
        {children}
      </button>
    ) : (
      <div className={baseClass}>{children}</div>
    );
  if (!tip) return inner;
  return (
    <HoverTipWrap tip={tip} width={tipWidth} placement={tipPlacement}>
      {inner}
    </HoverTipWrap>
  );
}

function CharacterChip({
  character,
  ascension,
}: {
  character: string;
  ascension: number;
}) {
  const iconSrc = CHARACTER_ICON[character];
  const label = CHARACTER_LABEL[character] ?? character.split(".").pop();
  return (
    <span
      className="relative inline-block h-12 w-12 -translate-y-px"
      style={{
        backgroundImage: "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
      aria-label={`${label} · 승천 ${ascension}`}
    >
      {iconSrc && (
        <span className="absolute inset-1 overflow-hidden">
          <Image
            src={iconSrc}
            alt={label ?? character}
            fill
            sizes="44px"
            className="object-contain"
          />
        </span>
      )}
      {ascension > 0 && <AscensionBadge ascension={ascension} />}
    </span>
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
      <span className="topbar-num relative z-10 mb-0.5 text-[13px] leading-none">
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
    <Chip>
      <Image
        src="/images/sts2/ui/topbar/top_bar_heart.png"
        alt=""
        width={36}
        height={30}
        className="h-[30px] w-9 object-contain"
        unoptimized
      />
      <span className="topbar-num topbar-num-red tabular-nums">
        {hp ?? "—"}
        <span className="opacity-80">/{maxHp ?? "—"}</span>
      </span>
    </Chip>
  );
}

function GoldChip({ gold }: { gold: number | null }) {
  return (
    <Chip>
      <Image
        src="/images/sts2/ui/topbar/top_bar_gold.png"
        alt=""
        width={32}
        height={30}
        className="h-[30px] w-8 object-contain"
        unoptimized
      />
      <span className="topbar-num topbar-num-gold tabular-nums">{gold ?? "—"}</span>
    </Chip>
  );
}

function PotionSlots({ count }: { count: number }) {
  return (
    <span
      className="relative inline-flex items-center gap-1 px-1"
      style={{
        // nine-slice keeps the chamfer corners at 8px so the slot bay matches
        // the height of HP/gold/floor chips instead of doubling them.
        borderImage:
          "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png) 28 fill / 8px / 0 stretch",
        borderStyle: "solid",
        borderWidth: "8px",
        transform: "translateY(-4px)",
      }}
      aria-label={`포션 슬롯 ${count}개`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="relative inline-block h-6 w-5">
          <Image
            src="/images/sts2/ui/topbar/potion_placeholder.png"
            alt=""
            fill
            sizes="20px"
            className="object-contain opacity-90"
            unoptimized
          />
        </span>
      ))}
    </span>
  );
}

function CurrentNodeChip({
  entry,
  ancientInfo,
  bossInfo,
  showSecondBoss,
}: {
  entry: ReplayHistoryEntry | null;
  ancientInfo: AncientInfo;
  bossInfo: BossInfo;
  showSecondBoss: boolean;
}) {
  if (!entry) return null;
  const type = entry.map_point_type;

  // Boss step — show the active boss portrait (which boss depends on which
  // boss step we're on). Second-boss only when this run is A10 act3.
  if (type === "boss") {
    if (showSecondBoss && bossInfo.secondBossActive && bossInfo.secondBoss) {
      return <BossPortrait id={bossInfo.secondBoss} active />;
    }
    if (bossInfo.firstBossActive && bossInfo.firstBoss) {
      return <BossPortrait id={bossInfo.firstBoss} active />;
    }
  }

  // Ancient = the act-opening Neow-style room. Show the ancient sprite at the
  // current-node position so it acts as the start-of-act token.
  if (type === "ancient" && ancientInfo.spriteId) {
    return (
      <NodeIcon
        alt={nodeLabel(entry)}
        sprite={ancientInfo.spriteId}
        size={40}
      />
    );
  }

  const sprite = currentNodeSprite(entry);
  if (!sprite) return null;
  return (
    <NodeIcon
      alt={nodeLabel(entry)}
      sprite={sprite}
      size={40}
    />
  );
}

function BossPortrait({ id, active }: { id: string; active: boolean }) {
  return (
    <div
      className="relative h-10 w-10"
      style={{ transform: "translateY(-3px)" }}
    >
      <Image
        src={bossIconSrc(id)}
        alt={bossLabel(id)}
        fill
        sizes="40px"
        className={cn(
          "object-contain",
          active ? "" : "opacity-55 grayscale",
        )}
        unoptimized
      />
    </div>
  );
}

function NodeIcon({
  alt,
  sprite,
  size,
  inactive,
}: {
  alt: string;
  sprite: string;
  size: number;
  inactive?: boolean;
}) {
  const main = `/images/sts2/run-history/${sprite}.png`;
  const outline = `/images/sts2/run-history/${sprite}_outline.png`;
  return (
    <span
      className={cn(
        "relative inline-block",
        inactive && "opacity-40 grayscale",
      )}
      style={{ width: size, height: size, transform: "translateY(-3px)" }}
    >
      {/* Outline first (behind), then the colored fill — matches the
          game's second_boss_icon.tscn layering. */}
      <Image
        src={outline}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain opacity-[0.18]"
        style={{ filter: "brightness(0)" }}
        unoptimized
      />
      <Image
        src={main}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="relative object-contain"
        unoptimized
      />
    </span>
  );
}

function currentNodeSprite(entry: ReplayHistoryEntry | null): string | null {
  if (!entry) return null;
  const type = entry.map_point_type;

  // Ancient + boss are tracked by the dedicated chips in the right-side
  // cluster; the current-node chip just disappears for those steps.
  if (type === "ancient" || type === "boss") return null;

  if (type === "unknown") {
    const room = entry.rooms[0]?.room_type?.toLowerCase();
    switch (room) {
      case "monster":
        return "unknown_monster";
      case "elite":
        return "unknown_elite";
      case "shop":
        return "unknown_shop";
      case "treasure":
        return "unknown_treasure";
      default:
        return "event";
    }
  }

  return NODE_SPRITE_NAME[type] ?? null;
}

function FloorChip({ floor }: { floor: number }) {
  return (
    <Chip>
      <Image
        src="/images/sts2/ui/topbar/top_bar_floor.png"
        alt=""
        width={32}
        height={30}
        className="h-[30px] w-8 object-contain"
        unoptimized
      />
      <span className="topbar-num tabular-nums">{floor}</span>
    </Chip>
  );
}

function BossChip({
  info,
  showSecond,
}: {
  info: BossInfo;
  showSecond: boolean;
}) {
  // First boss sits in the right cluster only while we haven't reached it
  // yet. Once it's the current node (or we're past it) the portrait moves
  // to the current-node chip.
  const renderFirst =
    Boolean(info.firstBoss) && !info.firstBossActive && !info.firstBossPassed;
  // Second boss is A10 act3-only. It hides while we're standing on it; if
  // we already passed it (the run is over) keep it hidden too.
  const renderSecond =
    showSecond &&
    Boolean(info.secondBoss) &&
    !info.secondBossActive &&
    !info.secondBossPassed;

  if (!renderFirst && !renderSecond) return null;
  return (
    <span
      className="relative flex items-center"
      style={{ transform: "translateY(-3px)" }}
      aria-label={bossTitle(info, showSecond)}
    >
      {renderFirst && info.firstBoss && (
        <BossIcon
          id={info.firstBoss}
          // First boss is the active token from the very start of the act —
          // it only stops being "the active right-side boss" when the player
          // actually steps on it, at which point this chip stops rendering it.
          active
          className="relative z-10"
        />
      )}
      {renderSecond && info.secondBoss && (
        <BossIcon
          id={info.secondBoss}
          active={info.firstBossPassed}
          // Sit 1px behind the first boss so the first one occludes a sliver
          // of the second instead of leaving them flush.
          className={cn("relative z-0", renderFirst && "-ml-px")}
        />
      )}
    </span>
  );
}

function bossTitle(info: BossInfo, showSecond: boolean): string {
  const parts: string[] = [];
  if (info.firstBoss) parts.push(bossLabel(info.firstBoss));
  if (showSecond && info.secondBoss) parts.push(bossLabel(info.secondBoss));
  return `보스: ${parts.join(" → ")}`;
}

function BossIcon({
  id,
  active,
  className,
}: {
  id: string;
  active: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative h-10 w-10", className)}>
      <Image
        src={bossIconSrc(id)}
        alt={bossLabel(id)}
        fill
        sizes="40px"
        // Inactive boss tokens stay fully opaque (so the first one cleanly
        // occludes the second behind it) — only the color drains.
        className={cn("object-contain", !active && "grayscale")}
        unoptimized
      />
    </div>
  );
}

function TimerChip({
  elapsedMs,
  totalRunMs,
  realRunSeconds,
}: {
  elapsedMs: number;
  totalRunMs: number;
  realRunSeconds: number | null;
}) {
  // The visible clock is a *fake* second counter — it walks the real
  // run_time proportionally to where we are in the replay so 1× still
  // feels close to the run's actual length, but the visible value lives
  // on the replay timeline (every node, even paused, scrubbed, sped up
  // 16×). Tooltip explains this proportional remap so users know what
  // the chip is and isn't.
  const fakeSeconds =
    realRunSeconds && totalRunMs > 0
      ? Math.floor((elapsedMs / totalRunMs) * realRunSeconds)
      : Math.floor(elapsedMs / 1000);
  const tipBody = (
    <>
      <div>
        플레이 당시 실제 타임라인을 반영하지 않습니다. 리플레이 애니메이션에
        맞춰 비례하여 재생됩니다.
      </div>
      {realRunSeconds != null && (
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          실제 플레이 시간 {formatHms(realRunSeconds)}
        </div>
      )}
    </>
  );
  return (
    <Chip
      tip={{
        title: `재생 시각 ${formatHms(fakeSeconds)}`,
        body: tipBody,
      }}
      tipWidth={300}
      tipPlacement="below-right"
    >
      <Image
        src="/images/sts2/ui/topbar/timer_icon.png"
        alt=""
        width={30}
        height={30}
        className="h-[30px] w-[30px] object-contain"
        unoptimized
      />
      <span className="topbar-num topbar-num-gold tabular-nums">{formatHms(fakeSeconds)}</span>
    </Chip>
  );
}

function DeckChip({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  return (
    <Chip
      as="button"
      onClick={onOpen}
      tip={{ title: `현재 덱 ${count}장 보기` }}
      tipPlacement="below-right"
    >
      <span data-deck-target className="relative inline-flex items-center gap-1.5">
        <Image
          src="/images/sts2/ui/topbar/top_bar_deck.png"
          alt=""
          width={38}
          height={32}
          className="h-8 w-[38px] object-contain"
          unoptimized
        />
        <span className="topbar-num tabular-nums">{count}</span>
      </span>
    </Chip>
  );
}

// Sends the user back to the history-course landing — replaces the old map
// button. Uses the history_course relic icon so it visually echoes the
// landing page header.
function HistoryListButton() {
  return (
    <HoverTipWrap
      tip={{ title: "역사 강의서 — 전체 목록" }}
      placement="below-right"
    >
      <Link
        href="/history-course"
        aria-label="역사 강의서 목록으로 돌아가기"
        className="inline-flex -translate-y-px items-center gap-1.5 text-white transition hover:brightness-125 focus:outline-none focus-visible:brightness-125"
      >
        <Image
          src="/images/sts2/relics/history_course.webp"
          alt="역사 강의서"
          width={34}
          height={34}
          className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          unoptimized
        />
      </Link>
    </HoverTipWrap>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip
      as="button"
      onClick={onClick}
      tip={{ title: "런 정보" }}
      tipPlacement="below-right"
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_settings.png"
        alt="런 정보"
        width={34}
        height={34}
        className="h-[34px] w-[34px] object-contain"
        unoptimized
      />
    </Chip>
  );
}

function RelicRow({
  relics,
  hidingRelicIds,
}: {
  relics: RelicAtFloor[];
  hidingRelicIds?: ReadonlySet<string>;
}) {
  if (relics.length === 0) return <div className="h-8" data-relic-row />;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1" data-relic-row>
      {relics.map((relic) => {
        const hidden = hidingRelicIds?.has(relic.id) ?? false;
        return (
          <div
            key={`${relic.id}-${relic.floor}`}
            data-relic-target={relic.id}
            className={cn(
              "relative h-8 w-8 transition-opacity duration-200",
              relic.justAcquired &&
                !hidden &&
                "drop-shadow-[0_0_10px_rgba(255,200,120,0.95)]",
            )}
            style={{ opacity: hidden ? 0 : 1 }}
            title={`${localize("relics", relic.id) ?? relic.id} · ${relic.floor}층`}
          >
            <Image
              src={relicIconSrc(relic.id)}
              alt={localize("relics", relic.id) ?? relic.id}
              fill
              sizes="32px"
              className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
              unoptimized
            />
          </div>
        );
      })}
    </div>
  );
}
