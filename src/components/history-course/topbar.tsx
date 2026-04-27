"use client";

import Image from "next/image";
import { type ReactNode } from "react";
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

function modelKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split(".").pop()?.toLowerCase() ?? null;
}

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
  onOpenStats: () => void;
  onOpenDeck: () => void;
  onOpenInfo: () => void;
}

export function TopBar({
  run,
  act,
  state,
  onOpenStats,
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
          <TimerChip seconds={state.elapsedSeconds} />
          <DeckChip count={state.deckCount} onOpen={onOpenDeck} />
          <HistoryButton onClick={onOpenStats} />
          <SettingsButton onClick={onOpenInfo} />
        </div>
      </div>
      <RelicRow relics={state.relics} />
    </div>
  );
}

function Chip({
  children,
  title,
  onClick,
  className,
  as = "div",
}: {
  children: ReactNode;
  title?: string;
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
  if (as === "button") {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={cn(
          baseClass,
          "transition hover:brightness-125 focus:outline-none focus-visible:brightness-125",
        )}
      >
        {children}
      </button>
    );
  }
  return (
    <div title={title} className={baseClass}>
      {children}
    </div>
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
    <div
      title={`${label} · 승천 ${ascension}`}
      className="relative h-12 w-12 -translate-y-px"
      style={{
        backgroundImage: "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {iconSrc && (
        <div className="absolute inset-1 overflow-hidden">
          <Image
            src={iconSrc}
            alt={label ?? character}
            fill
            sizes="44px"
            className="object-contain"
          />
        </div>
      )}
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
    <Chip title={`체력 ${hp ?? "—"} / ${maxHp ?? "—"}`}>
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
    <Chip title={`골드 ${gold ?? "—"}`}>
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
    <div
      title={`포션 슬롯 ${count}개`}
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
    >
      {Array.from({ length: count }).map((_, i) => (
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
        title={`현재 노드: ${nodeLabel(entry)}`}
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
      title={`현재 노드: ${nodeLabel(entry)}`}
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
  title,
  alt,
  sprite,
  size,
  inactive,
}: {
  title?: string;
  alt: string;
  sprite: string;
  size: number;
  inactive?: boolean;
}) {
  const main = `/images/sts2/run-history/${sprite}.png`;
  const outline = `/images/sts2/run-history/${sprite}_outline.png`;
  return (
    <div
      title={title}
      className={cn(
        "relative",
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
    </div>
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
    <Chip title={`${floor}층`}>
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
    <div
      title={bossTitle(info, showSecond)}
      className="relative flex items-center"
      style={{ transform: "translateY(-3px)" }}
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
    </div>
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

function TimerChip({ seconds }: { seconds: number }) {
  return (
    <Chip title={`경과 시간 ${formatHms(seconds)}`}>
      <Image
        src="/images/sts2/ui/topbar/timer_icon.png"
        alt=""
        width={30}
        height={30}
        className="h-[30px] w-[30px] object-contain"
        unoptimized
      />
      <span className="topbar-num topbar-num-gold tabular-nums">{formatHms(seconds)}</span>
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
    <Chip as="button" onClick={onOpen} title={`현재 덱 ${count}장 보기`}>
      <Image
        src="/images/sts2/ui/topbar/top_bar_deck.png"
        alt=""
        width={38}
        height={32}
        className="h-8 w-[38px] object-contain"
        unoptimized
      />
      <span className="topbar-num tabular-nums">{count}</span>
    </Chip>
  );
}

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="도전 이력">
      <Image
        src="/images/sts2/ui/topbar/top_bar_map.png"
        alt="도전 이력"
        width={38}
        height={34}
        className="h-[34px] w-[38px] object-contain"
        unoptimized
      />
    </Chip>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="런 정보">
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

function RelicRow({ relics }: { relics: RelicAtFloor[] }) {
  if (relics.length === 0) return <div className="h-8" />;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      {relics.map((relic) => (
        <div
          key={`${relic.id}-${relic.floor}`}
          className={cn(
            "relative h-8 w-8 transition",
            relic.justAcquired &&
              "drop-shadow-[0_0_10px_rgba(255,200,120,0.95)]",
          )}
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
      ))}
    </div>
  );
}
