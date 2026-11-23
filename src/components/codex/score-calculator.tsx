"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import {
  clampSts2ScoreInput,
  STS2_SCORE_DEFAULTS,
  sts2Score,
  sts2ScoreLimits,
  type Sts2ScoreInput,
  type Sts2ScoreLineKey,
} from "@/lib/sts2/score";

/** game_over_screen texts: SCORE_LINE templates ("오른 층: {FloorCount}") and the banners. */
export type Sts2ScoreTexts = {
  lines: Record<Sts2ScoreLineKey, string>;
  win: string;
  lose: string;
};

const ICONS: Record<Sts2ScoreLineKey, string> = {
  floorsClimbed: "/images/sts2/ui/game_over_screen/score_floor.webp",
  goldGained: "/images/sts2/ui/game_over_screen/score_gold.webp",
  elitesKilled: "/images/sts2/ui/game_over_screen/score_elite.webp",
  bossesSlain: "/images/sts2/ui/game_over_screen/score_boss.webp",
  ascension: "/images/sts2/ui/game_over_screen/score_ascension.webp",
  dread: "/images/sts2/ui/game_over_screen/score_dread.webp",
};
const ORDER: Sts2ScoreLineKey[] = ["floorsClimbed", "goldGained", "elitesKilled", "bossesSlain", "ascension", "dread"];

function serviceText(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        title: "점수 계산기",
        table: "점수 기준",
        reset: "초기화",
        result: "결과",
        mode: "모드",
        normal: "일반",
        players: "인원",
        act: (index: number) => `${index + 1}막 층`,
        total: "점수",
        note: "실제 시드에서 나올 수 있는 범위로 값을 맞춥니다. 층은 지도에서 들어간 칸 수(고대의 존재·보스 칸 포함)입니다.",
        rules: {
          floorsClimbed: "1막 층마다 10, 2막 20, 3막 30",
          goldGained: "획득 골드 ÷ (100 × 인원), 버림",
          elitesKilled: "엘리트 1마리당 50 (마지막에 죽은 엘리트 방 제외)",
          bossesSlain: "보스 1마리당 100 (패배한 보스 제외)",
          ascension: "합계 × (1 + 0.1 × 승천), 버림",
          dread: "합계 × 3 (승천 배율 대신)",
        },
      }
    : {
        title: "Score calculator",
        table: "Score rules",
        reset: "Reset",
        result: "Result",
        mode: "Mode",
        normal: "Normal",
        players: "Players",
        act: (index: number) => `Act ${index + 1} floors`,
        total: "Score",
        note: "Values snap to what a real run can reach. Floors are map points entered (the Ancient and boss rooms count).",
        rules: {
          floorsClimbed: "10 per act 1 floor, 20 per act 2 floor, 30 per act 3 floor",
          goldGained: "Gold gained ÷ (100 × players), rounded down",
          elitesKilled: "50 per elite (not a final elite room you died in)",
          bossesSlain: "100 per boss (not the one that beat you)",
          ascension: "Total × (1 + 0.1 × ascension), rounded down",
          dread: "Total × 3 (instead of the ascension multiplier)",
        },
      };
}

/** "오른 층: {FloorCount}" -> "오른 층" (the rule table) or with the count filled (the result). */
function lineLabel(template: string, count?: number): string {
  return count === undefined
    ? template.replace(/\s*[:：]?\s*\{[A-Za-z]+\}\s*/g, "").trim()
    : template.replace(/\{[A-Za-z]+\}/g, String(count));
}

function NumberField({ label, value, range, onChange, onFocus, onBlur }: {
  label: string;
  value: number;
  range: [number, number];
  onChange: (value: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  // Typing "15" passes through "1": hold what's typed, apply it once it's in range or the field is left.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex min-w-0 flex-col gap-1" onFocus={onFocus} onBlur={onBlur}>
      <span className="truncate text-xs text-gray-400">{`${label} (${range[0]}–${range[1]})`}</span>
      <input
        type="number"
        inputMode="numeric"
        min={range[0]}
        max={range[1]}
        value={draft ?? String(value)}
        disabled={range[0] === range[1]}
        onChange={(event) => {
          const typed = event.target.value;
          setDraft(typed);
          const number = Number(typed);
          if (typed !== "" && number >= range[0] && number <= range[1]) onChange(number);
        }}
        onBlur={() => {
          if (draft !== null) onChange(Number(draft));
          setDraft(null);
        }}
        className="w-full rounded-md border border-border bg-black/40 px-2 py-1 font-game-title text-base text-gray-100 outline-none focus:border-primary/60 disabled:opacity-50"
      />
    </label>
  );
}

function Toggle<T extends string | boolean>({ label, value, options, onChange, onFocus, onBlur }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1" onFocus={onFocus} onBlur={onBlur}>
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded border border-white/10 px-2.5 py-1 text-sm ${value === option.value ? "bg-primary/20 text-primary" : "text-gray-400 hover:bg-white/5"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * ScoreUtility.CalculateScore beside the score rules, as the game-over screen lines it up.
 * On a wide screen the rule a field feeds lights while that field is edited.
 */
export function Sts2ScoreCalculator({ texts, serviceLocale }: { texts: Sts2ScoreTexts; serviceLocale: ServiceLocale }) {
  const t = serviceText(serviceLocale);
  const [input, setInput] = useState<Sts2ScoreInput>(STS2_SCORE_DEFAULTS);
  const [focused, setFocused] = useState<Sts2ScoreLineKey[] | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const update = (patch: Partial<Sts2ScoreInput>) => setInput((previous) => clampSts2ScoreInput({ ...previous, ...patch }));
  const limits = sts2ScoreLimits(input);
  const { lines, total } = sts2Score(input);
  const focus = (keys: Sts2ScoreLineKey[]) => ({ onFocus: () => setFocused(keys), onBlur: () => setFocused(null) });
  useEffect(() => {
    if (!focused?.length) return;
    tableRef.current?.querySelector("[data-highlighted]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);
  const field = (label: string, keys: Sts2ScoreLineKey[], value: number, range: [number, number], onChange: (value: number) => void): ReactNode => (
    <NumberField label={label} value={value} range={range} onChange={onChange} {...focus(keys)} />
  );
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-white/10 bg-black/50 px-5 py-4" data-sts2-score-calculator="">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-game-title text-lg font-bold text-primary">{t.title}</h2>
          <button type="button" onClick={() => setInput(STS2_SCORE_DEFAULTS)} className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-gray-300 hover:text-white">
            {t.reset}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            <Toggle label={t.result} value={input.won} options={[{ value: false, label: texts.lose }, { value: true, label: texts.win }]} onChange={(won) => update({ won })} {...focus(["bossesSlain"])} />
            <Toggle label={t.mode} value={input.mode} options={[{ value: "normal" as const, label: t.normal }, { value: "dread" as const, label: lineLabel(texts.lines.dread) }]} onChange={(mode) => update({ mode })} {...focus(["dread", "ascension"])} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {field(lineLabel(texts.lines.ascension), ["ascension"], input.ascension, limits.ascension, (ascension) => update({ ascension }))}
            {field(t.players, ["goldGained"], input.players, limits.players, (players) => update({ players }))}
            {input.floors.map((count, act) => (
              <span key={act} className="contents">
                {field(t.act(act), ["floorsClimbed"], count, limits.floors[act], (value) => update({ floors: input.floors.map((current, index) => (index === act ? value : current)) as Sts2ScoreInput["floors"] }))}
              </span>
            ))}
            {field(lineLabel(texts.lines.goldGained), ["goldGained"], input.goldGained, limits.goldGained, (goldGained) => update({ goldGained }))}
            {field(lineLabel(texts.lines.elitesKilled), ["elitesKilled"], input.elitesKilled, limits.elitesKilled, (elitesKilled) => update({ elitesKilled }))}
            {field(lineLabel(texts.lines.bossesSlain), ["bossesSlain"], input.bossesSlain, limits.bossesSlain, (bossesSlain) => update({ bossesSlain }))}
          </div>
          <p className="text-[11px] text-gray-500">{t.note}</p>
          <div className="rounded-md border border-white/10 bg-black/40 px-4 py-3">
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line.key} className="flex items-center gap-2 text-sm text-gray-200">
                  <Image src={ICONS[line.key]} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                  <span className="min-w-0 flex-1 truncate">{line.key === "dread" ? lineLabel(texts.lines.dread) : lineLabel(texts.lines[line.key], line.count)}</span>
                  <span className="font-game-title text-[#efc851]">{line.multiplier ? `x${line.multiplier}` : `+${line.points}`}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-white/10 pt-2 text-right font-game-title text-2xl text-[#efc851]" data-sts2-score-total={total}>
              {t.total}: {total}
            </div>
          </div>
        </div>
      </section>
      <div ref={tableRef} className="lg:sticky lg:top-0">
        <section className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
          <h2 className="mb-1 px-2 font-game-title text-sm font-bold text-gray-300">{t.table}</h2>
          <ul>
            {ORDER.map((key) => {
              const lit = focused?.includes(key);
              return (
                <li
                  key={key}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${lit ? "bg-primary/15 ring-1 ring-primary/70" : ""}`}
                  data-sts2-score={key}
                  data-highlighted={lit ? "" : undefined}
                >
                  <Image src={ICONS[key]} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-game-title text-base text-gray-100">{lineLabel(texts.lines[key])}</span>
                    <span className="block text-xs text-gray-400">{t.rules[key]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
