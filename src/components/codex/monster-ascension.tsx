"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "@/components/ui/static-image";
import type { CodexMonster, DamageValue } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";

export const MONSTER_ASCENSION_STORAGE_KEY = "sts2.monsterAscensionLevel";
const MONSTER_ASCENSION_EVENT = "sts2:monster-ascension-level";
const ASCENSION_ICON = "/images/sts2/ui/topbar/top_bar_ascension.png";

export const MONSTER_HP_ASCENSION_LEVEL = 8;
export const MONSTER_MOVE_ASCENSION_LEVEL = 9;

export interface MonsterHpDisplay {
  value: string;
  normal: string | null;
  ascension: string | null;
  ascended: boolean;
}

export function useMonsterAscensionLevel(): [number, (level: number | ((current: number) => number)) => void] {
  const [level, setLevelState] = useState(0);

  useEffect(() => {
    const sync = () => setLevelState(readMonsterAscensionLevel());
    sync();

    window.addEventListener("storage", sync);
    window.addEventListener(MONSTER_ASCENSION_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MONSTER_ASCENSION_EVENT, sync);
    };
  }, []);

  const setLevel = useCallback((next: number | ((current: number) => number)) => {
    const resolved = clampAscensionLevel(typeof next === "function" ? next(readMonsterAscensionLevel()) : next);
    setLevelState(resolved);
    try {
      window.localStorage.setItem(MONSTER_ASCENSION_STORAGE_KEY, String(resolved));
      window.dispatchEvent(new CustomEvent(MONSTER_ASCENSION_EVENT));
    } catch {
      // Keep the in-memory value when storage is unavailable.
    }
  }, []);

  return [level, setLevel];
}

export function MonsterAscensionStepper({
  level,
  onChange,
  serviceLocale,
  compact = false,
  className = "",
}: {
  level: number;
  onChange: (level: number | ((current: number) => number)) => void;
  serviceLocale: ServiceLocale;
  compact?: boolean;
  className?: string;
}) {
  const decreaseLabel = serviceLocale === "ko" ? "승천 감소" : "Decrease ascension";
  const increaseLabel = serviceLocale === "ko" ? "승천 증가" : "Increase ascension";
  const groupLabel = serviceLocale === "ko" ? `승천 ${level}` : `Ascension ${level}`;
  const buttonClass = compact
    ? "h-4 w-4 text-[10px]"
    : "h-5 w-5 text-xs";
  const iconSize = compact ? 16 : 18;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 font-game-title font-black leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${compact ? "text-[10px]" : "text-xs"} ${className}`}
      role="group"
      aria-label={groupLabel}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        className={`${buttonClass} inline-flex items-center justify-center rounded bg-zinc-950/70 text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35`}
        disabled={level <= 0}
        onClick={() => onChange((current) => current - 1)}
      >
        -
      </button>
      <span className="relative inline-flex items-center justify-center" aria-hidden="true">
        <Image
          src={ASCENSION_ICON}
          alt=""
          width={iconSize}
          height={iconSize}
          className={`${compact ? "h-4 w-4" : "h-[18px] w-[18px]"} object-contain`}
        />
        <span className="absolute inset-0 flex items-center justify-center pt-px text-[8px] leading-none drop-shadow">
          {level}
        </span>
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        className={`${buttonClass} inline-flex items-center justify-center rounded bg-zinc-950/70 text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35`}
        disabled={level >= 10}
        onClick={() => onChange((current) => current + 1)}
      >
        +
      </button>
    </span>
  );
}

export function MonsterAscensionBadge({ level, compact = false }: { level: number; compact?: boolean }) {
  return (
    <span className={`relative inline-flex items-center justify-center align-middle ${compact ? "h-4 w-4" : "h-4 w-4"}`}>
      <Image src={ASCENSION_ICON} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
      <span className="absolute inset-0 flex items-center justify-center pt-px text-[8px] font-black leading-none text-white drop-shadow">
        {level}
      </span>
    </span>
  );
}

export function MonsterHealthBar({
  monster,
  ascensionLevel,
  hpOverride = null,
  compact = false,
  className = "",
}: {
  monster: CodexMonster;
  ascensionLevel: number;
  hpOverride?: DamageValue | null;
  compact?: boolean;
  className?: string;
}) {
  const hp = getMonsterHpDisplay(monster, ascensionLevel, hpOverride);
  if (!hp) return null;

  const hpLabel = `${hp.value}/${hp.value}`;

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-visible ${compact ? "h-6 w-36 max-w-full" : "h-7 w-full min-w-48 max-w-80"} ${className}`}
      aria-label={`HP ${hpLabel}`}
    >
      <span aria-hidden="true" className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2">
        <span className="absolute inset-x-1 top-1/2 h-[7px] -translate-y-1/2 rounded-[2px] bg-[#52080a] shadow-[0_2px_3px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.16)]" />
        <span className="absolute inset-x-[5px] top-1/2 h-[5px] -translate-y-1/2 rounded-[1px] bg-[#F1373E] shadow-[inset_0_1px_0_rgba(255,142,126,0.72),inset_0_-1px_0_rgba(93,0,0,0.75)]" />
        <span className="absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-r-[10px] border-y-transparent border-r-[#F1373E] drop-shadow-[0_2px_1px_rgba(0,0,0,0.75)]" />
        <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-l-[10px] border-y-transparent border-l-[#F1373E] drop-shadow-[0_2px_1px_rgba(0,0,0,0.75)]" />
      </span>
      <span
        className={`relative z-10 font-game-title font-black leading-none text-[#fff8db] ${compact ? "text-sm" : "text-lg"}`}
        style={{ textShadow: "0 2px 0 #900000, 1px 1px 0 #900000, -1px 1px 0 #900000, 0 0 4px #000" }}
      >
        {hpLabel}
      </span>
    </span>
  );
}

export function getMonsterHpDisplay(
  monster: CodexMonster,
  ascensionLevel: number,
  hpOverride: DamageValue | null = null,
): MonsterHpDisplay | null {
  const normal = hpOverride
    ? formatNumberRange(hpOverride.normal, hpOverride.normal)
    : formatNumberRange(monster.minHp, monster.maxHp);
  const ascension = hpOverride
    ? formatNumberRange(hpOverride.ascension, hpOverride.ascension)
    : formatNumberRange(monster.minHpAscension, monster.maxHpAscension);

  if (!normal && !ascension) return null;

  const ascended = ascensionLevel >= MONSTER_HP_ASCENSION_LEVEL && Boolean(ascension);
  return {
    value: ascended ? ascension! : normal ?? ascension!,
    normal,
    ascension,
    ascended,
  };
}

export function getEffectiveDamageValue(
  value: DamageValue | null,
  ascensionLevel: number,
  threshold = MONSTER_MOVE_ASCENSION_LEVEL,
): number | null {
  if (!value) return null;
  if (ascensionLevel >= threshold && value.ascension != null) return value.ascension;
  return value.normal ?? value.ascension;
}

function readMonsterAscensionLevel(): number {
  if (typeof window === "undefined") return 0;

  try {
    return clampAscensionLevel(Number(window.localStorage.getItem(MONSTER_ASCENSION_STORAGE_KEY) ?? 0));
  } catch {
    return 0;
  }
}

function clampAscensionLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(10, Math.max(0, Math.trunc(level)));
}

function formatNumberRange(min: number | null, max: number | null): string | null {
  if (min == null || min === 9999) return null;
  if (max != null && max !== min) return `${min}-${max}`;
  return `${min}`;
}
