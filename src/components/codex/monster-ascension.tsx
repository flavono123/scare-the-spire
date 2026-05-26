"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "@/components/ui/static-image";
import type { CodexMonster, DamageValue } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";

export const MONSTER_ASCENSION_STORAGE_KEY = "sts2.monsterAscensionLevel";
const MONSTER_ASCENSION_EVENT = "sts2:monster-ascension-level";
const ASCENSION_ICON = "/images/sts2/ui/topbar/top_bar_ascension.png";
const HEART_ICON = "/images/sts2/ui/topbar/top_bar_heart.png";

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

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-[3px] border border-black/80 bg-[#2a0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.55)] ${compact ? "h-5 min-w-24 px-5" : "h-6 min-w-32 px-6"} ${className}`}
      aria-label={`HP ${hp.value}`}
    >
      <span className="absolute inset-[3px] rounded-[2px] bg-gradient-to-b from-[#ff6b5e] via-[#c81d24] to-[#66080b]" />
      <Image
        src={HEART_ICON}
        alt=""
        width={compact ? 18 : 22}
        height={compact ? 18 : 22}
        className={`absolute left-1 z-10 object-contain drop-shadow ${compact ? "h-4 w-4" : "h-5 w-5"}`}
      />
      <span
        className={`relative z-10 font-game-title font-black leading-none text-[#fff8db] ${compact ? "text-xs" : "text-sm"}`}
        style={{ textShadow: "0 2px 0 #000, 0 0 4px #000" }}
      >
        {hp.value}
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
