"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
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
  {
    label: string;
    chip: string;
  }
> = {
  ancient: {
    label: "고대의 존재",
    chip: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  },
  monster: {
    label: "일반 전투",
    chip: "border-zinc-700 bg-zinc-900/80 text-zinc-100",
  },
  unknown: {
    label: "미지",
    chip: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
  },
  elite: {
    label: "엘리트",
    chip: "border-zinc-700 bg-zinc-900/85 text-red-100",
  },
  rest_site: {
    label: "휴식",
    chip: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  },
  treasure: {
    label: "보물",
    chip: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  },
  shop: {
    label: "상점",
    chip: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  },
  boss: {
    label: "보스",
    chip: "border-zinc-700 bg-zinc-900/85 text-rose-100",
  },
};

const ACT_MAP_META: Record<
  string,
  {
    key: "overgrowth" | "underdocks" | "hive" | "glory";
    bgColor: string;
    traveledColor: string;
    untraveledColor: string;
    border: string;
  }
> = {
  "ACT.OVERGROWTH": {
    key: "overgrowth",
    bgColor: "#A78A67",
    traveledColor: "#28231D",
    untraveledColor: "#877256",
    border: "rgba(167, 138, 103, 0.36)",
  },
  "ACT.UNDERDOCKS": {
    key: "underdocks",
    bgColor: "#9F95A5",
    traveledColor: "#180F24",
    untraveledColor: "#534A62",
    border: "rgba(159, 149, 165, 0.36)",
  },
  "ACT.HIVE": {
    key: "hive",
    bgColor: "#9B9562",
    traveledColor: "#27221C",
    untraveledColor: "#6E7750",
    border: "rgba(155, 149, 98, 0.36)",
  },
  "ACT.GLORY": {
    key: "glory",
    bgColor: "#819A97",
    traveledColor: "#1D1E2F",
    untraveledColor: "#60717C",
    border: "rgba(129, 154, 151, 0.36)",
  },
};

const ANCIENT_ASSETS: Record<
  string,
  {
    node: string;
  }
> = {
  neow: {
    node: "/images/sts2/ancient-nodes/ancient_node_neow.webp",
  },
  orobas: {
    node: "/images/sts2/ancient-nodes/ancient_node_orobas.webp",
  },
  nonupeipe: {
    node: "/images/sts2/ancient-nodes/ancient_node_nonupeipe.webp",
  },
  darv: {
    node: "/images/sts2/ancient-nodes/ancient_node_darv.webp",
  },
  pael: {
    node: "/images/sts2/ancient-nodes/ancient_node_pael.webp",
  },
  tanx: {
    node: "/images/sts2/ancient-nodes/ancient_node_tanx.webp",
  },
  tezcatara: {
    node: "/images/sts2/ancient-nodes/ancient_node_tezcatara.webp",
  },
  vakuu: {
    node: "/images/sts2/ancient-nodes/ancient_node_vakuu.webp",
  },
};

const FALLBACK_ACT_MAP_META = ACT_MAP_META["ACT.OVERGROWTH"];
const BOSS_PLACEHOLDER_KEYS = new Set([
  "doormaker_boss",
  "kaiser_crab_boss",
  "knowledge_demon_boss",
  "lagavulin_matriarch_boss",
  "soul_fysh_boss",
  "test_subject_boss",
  "the_kin_boss",
  "vantom_boss",
  "waterfall_giant_boss",
]);
const MAP_PADDING_X = 52;
const MAP_PADDING_TOP = 54;
const MAP_PADDING_BOTTOM = 62;
const MAP_COLUMN_GAP = 76;
const MAP_ROW_GAP = 58;
const MAP_CANVAS_WIDTH = MAP_PADDING_X * 2 + MAP_COLUMN_GAP * 6;
const MAP_BACKDROP_SEGMENTS = [
  { name: "top", top: 0, height: 32 },
  { name: "middle", top: 32, height: 36 },
  { name: "bottom", top: 68, height: 32 },
] as const;

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
  const currentType = act.historyTypes[Math.max(0, step - 1)] ?? "monster";

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
            <div className="mt-3 flex items-center gap-4">
              {currentEntry && (
                <StepAsset
                  entry={currentEntry}
                  type={currentType}
                  act={act}
                  current
                  size="hero"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-zinc-50">
                  {currentEntry ? formatRoomSummary(currentEntry) : "N/A"}
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {currentEntry ? NODE_META[currentType].label : "미확인"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  후보 노드 {act.candidateNodeIdsByStep[step - 1]?.length ?? 0}개
                </p>
              </div>
            </div>
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
                    <StepAsset
                      entry={entry}
                      type={act.historyTypes[index]}
                      act={act}
                      current={current}
                      size="list"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Floor {floor}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
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
  const meta = actMapMeta(act.actId);
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

  const height = mapHeightOf(act.rowCount);

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border bg-[#120e0a]"
      style={{ height, borderColor: meta.border }}
    >
      <MapBackdrop actId={act.actId} />
      <div className="absolute inset-0 bg-black/18" />
      <div className="absolute inset-[18px] rounded-[1.55rem] border border-white/6" />
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{ width: MAP_CANVAS_WIDTH }}
      >
        {act.edges.flatMap((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return [];
          const visited = activeEdges.has(edge.id);

          return buildPathTicks(edge.id, from, to, act.rowCount).map((tick, index) => (
            <div
              key={`${edge.id}-${index}`}
              className="absolute"
              style={{
                left: tick.left,
                top: tick.top,
                width: 16,
                height: 16,
                transform: `translate(-50%, -50%) rotate(${tick.rotation}rad) scale(${
                  visited ? 1.2 : 1
                })`,
                ...maskStyle(
                  effectSrc("map_dot"),
                  visited ? meta.traveledColor : meta.untraveledColor,
                ),
              }}
            />
          ));
        })}

        {act.nodes.map((node) => {
          const active = activeNodes.has(node.id);
          const current = currentNodes.has(node.id);
          const position = nodePosition(node, act.rowCount);
          const state = current ? "current" : active ? "active" : "inactive";
          const size = mapNodeSize(node.type);

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{
                left: position.left,
                top: position.top,
                transform: `translate(-50%, -50%) scale(${
                  current ? 1.08 : active ? 1 : 0.95
                })`,
              }}
            >
              <MapNodeAsset node={node} act={act} state={state} size={size} />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 rounded-full border border-white/8 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
        아래에서 위로 등반
      </div>
    </div>
  );
}

function MapBackdrop({ actId }: { actId: string }) {
  const meta = actMapMeta(actId);

  return (
    <div className="absolute inset-0">
      {MAP_BACKDROP_SEGMENTS.map((segment) => (
        <div
          key={segment.name}
          className="absolute inset-x-0 overflow-hidden"
          style={{ top: `${segment.top}%`, height: `${segment.height}%` }}
        >
          <Image
            src={`/images/sts2/map/backgrounds/${meta.key}/${segment.name}.png`}
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 720px"
            className="object-fill"
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
}

function formatRoomSummary(entry: ReplayActAnalysis["history"][number]) {
  const firstRoom = entry.rooms[0];
  if (!firstRoom) return entry.map_point_type;
  return firstRoom.model_id ?? firstRoom.room_type;
}

function mapHeightOf(rowCount: number) {
  return Math.max(420, MAP_PADDING_TOP + MAP_PADDING_BOTTOM + rowCount * MAP_ROW_GAP);
}

function pointPosition(col: number, row: number, rowCount: number) {
  const height = mapHeightOf(rowCount);
  return {
    left: MAP_PADDING_X + col * MAP_COLUMN_GAP,
    top: height - MAP_PADDING_BOTTOM - row * MAP_ROW_GAP,
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableSigned(value: string, magnitude: number) {
  return ((stableHash(value) / 4294967295) * 2 - 1) * magnitude;
}

function nodePosition(
  node: ReplayActAnalysis["nodes"][number],
  rowCount: number,
): { left: number; top: number } {
  const base = pointPosition(node.col, node.row, rowCount);
  if (node.type === "ancient" || node.type === "boss") {
    return base;
  }
  return {
    left: base.left + stableSigned(`${node.id}:x`, 8),
    top: base.top + stableSigned(`${node.id}:y`, 10),
  };
}

function mapNodeSize(type: ReplayMapPointType) {
  switch (type) {
    case "ancient":
      return 82;
    case "boss":
      return 96;
    case "shop":
    case "rest_site":
      return 72;
    case "treasure":
    case "unknown":
      return 66;
    default:
      return 70;
  }
}

function buildPathTicks(
  edgeId: string,
  from: ReplayActAnalysis["nodes"][number],
  to: ReplayActAnalysis["nodes"][number],
  rowCount: number,
) {
  const start = nodePosition(from, rowCount);
  const end = nodePosition(to, rowCount);
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const spacing = 22;
  const count = Math.floor(length / spacing) + 1;
  const unitX = length === 0 ? 0 : dx / length;
  const unitY = length === 0 ? 0 : dy / length;
  const baseRotation = Math.atan2(dy, dx) + Math.PI / 2;

  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => {
    const step = index + 1;
    return {
      left:
        start.left + unitX * spacing * step + stableSigned(`${edgeId}:${step}:x`, 3),
      top:
        start.top + unitY * spacing * step + stableSigned(`${edgeId}:${step}:y`, 3),
      rotation: baseRotation + stableSigned(`${edgeId}:${step}:r`, 0.1),
    };
  });
}

function actMapMeta(actId: string) {
  return ACT_MAP_META[actId] ?? FALLBACK_ACT_MAP_META;
}

function getAncientAsset(act: ReplayActAnalysis) {
  const key = normalizeModelKey(act.history[0]?.rooms[0]?.model_id);
  const asset = key ? ANCIENT_ASSETS[key] : null;
  return {
    key,
    node: asset?.node ?? "/images/sts2/ancient-nodes/ancient_node_neow.webp",
    fallback: "/images/sts2/npcs/neow.webp",
  };
}

function getBossKeys(act: ReplayActAnalysis) {
  return act.history
    .filter((entry) => entry.map_point_type === "boss")
    .map((entry) => normalizeModelKey(entry.rooms[0]?.model_id))
    .filter((key): key is string => Boolean(key));
}

function normalizeModelKey(value: string | null | undefined) {
  if (!value) return null;
  return value.split(".").pop()?.toLowerCase() ?? null;
}

function bossAssetPath(key: string | null) {
  return key ? `/images/sts2/bosses/${key}.webp` : null;
}

function bossPlaceholderIconSrc(key: string) {
  return `/images/sts2/map/bosses/${key}_icon.png`;
}

function bossPlaceholderOutlineSrc(key: string) {
  return `/images/sts2/map/bosses/${key}_icon_outline.png`;
}

function mapIconNameForType(type: ReplayMapPointType) {
  switch (type) {
    case "monster":
      return "map_monster";
    case "elite":
      return "map_elite";
    case "rest_site":
      return "map_rest";
    case "treasure":
      return "map_chest";
    case "shop":
      return "map_shop";
    case "unknown":
      return "map_unknown";
    default:
      return null;
  }
}

function mapOutlineNameForType(type: ReplayMapPointType) {
  switch (type) {
    case "monster":
      return "map_monster_outline";
    case "elite":
      return "map_elite_outline";
    case "rest_site":
      return "map_rest_outline";
    case "treasure":
      return "map_chest_outline";
    case "shop":
      return "map_shop_outline";
    case "unknown":
      return "map_unknown_outline";
    default:
      return null;
  }
}

function revealedUnknownIconName(entry: ReplayActAnalysis["history"][number]) {
  const firstRoomType = entry.rooms[0]?.room_type?.toLowerCase();
  switch (firstRoomType) {
    case "monster":
      return "map_unknown_monster";
    case "elite":
      return "map_unknown_elite";
    case "shop":
      return "map_unknown_shop";
    case "treasure":
      return "map_unknown_chest";
    default:
      return "map_unknown";
  }
}

function revealedUnknownOutlineName(entry: ReplayActAnalysis["history"][number]) {
  const firstRoomType = entry.rooms[0]?.room_type?.toLowerCase();
  switch (firstRoomType) {
    case "monster":
      return "map_monster_outline";
    case "elite":
      return "map_elite_outline";
    case "shop":
      return "map_shop_outline";
    case "treasure":
      return "map_chest_outline";
    default:
      return "map_unknown_outline";
  }
}

function mapIconSrc(actId: string, iconName: string) {
  const meta = actMapMeta(actId);
  return `/images/sts2/map/icons-by-act/${meta.key}/${iconName}.png`;
}

function mapOutlineSrc(outlineName: string) {
  return `/images/sts2/map/outlines/${outlineName}.png`;
}

function effectSrc(name: string) {
  return `/images/sts2/map/effects/${name}.png`;
}

function maskStyle(src: string, color: string, opacity = 1): CSSProperties {
  return {
    backgroundColor: color,
    opacity,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

function nodeOpacity(state: "inactive" | "active" | "current") {
  return state === "inactive" ? 0.52 : 1;
}

function outlineOpacity(state: "inactive" | "active" | "current") {
  return state === "inactive" ? 0.72 : 1;
}

function backgroundOpacity(state: "inactive" | "active" | "current") {
  return state === "inactive" ? 0.78 : 0.94;
}

function circleOpacity(state: "inactive" | "active" | "current") {
  if (state === "inactive") return 0;
  return state === "current" ? 1 : 0.92;
}

function bossKeyForRow(act: ReplayActAnalysis, row: number) {
  const bossKeys = getBossKeys(act);
  const maxBossRow = Math.max(
    ...act.nodes.filter((node) => node.type === "boss").map((node) => node.row),
  );
  const secondBoss = bossKeys.length > 1 && row === maxBossRow;

  return secondBoss ? (bossKeys.at(-1) ?? bossKeys[0] ?? null) : (bossKeys[0] ?? null);
}

function MapNodeAsset({
  node,
  act,
  state,
  size,
}: {
  node: ReplayActAnalysis["nodes"][number];
  act: ReplayActAnalysis;
  state: "inactive" | "active" | "current";
  size: number;
}) {
  if (node.type === "ancient") {
    const ancientAsset = getAncientAsset(act);
    return (
      <SpecialMapAsset
        actId={act.actId}
        state={state}
        size={size}
        src={ancientAsset.node}
        fallbackSrc={ancientAsset.fallback}
        alt={NODE_META[node.type].label}
        className="object-contain"
      />
    );
  }

  if (node.type === "boss") {
    const bossKey = bossKeyForRow(act, node.row);
    if (bossKey && BOSS_PLACEHOLDER_KEYS.has(bossKey)) {
      return (
        <BossPlaceholderAsset
          actId={act.actId}
          state={state}
          size={size}
          bossKey={bossKey}
          alt={NODE_META[node.type].label}
        />
      );
    }

    return (
      <SpecialMapAsset
        actId={act.actId}
        state={state}
        size={size}
        src={bossAssetPath(bossKey)}
        fallbackSrc="/images/sts2/nav/stats_monsters.png"
        alt={NODE_META[node.type].label}
        className="object-contain scale-[1.04]"
        framed
      />
    );
  }

  const iconName = mapIconNameForType(node.type);
  const outlineName = mapOutlineNameForType(node.type);
  if (!iconName || !outlineName) {
    return null;
  }

  return (
    <MapRoomAsset
      actId={act.actId}
      state={state}
      size={size}
      iconName={iconName}
      outlineName={outlineName}
      alt={NODE_META[node.type].label}
    />
  );
}

function MapRoomAsset({
  actId,
  state,
  size,
  iconName,
  outlineName,
  alt,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: number;
  iconName: string;
  outlineName: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {state !== "inactive" && (
        <div className="absolute inset-[-18%]" style={{ opacity: circleOpacity(state) }}>
          <AssetThumb
            src={effectSrc("map_circle_4")}
            fallbackSrc={null}
            alt=""
            className="object-contain"
          />
        </div>
      )}
      <div
        className="absolute inset-[6%]"
        style={{ opacity: backgroundOpacity(state) }}
      >
        <AssetThumb
          src="/images/sts2/map/icons/map_node_background.png"
          fallbackSrc={null}
          alt=""
          className="object-contain"
        />
      </div>
      <div
        className="absolute inset-[9%]"
        style={maskStyle(mapOutlineSrc(outlineName), meta.bgColor, outlineOpacity(state))}
      />
      <div className="absolute inset-[16%]" style={{ opacity: nodeOpacity(state) }}>
        <AssetThumb
          src={mapIconSrc(actId, iconName)}
          fallbackSrc={`/images/sts2/map/icons/${iconName}.png`}
          alt={alt}
          className="object-contain"
        />
      </div>
    </div>
  );
}

function StepAsset({
  entry,
  type,
  act,
  current,
  size,
}: {
  entry: ReplayActAnalysis["history"][number];
  type: ReplayMapPointType;
  act: ReplayActAnalysis;
  current: boolean;
  size: "list" | "hero";
}) {
  const boxSize = size === "hero" ? 76 : 46;
  const state = current ? "current" : "inactive";

  if (type === "ancient") {
    const ancientAsset = getAncientAsset(act);
    return (
      <SpecialMapAsset
        actId={act.actId}
        state={state}
        size={boxSize}
        src={ancientAsset.node}
        fallbackSrc={ancientAsset.fallback}
        alt={NODE_META[type].label}
        className="object-contain"
      />
    );
  }

  if (type === "boss") {
    const bossKey = normalizeModelKey(entry.rooms[0]?.model_id);
    if (bossKey && BOSS_PLACEHOLDER_KEYS.has(bossKey)) {
      return (
        <BossPlaceholderAsset
          actId={act.actId}
          state={state}
          size={boxSize}
          bossKey={bossKey}
          alt={NODE_META[type].label}
        />
      );
    }

    return (
      <SpecialMapAsset
        actId={act.actId}
        state={state}
        size={boxSize}
        src={bossAssetPath(bossKey)}
        fallbackSrc="/images/sts2/nav/stats_monsters.png"
        alt={NODE_META[type].label}
        className="object-contain scale-[1.04]"
        framed
      />
    );
  }

  const iconName =
    type === "unknown" ? revealedUnknownIconName(entry) : mapIconNameForType(type);
  const outlineName =
    type === "unknown" ? revealedUnknownOutlineName(entry) : mapOutlineNameForType(type);

  if (!iconName || !outlineName) {
    return null;
  }

  return (
    <MapRoomAsset
      actId={act.actId}
      state={state}
      size={boxSize}
      iconName={iconName}
      outlineName={outlineName}
      alt={NODE_META[type].label}
    />
  );
}

function BossPlaceholderAsset({
  actId,
  state,
  size,
  bossKey,
  alt,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: number;
  bossKey: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {state !== "inactive" && (
        <div className="absolute inset-[-18%]" style={{ opacity: circleOpacity(state) }}>
          <AssetThumb
            src={effectSrc("map_circle_4")}
            fallbackSrc={null}
            alt=""
            className="object-contain"
          />
        </div>
      )}
      <div
        className="absolute inset-[8%]"
        style={maskStyle(bossPlaceholderOutlineSrc(bossKey), meta.bgColor)}
      />
      <div
        className="absolute inset-[16%]"
        aria-label={alt}
        style={maskStyle(
          bossPlaceholderIconSrc(bossKey),
          state === "inactive" ? meta.untraveledColor : meta.traveledColor,
          state === "inactive" ? 0.86 : 1,
        )}
      />
    </div>
  );
}

function SpecialMapAsset({
  actId,
  state,
  size,
  src,
  fallbackSrc,
  alt,
  className,
  framed = false,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: number;
  src: string | null;
  fallbackSrc: string | null;
  alt: string;
  className: string;
  framed?: boolean;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {state !== "inactive" && (
        <div className="absolute inset-[-18%]" style={{ opacity: circleOpacity(state) }}>
          <AssetThumb
            src={effectSrc("map_circle_4")}
            fallbackSrc={null}
            alt=""
            className="object-contain"
          />
        </div>
      )}
      {framed && (
        <div
          className="absolute inset-[8%] rounded-[1.3rem] border bg-black/35"
          style={{ borderColor: meta.border, opacity: state === "inactive" ? 0.78 : 1 }}
        />
      )}
      <div
        className={framed ? "absolute inset-[16%]" : "absolute inset-[4%]"}
        style={{ opacity: state === "inactive" ? 0.72 : 1 }}
      >
        <AssetThumb src={src} fallbackSrc={fallbackSrc} alt={alt} className={className} />
      </div>
    </div>
  );
}

function AssetThumb({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src: string | null;
  fallbackSrc: string | null;
  alt: string;
  className: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = src && failedSrc !== src ? src : fallbackSrc ?? src;

  if (!resolvedSrc) {
    return null;
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill
      sizes="(max-width: 1280px) 96px, 128px"
      className={className}
      onError={() => {
        if (src && fallbackSrc && resolvedSrc === src) {
          setFailedSrc(src);
        }
      }}
    />
  );
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
