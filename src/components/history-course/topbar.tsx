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

const ACT_DIR_KEY: Record<string, string> = {
  "ACT.OVERGROWTH": "overgrowth",
  "ACT.UNDERDOCKS": "underdocks",
  "ACT.HIVE": "hive",
  "ACT.GLORY": "glory",
};

const NODE_ICON_NAME: Record<string, string> = {
  monster: "map_monster",
  elite: "map_elite",
  rest_site: "map_rest",
  shop: "map_shop",
  treasure: "map_chest",
  unknown: "map_unknown",
};

function actDirKey(actId: string): string {
  return ACT_DIR_KEY[actId] ?? "overgrowth";
}

function modelKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split(".").pop()?.toLowerCase() ?? null;
}

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

function bossIconSrc(id: string): string {
  // Game shows abstract boss-node sprite in the topbar, not the boss portrait.
  const slug = id.toLowerCase().replace(/_boss$/, "");
  return `/images/sts2/boss-nodes/boss_node_${slug}.webp`;
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
          <CurrentNodeChip entry={state.currentEntry} act={act} />
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
      className="absolute -bottom-1 -right-2 flex h-5 w-5 items-end justify-center"
      aria-label={`승천 ${ascension}`}
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        fill
        sizes="20px"
        className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        unoptimized
      />
      <span className="relative z-10 mb-0 text-[10px] font-black leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
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
  const ratio =
    typeof hp === "number" && typeof maxHp === "number" && maxHp > 0
      ? Math.max(0, Math.min(1, hp / maxHp))
      : 1;
  const color =
    ratio < 0.25 ? "text-rose-300" : ratio < 0.5 ? "text-amber-200" : "text-rose-100";
  return (
    <Chip title={`체력 ${hp ?? "—"} / ${maxHp ?? "—"}`}>
      <Image
        src="/images/sts2/ui/topbar/top_bar_heart.png"
        alt=""
        width={20}
        height={18}
        className="h-[18px] w-5 object-contain"
        unoptimized
      />
      <span className="tabular-nums">
        <span className={color}>{hp ?? "—"}</span>
        <span className="text-zinc-400">/{maxHp ?? "—"}</span>
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
        width={18}
        height={18}
        className="h-[18px] w-[18px] object-contain"
        unoptimized
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
        <div key={i} className="relative h-5 w-[14px]">
          <Image
            src="/images/sts2/ui/topbar/potion_placeholder.png"
            alt=""
            fill
            sizes="14px"
            className="object-contain opacity-80"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}

function CurrentNodeChip({
  entry,
  act,
}: {
  entry: ReplayHistoryEntry | null;
  act: ReplayActAnalysis;
}) {
  const icon = currentNodeIcon(entry, act);
  return (
    <Chip title={`현재 노드: ${nodeLabel(entry)}`}>
      <div className="relative h-5 w-5">
        {icon && (
          <>
            <Image
              src={icon.src}
              alt=""
              fill
              sizes="20px"
              className="object-contain"
              unoptimized
            />
            {icon.overlay && (
              <Image
                src={icon.overlay}
                alt=""
                fill
                sizes="20px"
                className="animate-pulse object-contain mix-blend-screen opacity-80"
                unoptimized
              />
            )}
          </>
        )}
      </div>
      <span className="text-zinc-300">{nodeLabel(entry)}</span>
    </Chip>
  );
}

function currentNodeIcon(
  entry: ReplayHistoryEntry | null,
  act: ReplayActAnalysis,
): { src: string; overlay?: string } | null {
  if (!entry) return null;
  const type = entry.map_point_type;
  const dir = actDirKey(act.actId);

  if (type === "boss") {
    const key = modelKey(entry.rooms[0]?.model_id)?.replace(/_boss$/, "");
    if (key) {
      return { src: `/images/sts2/boss-nodes/boss_node_${key}.webp` };
    }
    return { src: `/images/sts2/map/icons-by-act/${dir}/map_chest_boss.png` };
  }

  if (type === "ancient") {
    const key = modelKey(entry.rooms[0]?.model_id);
    if (key) {
      return { src: `/images/sts2/ancient-nodes/ancient_node_${key}.webp` };
    }
    return { src: "/images/sts2/icons/star_icon.webp" };
  }

  if (type === "rest_site") {
    return {
      src: `/images/sts2/map/icons-by-act/${dir}/map_rest.png`,
      overlay: "/images/sts2/map/effects/map_circle_2.png",
    };
  }

  const iconName = NODE_ICON_NAME[type];
  if (!iconName) return null;
  return { src: `/images/sts2/map/icons-by-act/${dir}/${iconName}.png` };
}

function FloorChip({ floor }: { floor: number }) {
  return (
    <Chip title={`${floor}층`}>
      <Image
        src="/images/sts2/ui/topbar/top_bar_floor.png"
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] object-contain"
        unoptimized
      />
      <span className="tabular-nums">{floor}</span>
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
        "relative h-7 w-7",
        active && "drop-shadow-[0_0_6px_rgba(255,200,120,0.55)]",
      )}
    >
      <Image
        src={bossIconSrc(id)}
        alt={bossLabel(id)}
        fill
        sizes="28px"
        className={cn(
          "object-contain",
          active ? "" : defeated ? "opacity-30 grayscale" : "opacity-55 grayscale",
        )}
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
        width={18}
        height={18}
        className="h-[18px] w-[18px] object-contain"
        unoptimized
      />
      <span className="tabular-nums">{formatHms(seconds)}</span>
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
      title={`현재 덱 ${count}장 보기`}
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_deck.png"
        alt=""
        width={20}
        height={18}
        className="h-[18px] w-5 object-contain"
        unoptimized
      />
      <span className="tabular-nums">{count}</span>
    </Chip>
  );
}

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="도전 이력" className="px-2 py-1">
      <Image
        src="/images/sts2/ui/topbar/submenu_history_icon.png"
        alt="도전 이력"
        width={26}
        height={18}
        className="h-[18px] w-[26px] object-contain"
        unoptimized
      />
    </Chip>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Chip as="button" onClick={onClick} title="런 정보" className="px-2 py-1">
      <Image
        src="/images/sts2/ui/topbar/top_bar_settings.png"
        alt="런 정보"
        width={20}
        height={20}
        className="h-5 w-5 object-contain"
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
