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
  prominent = false,
  className = "",
}: {
  level: number;
  onChange: (level: number | ((current: number) => number)) => void;
  serviceLocale: ServiceLocale;
  compact?: boolean;
  prominent?: boolean;
  className?: string;
}) {
  const decreaseLabel = serviceLocale === "ko" ? "승천 감소" : "Decrease ascension";
  const increaseLabel = serviceLocale === "ko" ? "승천 증가" : "Increase ascension";
  const groupLabel = serviceLocale === "ko" ? `승천 ${level}` : `Ascension ${level}`;
  const buttonClass = compact
    ? prominent ? "h-5 w-5 text-xs" : "h-4 w-4 text-[10px]"
    : prominent ? "h-6 w-6 text-sm" : "h-5 w-5 text-xs";
  const iconSize = compact ? (prominent ? 24 : 16) : (prominent ? 27 : 18);
  const iconClass = compact
    ? prominent ? "h-6 w-6" : "h-4 w-4"
    : prominent ? "h-[27px] w-[27px]" : "h-[18px] w-[18px]";
  const counterClass = prominent ? "text-[10px]" : "text-[8px]";

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
          className={`${iconClass} object-contain`}
        />
        <span className={`absolute inset-0 flex items-center justify-center pt-px ${counterClass} leading-none drop-shadow`}>
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
  const barClipPath = "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)";

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-visible ${compact ? "h-6 w-36 max-w-full" : "h-7 w-full min-w-48 max-w-80"} ${className}`}
      aria-label={`HP ${hpLabel}`}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-1/2 h-[10px] -translate-y-1/2 bg-[#4d5a61] shadow-[0_2px_3px_rgba(0,0,0,0.72)]"
        style={{ clipPath: barClipPath }}
      >
        <span
          className="absolute inset-[2px] bg-[#071a1a]"
          style={{ clipPath: barClipPath }}
        />
        <span
          className="absolute inset-y-[2px] left-[2px] right-[2px] bg-gradient-to-b from-[#ff6258] via-[#F1373E] to-[#b11219] shadow-[inset_0_1px_0_rgba(255,153,132,0.72),inset_0_-1px_0_rgba(92,0,0,0.7)]"
          style={{ clipPath: barClipPath }}
        />
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
