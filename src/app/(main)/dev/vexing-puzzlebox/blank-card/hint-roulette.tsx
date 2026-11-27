"use client";

import { useEffect, useRef, useState } from "react";
import StaticImage from "@/components/ui/static-image";
import { HINT_KEYS, type HintKey } from "@/lib/blank-card";

export interface HintOption {
  value: string;
  label: string;
  icon: string;
  /** CSS filter for icons that share one asset (a tinted reward icon). */
  filter?: string;
  /** Text drawn over the icon (a cost number on the energy orb). */
  overlay?: string;
}

/** Long rows (11 costs) shrink so the opened roulette still fits a 375px phone. */
const rowMetrics = (count: number) => (count > 9 ? { size: 24, gap: 2 } : { size: 28, gap: 4 });
const LOOPS = 2;
const SLOWEST_STEP_MS = 260;
const FASTEST_STEP_MS = 45;

/** Step delays of a spin that speeds up, then slows into the answer. */
function spinDelays(steps: number): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / Math.max(1, steps - 1);
    const speed = Math.sin(Math.PI * t); // 0 → 1 → 0
    return SLOWEST_STEP_MS - (SLOWEST_STEP_MS - FASTEST_STEP_MS) * speed;
  });
}

function HintIcon({ option, size }: { option: HintOption; size: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <StaticImage
        src={option.icon}
        alt={option.label}
        width={size * 2}
        height={size * 2}
        className="h-full w-full object-contain"
        style={option.filter ? { filter: option.filter } : undefined}
      />
      {option.overlay !== undefined && (
        <span
          className="absolute inset-0 flex items-center justify-center font-game-title font-black text-[#fff6e2]"
          style={{ fontSize: size * 0.5, WebkitTextStroke: "2px #2b2b2b", paintOrder: "stroke fill" }}
        >
          {option.overlay}
        </span>
      )}
    </span>
  );
}

/**
 * Hint rows: each kind's options sit stacked until it is spent, then pop open,
 * spin left to right and stop on the answer. `onReveal` fires when it stops.
 */
export function HintRoulette({
  options,
  answer,
  revealed,
  hintsLeft,
  disabled,
  labels,
  onReveal,
}: {
  options: Record<HintKey, HintOption[]>;
  answer: Record<HintKey, string>;
  revealed: Partial<Record<HintKey, string>>;
  hintsLeft: number;
  disabled: boolean;
  labels: Record<HintKey, string>;
  onReveal: (key: HintKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState<{ key: HintKey; index: number } | null>(null);
  const [popped, setPopped] = useState<HintKey | null>(null);
  const [peek, setPeek] = useState<HintKey | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const spin = (key: HintKey) => {
    if (disabled || spinning || hintsLeft <= 0 || revealed[key] !== undefined) return;
    const row = options[key];
    const target = Math.max(0, row.findIndex((option) => option.value === answer[key]));
    setPopped(key);
    setSpinning({ key, index: 0 });
    const delays = spinDelays(LOOPS * row.length + target + 1);
    let at = 380; // after the pop and the row opening
    delays.forEach((delay, step) => {
      at += delay;
      timers.current.push(window.setTimeout(() => setSpinning({ key, index: step % row.length }), at));
    });
    timers.current.push(window.setTimeout(() => {
      setSpinning(null);
      onReveal(key);
    }, at + 320));
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-300"
      >
        <span>힌트</span>
        <span className="flex items-center gap-2">
          <span className="flex gap-1" aria-label={`남은 힌트 ${hintsLeft}`}>
            {Array.from({ length: hintsLeft }, (_, i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-amber-300" />
            ))}
          </span>
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-2 px-3 pb-3">
          {HINT_KEYS.map((key) => {
            const row = options[key];
            const shown = revealed[key];
            const active = spinning?.key === key;
            const settled = active || shown !== undefined;
            // Hover or focus fans a stacked row out to preview its options.
            const spread = settled || peek === key;
            const usable = !disabled && !spinning && hintsLeft > 0 && shown === undefined;
            const { size, gap } = rowMetrics(row.length);
            return (
              <li
                key={key}
                onMouseEnter={() => setPeek(key)}
                onMouseLeave={() => setPeek((current) => (current === key ? null : current))}
                onFocus={() => setPeek(key)}
                onBlur={() => setPeek((current) => (current === key ? null : current))}
              >
                <button
                  type="button"
                  onClick={() => spin(key)}
                  disabled={!usable && !active}
                  aria-label={labels[key]}
                  onAnimationEnd={() => setPopped((current) => (current === key ? null : current))}
                  className={`flex w-full items-center rounded-md px-2 py-1.5 ${
                    usable ? "hover:bg-zinc-800" : ""
                  } ${popped === key ? "blank-card-hint-pop" : ""} ${!usable && !settled ? "opacity-40" : ""}`}
                >
                  {row.map((option, index) => {
                    const lit = active ? spinning.index === index : shown === option.value;
                    return (
                      <span
                        key={option.value}
                        title={option.label}
                        className="shrink-0 rounded-md transition-[margin,opacity,transform] duration-300"
                        style={{
                          marginLeft: index === 0 ? 0 : spread ? gap : 2 - size,
                          opacity: settled && !lit ? 0.35 : 1,
                          transform: lit ? "scale(1.18)" : undefined,
                          boxShadow: lit ? "0 0 0 2px #fcd34d, 0 0 14px #fcd34d" : undefined,
                          // Stacked, the first option lies on top.
                          zIndex: lit ? row.length + 1 : row.length - index,
                          position: "relative",
                        }}
                      >
                        <HintIcon option={option} size={size} />
                      </span>
                    );
                  })}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
