"use client";

import { type ReactNode, useEffect, useId, useState, useTransition } from "react";
import {
  analyzeReplayRun,
  parseReplayRun,
  type ReplayActAnalysis,
  type ReplayMapPointType,
  type ReplayRun,
} from "@/lib/sts2-run-replay";

const SAMPLE_RUN: ReplayRun = {
  seed: "PH19VCZ8LG",
  build_id: "v0.103.2",
  ascension: 10,
  game_mode: "standard",
  win: true,
  acts: ["ACT.OVERGROWTH", "ACT.HIVE", "ACT.GLORY"],
  players: [
    {
      id: 1,
      character: "CHARACTER.SILENT",
      deck: [],
      relics: [],
    },
  ],
  modifiers: [],
  map_point_history: [
    [
      room("ancient", "event", "EVENT.NEOW", 0),
      room("monster", "monster", "ENCOUNTER.FUZZY_WURM_CRAWLER_WEAK", 6),
      room("monster", "monster", "ENCOUNTER.SLIMES_WEAK", 5),
      room("monster", "monster", "ENCOUNTER.NIBBITS_WEAK", 4),
      {
        map_point_type: "unknown",
        rooms: [
          { room_type: "event", model_id: "EVENT.DENSE_VEGETATION", turns_taken: 0 },
          { room_type: "monster", model_id: "ENCOUNTER.DENSE_VEGETATION_EVENT_ENCOUNTER", turns_taken: 4 },
        ],
      },
      room("monster", "monster", "ENCOUNTER.SLIMES_NORMAL", 7),
      room("rest_site", "rest_site", null, 0),
      room("elite", "elite", "ENCOUNTER.BYRDONIS_ELITE", 5),
      room("rest_site", "rest_site", null, 0),
      room("treasure", "treasure", null, 0),
      room("rest_site", "rest_site", null, 0),
      room("monster", "monster", "ENCOUNTER.INKLETS_NORMAL", 2),
      room("rest_site", "rest_site", null, 0),
      room("elite", "elite", "ENCOUNTER.BYGONE_EFFIGY_ELITE", 3),
      room("monster", "monster", "ENCOUNTER.CUBEX_CONSTRUCT_NORMAL", 3),
      room("rest_site", "rest_site", null, 0),
      room("boss", "boss", "ENCOUNTER.CEREMONIAL_BEAST_BOSS", 7),
    ],
    [
      room("ancient", "event", "EVENT.OROBAS", 0),
      room("monster", "monster", "ENCOUNTER.THIEVING_HOPPER_WEAK", 2),
      room("monster", "monster", "ENCOUNTER.BOWLBUGS_WEAK", 3),
      room("monster", "monster", "ENCOUNTER.THE_OBSCURA_NORMAL", 8),
      room("shop", "shop", null, 0),
      room("monster", "monster", "ENCOUNTER.BOWLBUGS_NORMAL", 5),
      room("unknown", "event", "EVENT.BUGSLAYER", 0),
      room("unknown", "event", "EVENT.DOLL_ROOM", 0),
      room("treasure", "treasure", null, 0),
      room("rest_site", "rest_site", null, 0),
      room("monster", "monster", "ENCOUNTER.SPINY_TOAD_NORMAL", 4),
      room("elite", "elite", "ENCOUNTER.ENTOMANCER_ELITE", 7),
      room("monster", "monster", "ENCOUNTER.HUNTER_KILLER_NORMAL", 6),
      room("monster", "monster", "ENCOUNTER.OVICOPTER_NORMAL", 3),
      room("rest_site", "rest_site", null, 0),
      room("boss", "boss", "ENCOUNTER.KAISER_CRAB_BOSS", 12),
    ],
    [
      room("ancient", "event", "EVENT.NONUPEIPE", 0),
      room("monster", "monster", "ENCOUNTER.DEVOTED_SCULPTOR_WEAK", 6),
      room("monster", "monster", "ENCOUNTER.SCROLLS_OF_BITING_WEAK", 3),
      room("monster", "monster", "ENCOUNTER.FABRICATOR_NORMAL", 6),
      room("unknown", "monster", "ENCOUNTER.THE_LOST_AND_FORGOTTEN_NORMAL", 8),
      room("monster", "monster", "ENCOUNTER.OWL_MAGISTRATE_NORMAL", 7),
      room("rest_site", "rest_site", null, 0),
      room("treasure", "treasure", null, 0),
      room("rest_site", "rest_site", null, 0),
      room("elite", "elite", "ENCOUNTER.SOUL_NEXUS_ELITE", 7),
      room("rest_site", "rest_site", null, 0),
      room("monster", "monster", "ENCOUNTER.CONSTRUCT_MENAGERIE_NORMAL", 6),
      room("unknown", "event", "EVENT.TINKER_TIME", 0),
      room("rest_site", "rest_site", null, 0),
      room("boss", "boss", "ENCOUNTER.QUEEN_BOSS", 12),
      room("boss", "boss", "ENCOUNTER.DOORMAKER_BOSS", 11),
    ],
  ],
};

function room(
  mapPointType: ReplayMapPointType,
  roomType: string,
  modelId: string | null,
  turnsTaken: number,
) {
  return {
    map_point_type: mapPointType,
    rooms: [
      {
        room_type: roomType,
        model_id: modelId,
        turns_taken: turnsTaken,
      },
    ],
  };
}

const NODE_META: Record<
  ReplayMapPointType,
  { label: string; glyph: string; base: string; active: string; current: string }
> = {
  ancient: {
    label: "고대의 존재",
    glyph: "A",
    base: "fill-blue-500/20 stroke-blue-400/40 text-blue-200",
    active: "fill-blue-500/45 stroke-blue-300 text-white",
    current: "fill-blue-300 stroke-white text-zinc-950",
  },
  monster: {
    label: "일반 전투",
    glyph: "M",
    base: "fill-zinc-800 stroke-zinc-600 text-zinc-300",
    active: "fill-zinc-700 stroke-amber-300 text-amber-50",
    current: "fill-amber-300 stroke-white text-zinc-950",
  },
  unknown: {
    label: "미지",
    glyph: "?",
    base: "fill-violet-900/40 stroke-violet-400/40 text-violet-200",
    active: "fill-violet-500/45 stroke-violet-200 text-white",
    current: "fill-violet-200 stroke-white text-zinc-950",
  },
  elite: {
    label: "엘리트",
    glyph: "E",
    base: "fill-red-950/60 stroke-red-500/40 text-red-200",
    active: "fill-red-500/55 stroke-red-200 text-white",
    current: "fill-red-200 stroke-white text-zinc-950",
  },
  rest_site: {
    label: "휴식",
    glyph: "R",
    base: "fill-emerald-950/60 stroke-emerald-500/40 text-emerald-200",
    active: "fill-emerald-500/55 stroke-emerald-200 text-white",
    current: "fill-emerald-200 stroke-white text-zinc-950",
  },
  treasure: {
    label: "보물",
    glyph: "T",
    base: "fill-amber-950/70 stroke-amber-500/40 text-amber-200",
    active: "fill-amber-500/55 stroke-amber-100 text-white",
    current: "fill-amber-100 stroke-white text-zinc-950",
  },
  shop: {
    label: "상점",
    glyph: "$",
    base: "fill-cyan-950/60 stroke-cyan-500/40 text-cyan-200",
    active: "fill-cyan-500/55 stroke-cyan-100 text-white",
    current: "fill-cyan-100 stroke-white text-zinc-950",
  },
  boss: {
    label: "보스",
    glyph: "B",
    base: "fill-rose-950/70 stroke-rose-500/40 text-rose-200",
    active: "fill-rose-500/55 stroke-rose-100 text-white",
    current: "fill-rose-100 stroke-white text-zinc-950",
  },
};

export function RunReplayPoc() {
  const [run, setRun] = useState<ReplayRun>(SAMPLE_RUN);
  const [sourceLabel, setSourceLabel] = useState("내장 샘플");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const analysis = analyzeReplayRun(run);
  const exactActs = analysis.acts.filter((act) => act.exactReplay).length;

  async function handleFileChange(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const next = parseReplayRun(text);
      setError(null);
      startTransition(() => {
        setRun(next);
        setSourceLabel(file.name);
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "런 파일을 읽지 못했습니다.";
      setError(message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          `.run` 업로드 기반 seeded replay PoC
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-amber-500/5 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-400">
            STS2 Replay PoC
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-50">
            시드 맵 위에서 런 히스토리를 다시 얹어보기
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
            이 PoC는 `.run`의 <code>seed</code>와 <code>acts</code>로 막 맵을 다시 만들고,
            <code>map_point_history</code>의 타입 시퀀스를 그 위에 맞춰봅니다. 경로 후보가 하나면 exact
            replay, 여러 개면 ambiguous, 하나도 없으면 현재 포트 기준으로 seed drift가 난 상태입니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
            >
              `.run` 파일 업로드
            </label>
            <input
              id={inputId}
              type="file"
              accept=".run,.json"
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              onClick={() => {
                setError(null);
                setRun(SAMPLE_RUN);
                setSourceLabel("내장 샘플");
              }}
            >
              샘플로 되돌리기
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="소스" value={sourceLabel} tone="amber" />
            <StatCard label="Seed" value={analysis.run.seed} tone="blue" />
            <StatCard label="승천" value={`A${analysis.run.ascension}`} tone="red" />
            <StatCard
              label="Exact Replay"
              value={`${exactActs}/${analysis.acts.length} 막`}
              tone={exactActs === analysis.acts.length ? "green" : "amber"}
            />
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/60 p-6">
          <h2 className="text-lg font-bold text-zinc-100">판독 규칙</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            <li>
              <span className="font-semibold text-emerald-300">Exact</span>:
              시드 맵 위에서 히스토리 타입 시퀀스가 딱 한 경로로 결정됨
            </li>
            <li>
              <span className="font-semibold text-amber-300">Ambiguous</span>:
              시드 맵은 재생성됐지만 `.run`만으로는 여러 노드 후보가 남음
            </li>
            <li>
              <span className="font-semibold text-red-300">Zero Match</span>:
              현재 포트/특수 효과/추가 데이터 부족 때문에 경로를 못 맞춤
            </li>
          </ul>

          {analysis.warnings.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                Warnings
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {analysis.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 space-y-8">
        {analysis.acts.map((act) => (
          <ActReplayCard key={`${sourceLabel}-${act.actId}-${act.actIndex}`} act={act} />
        ))}
      </div>

      {isPending && (
        <div className="mt-6 text-sm text-zinc-400">런 파일을 분석 중입니다…</div>
      )}
    </div>
  );
}

function ActReplayCard({ act }: { act: ReplayActAnalysis }) {
  const [step, setStep] = useState(act.history.length);
  const [playing, setPlaying] = useState(false);
  const currentEntry = act.history[Math.max(0, step - 1)] ?? null;

  useEffect(() => {
    setStep(act.history.length);
    setPlaying(false);
  }, [act.history.length, act.actIndex]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStep((prev) => {
        if (prev >= act.history.length) {
          window.clearInterval(timer);
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing, act.history.length]);

  const statusTone =
    act.matchedPathCount === 0 ? "red" : act.exactReplay ? "green" : "amber";

  return (
    <section className="rounded-3xl border border-border bg-card/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-zinc-50">{act.actLabel}</h2>
            <StatusBadge tone={statusTone}>
              {act.matchedPathCount === 0
                ? "Zero Match"
                : act.exactReplay
                  ? "Exact Replay"
                  : `${act.matchedPathCount}${act.matchedPathCountCapped ? "+" : ""} candidates`}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {act.actId} · floor {act.baseFloor}-{act.baseFloor + act.history.length - 1}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            onClick={() => {
              setPlaying(false);
              setStep(1);
            }}
          >
            처음부터
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
            onClick={() => {
              if (step === act.history.length) {
                setStep(1);
              }
              setPlaying((value) => !value);
            }}
          >
            {playing ? "정지" : "재생"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Seeded Map
              </p>
              <p className="text-sm text-zinc-300">
                step {step}/{act.history.length}
              </p>
            </div>
            <input
              type="range"
              min={1}
              max={act.history.length}
              value={step}
              className="w-56 accent-amber-300"
              onChange={(event) => {
                setPlaying(false);
                setStep(Number(event.target.value));
              }}
            />
          </div>
          <SeededMapView act={act} step={step} />
        </div>

        <div className="space-y-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Current Step</p>
            <div className="mt-2 text-lg font-semibold text-zinc-50">
              {currentEntry ? formatRoomSummary(currentEntry) : "N/A"}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              후보 노드 {act.candidateNodeIdsByStep[step - 1]?.length ?? 0}개
            </p>
          </div>

          <ol className="max-h-[42rem] space-y-2 overflow-auto pr-1">
            {act.history.map((entry, index) => {
              const floor = act.baseFloor + index;
              const meta = NODE_META[act.historyTypes[index]];
              const current = index + 1 === step;

              return (
                <li
                  key={`${act.actId}-${floor}`}
                  className={`rounded-2xl border px-4 py-3 transition ${
                    current
                      ? "border-amber-300/60 bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-950/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${meta.base}`}
                    >
                      {meta.glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Floor {floor}
                        </span>
                        <span className="text-sm font-medium text-zinc-100">{meta.label}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-300">
                        {formatRoomSummary(entry)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {act.candidateNodeIdsByStep[index]?.length ?? 0} 후보
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function SeededMapView({ act, step }: { act: ReplayActAnalysis; step: number }) {
  const nodeMap = new Map(act.nodes.map((node) => [node.id, node]));
  const activeNodes = new Set<string>();
  const currentNodes = new Set(act.candidateNodeIdsByStep[step - 1] ?? []);
  const activeEdges = new Set<string>();

  for (let index = 0; index < step; index++) {
    for (const nodeId of act.candidateNodeIdsByStep[index] ?? []) {
      activeNodes.add(nodeId);
    }
    for (const edgeId of act.candidateEdgeIdsByStep[index] ?? []) {
      activeEdges.add(edgeId);
    }
  }

  const width = 560;
  const height = Math.max(360, act.rowCount * 58 + 20);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {act.edges.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        const hot = activeEdges.has(edge.id);

        return (
          <line
            key={edge.id}
            x1={xOf(from.col)}
            y1={yOf(from.row)}
            x2={xOf(to.col)}
            y2={yOf(to.row)}
            stroke={hot ? "rgba(251, 191, 36, 0.9)" : "rgba(113, 113, 122, 0.55)"}
            strokeWidth={hot ? 4 : 2}
            strokeLinecap="round"
          />
        );
      })}

      {act.nodes.map((node) => {
        const meta = NODE_META[node.type];
        const active = activeNodes.has(node.id);
        const current = currentNodes.has(node.id);
        const palette = current ? meta.current : active ? meta.active : meta.base;
        const classes = palette.split(" ");

        return (
          <g key={node.id} transform={`translate(${xOf(node.col)}, ${yOf(node.row)})`}>
            <circle
              r={current ? 17 : 14}
              className={`${classes[0]} ${classes[1]}`}
              strokeWidth={current ? 3 : 2}
            />
            <text
              y={4}
              textAnchor="middle"
              className={`select-none text-[11px] font-black ${classes[2]}`}
            >
              {meta.glyph}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatRoomSummary(entry: ReplayActAnalysis["history"][number]) {
  const firstRoom = entry.rooms[0];
  if (!firstRoom) return entry.map_point_type;
  return firstRoom.model_id ?? firstRoom.room_type;
}

function xOf(col: number) {
  return 52 + col * 76;
}

function yOf(row: number) {
  return 36 + row * 56;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "blue" | "red" | "green";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
      : tone === "blue"
        ? "border-blue-400/30 bg-blue-500/10 text-blue-100"
        : tone === "red"
          ? "border-red-400/30 bg-red-500/10 text-red-100"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="mt-1 truncate text-lg font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "amber" | "red";
}) {
  const classes =
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : tone === "amber"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
        : "border-red-400/40 bg-red-500/10 text-red-200";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}
