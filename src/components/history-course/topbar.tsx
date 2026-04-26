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

const NODE_ICON: Record<string, string> = {
  monster: "/images/sts2/map/icons/map_monster.png",
  elite: "/images/sts2/map/icons/map_elite.png",
  boss: "/images/sts2/map/icons/map_chest_boss.png",
  rest_site: "/images/sts2/map/icons/map_rest.png",
  shop: "/images/sts2/map/icons/map_shop.png",
  treasure: "/images/sts2/map/icons/map_chest.png",
  unknown: "/images/sts2/map/icons/map_unknown.png",
  ancient: "/images/sts2/icons/star_icon.webp",
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
    <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 bg-gradient-to-b from-black/85 via-black/55 to-transparent px-3 pb-3 pt-1.5 text-zinc-100">
      <div className="flex items-center gap-x-3 gap-y-1.5 text-[12px] font-semibold">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <CharacterChip
            character={character}
            ascension={run.ascension}
          />
          <HpChip hp={state.hp} maxHp={state.maxHp} />
          <GoldChip gold={state.gold} />
          <PotionSlots count={state.potionSlots} />
          <CurrentNodeChip entry={state.currentEntry} />
          <FloorChip floor={state.currentFloor} />
          <BossChip
            info={state.bossInfo}
            showSecond={showSecondBoss}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
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
  const baseClass = cn(
    "inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-zinc-100 ring-1 ring-white/10 backdrop-blur-[2px]",
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
          "transition hover:bg-black/75 hover:ring-white/30",
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
      className="relative flex items-center gap-1.5"
    >
      <div className="relative h-8 w-8 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/15">
        {iconSrc && (
          <Image
            src={iconSrc}
            alt={label ?? character}
            fill
            sizes="32px"
            className="object-cover"
          />
        )}
      </div>
      {ascension > 0 && (
        <AscensionBadge ascension={ascension} />
      )}
    </div>
  );
}

function AscensionBadge({ ascension }: { ascension: number }) {
  return (
    <span
      className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-[0_0_4px_rgba(244,63,94,0.6)]"
      aria-label={`승천 ${ascension}`}
    >
      <FlameSvg className="-mt-0.5 mr-0.5 h-2 w-2" />
      {ascension}
    </span>
  );
}

function FlameSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M6 1c1 2 3 3 3 5.5C9 8.4 7.7 10 6 10s-3-1.6-3-3.5C3 5.2 4 4.7 4.6 3.6c.2.6.6 1.2 1.4 1.6C6 4.4 5.7 2.7 6 1z" />
    </svg>
  );
}

function HpChip({
  hp,
  maxHp,
}: {
  hp: number | null;
  maxHp: number | null;
}) {
  const ratio =
    typeof hp === "number" && typeof maxHp === "number" && maxHp > 0
      ? Math.max(0, Math.min(1, hp / maxHp))
      : 1;
  const color =
    ratio < 0.25 ? "text-rose-300" : ratio < 0.5 ? "text-amber-200" : "text-rose-100";
  return (
    <Chip title={`체력 ${hp ?? "—"} / ${maxHp ?? "—"}`}>
      <HeartSvg className={cn("h-4 w-4 drop-shadow", color)} />
      <span className="tabular-nums">
        <span className={color}>{hp ?? "—"}</span>
        <span className="text-zinc-400">/{maxHp ?? "—"}</span>
      </span>
    </Chip>
  );
}

function HeartSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 7c0 3.8-5 7-5 7z" />
    </svg>
  );
}

function GoldChip({ gold }: { gold: number | null }) {
  return (
    <Chip title={`골드 ${gold ?? "—"}`}>
      <Image
        src="/images/sts2/icons/gold_icon.webp"
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
      <span className="tabular-nums text-amber-200">{gold ?? "—"}</span>
    </Chip>
  );
}

function PotionSlots({ count }: { count: number }) {
  return (
    <div
      title={`포션 슬롯 ${count}개`}
      className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 ring-1 ring-white/10 backdrop-blur-[2px]"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-5 w-5 rounded-full bg-zinc-900/80 ring-1 ring-white/10"
        />
      ))}
    </div>
  );
}

function CurrentNodeChip({ entry }: { entry: ReplayHistoryEntry | null }) {
  const type = entry?.map_point_type ?? "unknown";
  const src = NODE_ICON[type];
  return (
    <Chip title={`현재 노드: ${nodeLabel(entry)}`}>
      <div className="relative h-5 w-5">
        {src && (
          <Image
            src={src}
            alt=""
            fill
            sizes="20px"
            className="object-contain"
            unoptimized
          />
        )}
      </div>
      <span className="text-zinc-300">{nodeLabel(entry)}</span>
    </Chip>
  );
}

function FloorChip({ floor }: { floor: number }) {
  return (
    <Chip title={`${floor}층`}>
      <StairsSvg className="h-4 w-4 text-zinc-200" />
      <span className="tabular-nums">{floor}</span>
    </Chip>
  );
}

function StairsSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M2 12h4v-2.5h3V7h3V4.5h3V13H2z" />
    </svg>
  );
}

function BossChip({
  info,
  showSecond,
}: {
  info: BossInfo;
  showSecond: boolean;
}) {
  if (!info.firstBoss && !info.secondBoss) return null;
  return (
    <div
      title={bossTitle(info, showSecond)}
      className="flex items-center gap-0"
    >
      {info.firstBoss && (
        <BossIcon
          id={info.firstBoss}
          active={!info.firstBossDefeated}
          defeated={info.firstBossDefeated && showSecond}
        />
      )}
      {showSecond && info.secondBoss && (
        <BossIcon
          id={info.secondBoss}
          active={info.firstBossDefeated}
          defeated={false}
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
  defeated,
}: {
  id: string;
  active: boolean;
  defeated: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-6 w-6 overflow-hidden rounded-md ring-1",
        active
          ? "ring-amber-300/70 shadow-[0_0_6px_rgba(255,200,120,0.4)]"
          : defeated
            ? "ring-zinc-700"
            : "ring-zinc-700",
      )}
    >
      <Image
        src={bossIconSrc(id)}
        alt={bossLabel(id)}
        fill
        sizes="24px"
        className={cn(
          "object-cover",
          active ? "" : "opacity-40 grayscale",
        )}
      />
    </div>
  );
}

function TimerChip({ seconds }: { seconds: number }) {
  return (
    <Chip title={`경과 시간 ${formatHms(seconds)}`}>
      <ClockSvg className="h-4 w-4 text-zinc-300" />
      <span className="tabular-nums">{formatHms(seconds)}</span>
    </Chip>
  );
}

function ClockSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.5 V8 L10.5 9.5" />
    </svg>
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
      title={`현재 덱 ${count}장 보기`}
    >
      <Image
        src="/images/sts2/icons/card_icon.webp"
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
      <span className="tabular-nums">{count}</span>
    </Chip>
  );
}

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="도전 이력">
      <span className="text-[11px] tracking-[0.18em]">이력</span>
    </Chip>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="런 정보" className="px-2 py-1">
      <GearSvg className="h-4 w-4" />
    </Chip>
  );
}

function GearSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm5.6 3.4 1.2-1-1.4-2.4-1.5.4a5.6 5.6 0 0 0-1-.6L10.6 4h-2.8l-.3 1.3a5.6 5.6 0 0 0-1 .6l-1.5-.4-1.4 2.4 1.2 1a5.6 5.6 0 0 0 0 1.2l-1.2 1 1.4 2.4 1.5-.4q.45.36 1 .6L7 14.8h2.8l.3-1.3q.55-.24 1-.6l1.5.4 1.4-2.4-1.2-1a5.6 5.6 0 0 0 0-1.2z" />
    </svg>
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
