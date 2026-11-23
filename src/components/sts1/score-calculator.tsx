"use client";

import { useState, type ReactNode } from "react";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1ScoreBonusRow } from "@/lib/sts1/compendium-extras";
import {
  clampSts1ScoreInput,
  STS1_SCORE_DEFAULTS,
  sts1Score,
  sts1ScoreLimits,
  type Sts1RunOutcome,
  type Sts1ScoreInput,
} from "@/lib/sts1/score";
import { filterButtonClass } from "./list-shell";

type ScoreLabels = { title: string; death: string; victory: string };

const TEXT = {
  ko: { title: "점수 계산기", outcome: "결과", none: "없음", reset: "초기화", note: "실제 시드에서 나올 수 있는 범위로 값을 맞춥니다." },
  en: { title: "Score calculator", outcome: "Result", none: "None", reset: "Reset", note: "Values snap to what a real run can reach." },
} as const;

// Which score lines a field feeds; the table beside the calculator lights them while it is edited.
type FocusLines = (ids: string[] | null) => void;

function Field({ label, lines, onFocusLines, children }: { label: string; lines?: string[]; onFocusLines?: FocusLines; children: ReactNode }) {
  return (
    <label
      className="flex min-w-0 flex-col gap-1"
      onFocus={() => (lines ? onFocusLines?.(lines) : undefined)}
      onBlur={() => onFocusLines?.(null)}
    >
      <span className="truncate font-game-text text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, range, onChange, lines, onFocusLines }: {
  label: string;
  value: number;
  range: [number, number];
  onChange: (value: number) => void;
  lines?: string[];
  onFocusLines?: FocusLines;
}) {
  // Typing "15" passes through "1": hold what's typed, apply it once it's in range or the field is left.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={`${label} (${range[0]}–${range[1]})`} lines={lines} onFocusLines={onFocusLines}>
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
        className="w-full rounded-md border border-border bg-black/40 px-2 py-1 font-game-title text-base text-[#fff6e2] outline-none focus:border-primary/60 disabled:opacity-50"
      />
    </Field>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange, disabled = false, lines, onFocusLines }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  lines?: string[];
  onFocusLines?: FocusLines;
}) {
  return (
    <Field label={label} lines={lines} onFocusLines={onFocusLines}>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`${filterButtonClass(value === option.value)} border border-white/10 disabled:opacity-40`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** GameOverScreen.calcScore with the run's numbers typed in; each field stays inside what a seed allows. */
export function Sts1ScoreCalculator({
  rows,
  scoreLabels,
  serviceLocale,
  onFocusLines,
}: {
  rows: readonly Sts1ScoreBonusRow[];
  scoreLabels: ScoreLabels;
  serviceLocale: ServiceLocale;
  /** The score line ids the field being edited feeds (null when nothing is). */
  onFocusLines?: FocusLines;
}) {
  const focus = (lines: string[]) => ({ lines, onFocusLines });
  const text = TEXT[serviceLocale];
  const [input, setInput] = useState<Sts1ScoreInput>(STS1_SCORE_DEFAULTS);
  const update = (patch: Partial<Sts1ScoreInput>) => setInput((previous) => clampSts1ScoreInput({ ...previous, ...patch }));
  const limits = sts1ScoreLimits(input);
  const { lines, total } = sts1Score(input);
  // Game names for each line: score_bonuses keys, and the Floors Climbed / Enemies Slain lines.
  const nameById = new Map(rows.map((row) => [row.id, row.name]));
  const name = (id: string) => nameById.get(id) ?? id;
  const floorsName = rows.find((row) => row.id === "line-0")?.name ?? "Floors";
  const monstersName = rows.find((row) => row.id === "line-1")?.name ?? "Monsters";
  const lineName = (key: string) => (key === "floors" ? floorsName : key === "monsters" ? monstersName : name(key));
  const toggles: { key: keyof Sts1ScoreInput; id: string; victoryOnly?: boolean }[] = [
    { key: "overkill", id: "Overkill" },
    { key: "combo", id: "Combo" },
    { key: "shiny", id: "Shiny" },
    { key: "mystery", id: "Mystery Machine" },
    { key: "curses", id: "Curses" },
    { key: "poopy", id: "Poopy" },
    { key: "highlander", id: "Highlander", victoryOnly: true },
    { key: "pauper", id: "Pauper", victoryOnly: true },
  ];
  return (
    <section className="mb-6 rounded-lg border border-white/10 bg-black/50 px-5 py-4" data-sts1-score-calculator="">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-game-title text-lg font-bold text-[#efc851]">{text.title}</h2>
        <button type="button" onClick={() => setInput(STS1_SCORE_DEFAULTS)} className="rounded-md border border-white/15 px-2 py-0.5 font-game-text text-xs text-gray-300 hover:text-white">
          {text.reset}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-3">
          <Choice<Sts1RunOutcome>
            {...focus(["Heartbreaker"])}
            label={text.outcome}
            value={input.outcome}
            onChange={(outcome) => update({ outcome })}
            options={[
              { value: "death", label: scoreLabels.death },
              { value: "victory", label: scoreLabels.victory },
              { value: "heart", label: name("Heartbreaker") },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField {...focus(["line-0"])} label={floorsName} value={input.floor} range={limits.floor} onChange={(floor) => update({ floor })} />
            <NumberField {...focus(["line-1"])} label={monstersName} value={input.monsters} range={limits.monsters} onChange={(monsters) => update({ monsters })} />
            <NumberField {...focus(["Ascension"])} label={name("Ascension")} value={input.ascension} range={limits.ascension} onChange={(ascension) => update({ ascension })} />
            {(["Exordium Elites Killed", "City Elites Killed", "Beyond Elites Killed"] as const).map((id, act) => (
              <NumberField
                key={id}
                {...focus([id])}
                label={name(id)}
                value={input.elites[act]}
                range={limits.elites[act]}
                onChange={(count) => update({ elites: input.elites.map((value, index) => (index === act ? count : value)) as Sts1ScoreInput["elites"] })}
              />
            ))}
            <NumberField {...focus(["Bosses Slain"])} label={name("Bosses Slain")} value={input.bosses} range={limits.bosses} onChange={(bosses) => update({ bosses })} />
            <NumberField {...focus(["Champion"])} label={name("Champion")} value={input.champion} range={limits.champion} onChange={(champion) => update({ champion })} />
            <NumberField {...focus(["Perfect", "Beyond Perfect"])} label={name("Perfect")} value={input.perfect} range={limits.perfect} onChange={(perfect) => update({ perfect })} />
            <NumberField {...focus(["Collector"])} label={name("Collector")} value={input.collector} range={limits.collector} onChange={(collector) => update({ collector })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              {...focus(["Money Money", "Raining Money", "I Like Gold"])}
            label={`${name("Money Money")} / ${name("Raining Money")} / ${name("I Like Gold")}`}
              value={input.gold}
              onChange={(gold) => update({ gold })}
              options={[{ value: 0 as const, label: text.none }, { value: 1000 as const, label: name("Money Money") }, { value: 2000 as const, label: name("Raining Money") }, { value: 3000 as const, label: name("I Like Gold") }]}
            />
            <Choice
              {...focus(["Librarian", "Encyclopedian"])}
            label={`${name("Librarian")} / ${name("Encyclopedian")}`}
              value={input.deck}
              onChange={(deck) => update({ deck })}
              options={[{ value: "none" as const, label: text.none }, { value: "librarian" as const, label: name("Librarian") }, { value: "encyclopedian" as const, label: name("Encyclopedian") }]}
            />
            <Choice
              {...focus(["Well Fed", "Stuffed"])}
            label={`${name("Well Fed")} / ${name("Stuffed")}`}
              value={input.maxHp}
              onChange={(maxHp) => update({ maxHp })}
              options={[{ value: "none" as const, label: text.none }, { value: "wellFed" as const, label: name("Well Fed") }, { value: "stuffed" as const, label: name("Stuffed") }]}
            />
            <Choice
              {...focus(["Speedster", "Light Speed"])}
            label={`${name("Speedster")} / ${name("Light Speed")}`}
              value={input.speed}
              disabled={!limits.victoryOnly}
              onChange={(speed) => update({ speed })}
              options={[{ value: "none" as const, label: text.none }, { value: "speedster" as const, label: name("Speedster") }, { value: "lightSpeed" as const, label: name("Light Speed") }]}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {toggles.map((toggle) => (
              <button
                key={toggle.key}
                type="button"
                disabled={toggle.victoryOnly && !limits.victoryOnly}
                aria-pressed={Boolean(input[toggle.key])}
                onClick={() => update({ [toggle.key]: !input[toggle.key] })}
                onFocus={() => onFocusLines?.([toggle.id])}
                onBlur={() => onFocusLines?.(null)}
                className={`${filterButtonClass(Boolean(input[toggle.key]))} border border-white/10 disabled:opacity-40`}
              >
                {name(toggle.id)}
              </button>
            ))}
          </div>
          <p className="font-game-text text-[11px] text-gray-500">{text.note}</p>
        </div>
        <div className="flex flex-col rounded-md border border-white/10 bg-black/40 px-4 py-3">
          <ul className="flex-1 space-y-0.5">
            {lines.filter((line) => line.points !== 0).map((line) => (
              <li key={line.key} className="flex justify-between gap-2 font-game-text text-xs text-gray-300">
                <span className="truncate">{lineName(line.key)}</span>
                <span className="text-[#efc851]">{line.points > 0 ? `+${line.points}` : line.points}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-white/10 pt-2 text-right font-game-title text-2xl text-[#efc851] [text-shadow:0_2px_0_#000]" data-sts1-score-total={total}>
            {scoreLabels.title}: {total}
          </div>
        </div>
      </div>
    </section>
  );
}
