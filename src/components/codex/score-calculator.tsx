"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { RunBadgeStrip } from "@/components/history-course/run-badge-strip";
import { sts2RunBadges, sts2RunScore, type Sts2RunFile } from "@/lib/sts2/run-score";
import {
  clampSts2ScoreInput,
  STS2_SCORE_DEFAULTS,
  sts2BadgesFromInput,
  sts2Score,
  sts2ScoreLimits,
  type Sts2ScoreInput,
  type Sts2ScoreLine,
  type Sts2ScoreLineKey,
} from "@/lib/sts2/score";
import { STS2_SCORE_ICONS, sts2ScoreLineLabel, type Sts2ScoreTexts } from "@/lib/sts2/score-texts";

export type { Sts2ScoreTexts };

const ICONS = STS2_SCORE_ICONS;
const lineLabel = sts2ScoreLineLabel;
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
        badges: "뱃지 (입력만으로 판정되는 것)",
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
        badges: "Badges (decided by these inputs)",
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

/** The game-over screen's score lines (icon, filled label, +points or ×multiplier) and the total. */
export function Sts2ScoreBreakdown({ lines, total, texts, totalLabel, hideTotal }: { lines: readonly Sts2ScoreLine[]; total: number; texts: Sts2ScoreTexts; totalLabel: string; hideTotal?: boolean }) {
  return (
    <div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-2 text-sm text-gray-200">
            <Image src={ICONS[line.key]} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="min-w-0 flex-1 truncate">{line.key === "dread" ? lineLabel(texts.lines.dread) : lineLabel(texts.lines[line.key], line.count)}</span>
            <span className="font-game-title text-[#efc851]">{line.multiplier ? `x${line.multiplier}` : `+${line.points}`}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 border-t border-white/10 pt-2 text-right font-game-title text-2xl text-[#efc851] ${hideTotal ? "invisible" : ""}`} data-sts2-score-total={total}>
        {totalLabel}: {total}
      </div>
    </div>
  );
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
  // Only the badges the inputs alone decide (the elite count tiers); a run file decides the rest.
  const badges = sts2BadgesFromInput(input);
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
            <Sts2ScoreBreakdown lines={lines} total={total} texts={texts} totalLabel={t.total} />
            {badges.length ? (
              <div className="mt-3 border-t border-white/10 pt-2">
                <div className="mb-1 text-xs text-gray-400">{t.badges}</div>
                <RunBadgeStrip badges={badges} serviceLocale={serviceLocale} size="lg" />
              </div>
            ) : null}
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

/**
 * A run file (the game's saves/history/*.run, or a History Course upload) scored exactly as the
 * game scores it (ScoreUtility, BadgePool; checked against the game on every real run we have).
 */
export function Sts2RunScoreLoader({ texts, serviceLocale }: { texts: Sts2ScoreTexts; serviceLocale: ServiceLocale }) {
  const ko = serviceLocale === "ko";
  const [run, setRun] = useState<Sts2RunFile | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Sts2RunFile;
      if (!Array.isArray(parsed?.map_point_history) || !Array.isArray(parsed?.players) || !parsed.players.length) throw new Error("shape");
      setRun(parsed);
      setPlayerId(parsed.players[0].id);
      setError(null);
    } catch {
      setRun(null);
      setError(ko ? "STS2 런 파일(.run)이 아닙니다." : "Not an STS2 run file (.run).");
    }
  };
  const player = run?.players.find((row) => row.id === playerId) ?? run?.players[0];
  const score = run && player ? sts2RunScore(run, player.id) : null;
  const badges = run && player ? sts2RunBadges(run, player.id) : [];
  return (
    <section className="mx-auto mb-6 max-w-6xl rounded-lg border border-white/10 bg-black/50 px-5 py-4" data-sts2-run-score="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-game-title text-lg font-bold text-primary">{ko ? "런 파일로 계산" : "Score a run file"}</h2>
          <p className="text-xs text-gray-400">
            {ko
              ? "게임의 saves/history 폴더의 .run 파일(역사강의서에 올린 파일)을 넣으면 게임과 같은 방식으로 점수와 뱃지를 계산합니다."
              : "Drop a .run file from the game's saves/history folder (the one you upload to the History Course) to score it the way the game does."}
          </p>
        </div>
        <label className="cursor-pointer rounded-md border border-primary/50 px-3 py-1.5 text-sm text-primary hover:bg-primary/10">
          {ko ? "파일 선택" : "Choose file"}
          <input type="file" accept=".run,.json,application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {run && score ? (
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-md border border-white/10 bg-black/40 px-4 py-3">
            {run.players.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {run.players.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={row.id === player?.id}
                    onClick={() => setPlayerId(row.id)}
                    className={`rounded border border-white/10 px-2 py-0.5 text-xs ${row.id === player?.id ? "bg-primary/20 text-primary" : "text-gray-400"}`}
                  >
                    {`P${index + 1} ${row.character.replace(/^CHARACTER\./, "")}`}
                  </button>
                ))}
              </div>
            ) : null}
            <Sts2ScoreBreakdown lines={score.lines} total={score.total} texts={texts} totalLabel={ko ? "점수" : "Score"} />
          </div>
          <div className="rounded-md border border-white/10 bg-black/40 px-4 py-3">
            <div className="mb-1 text-xs text-gray-400">{ko ? "뱃지" : "Badges"}</div>
            {badges.length ? <RunBadgeStrip badges={badges} serviceLocale={serviceLocale} size="lg" /> : <p className="text-sm text-gray-500">{ko ? "없음" : "None"}</p>}
            <p className="mt-3 text-xs text-gray-500">
              {run.was_abandoned ? (ko ? "포기한 런 · " : "Abandoned · ") : ""}{run.win ? texts.win : texts.lose} · {ko ? "승천" : "Ascension"} {run.ascension} · {run.game_mode}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
