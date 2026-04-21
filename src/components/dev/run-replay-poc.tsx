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
    color: string;
    line: string;
    hotLine: string;
    border: string;
  }
> = {
  "ACT.OVERGROWTH": {
    key: "overgrowth",
    color: "#A78A67",
    line: "rgba(83, 61, 42, 0.58)",
    hotLine: "rgba(207, 191, 156, 0.92)",
    border: "rgba(167, 138, 103, 0.36)",
  },
  "ACT.UNDERDOCKS": {
    key: "underdocks",
    color: "#9F95A5",
    line: "rgba(69, 59, 73, 0.58)",
    hotLine: "rgba(205, 197, 212, 0.92)",
    border: "rgba(159, 149, 165, 0.36)",
  },
  "ACT.HIVE": {
    key: "hive",
    color: "#9B9562",
    line: "rgba(81, 74, 39, 0.58)",
    hotLine: "rgba(205, 196, 135, 0.92)",
    border: "rgba(155, 149, 98, 0.36)",
  },
  "ACT.GLORY": {
    key: "glory",
    color: "#819A97",
    line: "rgba(52, 66, 64, 0.58)",
    hotLine: "rgba(188, 214, 209, 0.92)",
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
  const theme = ACT_THEME[act.actId] ?? FALLBACK_THEME;
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
  const ancientAsset = getAncientAsset(act);
  const firstBossAsset = bossAssetPath(getBossKeys(act)[0] ?? null);

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border ${theme.border} bg-gradient-to-b ${theme.background}`}
      style={{ height }}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{ backgroundImage: theme.mist }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0.03),transparent_32%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_34%)]" />
      {ancientAsset.background && (
        <div className="absolute inset-x-0 bottom-0 h-56 opacity-22">
          <Image
            src={ancientAsset.background}
            alt="Ancient backdrop"
            fill
            sizes="560px"
            className="object-contain object-bottom"
          />
        </div>
      )}
      {!ancientAsset.background && ancientAsset.portrait && (
        <div className="absolute bottom-0 left-6 h-44 w-44 opacity-18">
          <Image
            src={ancientAsset.portrait}
            alt="Ancient portrait"
            fill
            sizes="176px"
            className="object-contain object-bottom"
          />
        </div>
      )}
      {firstBossAsset && (
        <div className="absolute right-4 top-4 h-32 w-32 opacity-22">
          <AssetThumb
            src={firstBossAsset}
            fallbackSrc="/images/sts2/nav/stats_monsters.png"
            alt="Boss portrait"
            className="object-contain object-top"
          />
        </div>
      )}
      <div className="absolute inset-[18px] rounded-[1.55rem] border border-white/6" />

      {act.edges.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        const hot = activeEdges.has(edge.id);
        const style = lineStyleForEdge(from, to, act.rowCount);

        return (
          <div
            key={edge.id}
            className={`absolute origin-left rounded-full ${
              hot
                ? `h-[4px] bg-gradient-to-r ${theme.activeLine} shadow-[0_0_20px_rgba(251,191,36,0.35)]`
                : `h-[2px] ${theme.inactiveLine}`
            }`}
            style={style}
          />
        );
      })}

      {act.nodes.map((node) => {
        const active = activeNodes.has(node.id);
        const current = currentNodes.has(node.id);
        const position = pointPosition(node.col, node.row, act.rowCount);
        const state = current ? "current" : active ? "active" : "inactive";
        const size = mapNodeSize(node.type);

        return (
          <div
            key={node.id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
              current ? "scale-110" : active ? "scale-100" : "scale-[0.94]"
            }`}
            style={{ left: position.left, top: position.top }}
          >
            <MapNodeAsset node={node} act={act} state={state} size={size} />
          </div>
        );
      })}

      <div className="absolute bottom-4 left-4 rounded-full border border-white/8 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
        아래에서 위로 등반
      </div>
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

function lineStyleForEdge(
  from: { col: number; row: number },
  to: { col: number; row: number },
  rowCount: number,
): CSSProperties {
  const start = pointPosition(from.col, from.row, rowCount);
  const end = pointPosition(to.col, to.row, rowCount);
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    left: start.left,
    top: start.top,
    width: length,
    transform: `translateY(-50%) rotate(${angle}rad)`,
  };
}

function mapNodeSize(type: ReplayMapPointType) {
  switch (type) {
    case "ancient":
      return 74;
    case "boss":
      return 94;
    case "shop":
    case "rest_site":
      return 66;
    case "treasure":
    case "unknown":
      return 58;
    default:
      return 62;
  }
}

function getAncientAsset(act: ReplayActAnalysis) {
  const key = normalizeModelKey(act.history[0]?.rooms[0]?.model_id);
  const asset = key ? ANCIENT_ASSETS[key] : null;
  return {
    key,
    node: asset?.node ?? "/images/sts2/ancient-nodes/ancient_node_neow.webp",
    background: asset?.background ?? null,
    portrait: asset?.portrait ?? "/images/sts2/npcs/neow.webp",
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

function characterKey(value: string) {
  return value.toUpperCase().split(".").pop() ?? "SILENT";
}

function bossAssetPath(key: string | null) {
  return key ? `/images/sts2/bosses/${key}.webp` : null;
}

function encounterMonsterAssetPath(modelId: string | null | undefined) {
  const key = normalizeModelKey(modelId);
  if (!key) return null;

  const normalized = key
    .replace(/_event_encounter$/, "")
    .replace(/_(weak|normal|elite|boss)$/, "");

  return normalized ? `/images/sts2/monsters-render/${normalized}.webp` : null;
}

function eventAssetPath(modelId: string | null | undefined) {
  const key = normalizeModelKey(modelId);
  return key ? `/images/sts2/events/${key}.webp` : null;
}

function restAssetPath(characterId: string) {
  return (
    CHARACTER_REST_ASSETS[characterKey(characterId)] ??
    "/images/sts2/characters/rest_silent.webp"
  );
}

function mapNodeVisual(
  type: ReplayMapPointType,
  act: ReplayActAnalysis,
  row: number,
) {
  const ancientAsset = getAncientAsset(act);
  const bossKeys = getBossKeys(act);
  const maxBossRow = Math.max(
    ...act.nodes.filter((node) => node.type === "boss").map((node) => node.row),
  );
  const secondBoss = bossKeys.length > 1 && row === maxBossRow;

  switch (type) {
    case "ancient":
      return {
        src: ancientAsset.node,
        fallbackSrc: ancientAsset.portrait,
        imageClass: "object-contain scale-[1.04]",
      };
    case "boss":
      return {
        src: bossAssetPath(secondBoss ? (bossKeys.at(-1) ?? bossKeys[0] ?? null) : (bossKeys[0] ?? null)),
        fallbackSrc: "/images/sts2/nav/stats_monsters.png",
        imageClass: "object-contain scale-[1.04]",
      };
    case "shop":
      return {
        src: "/images/sts2/npcs/merchant.webp",
        fallbackSrc: "/images/sts2/npcs/fake_merchant.webp",
        imageClass: "object-contain scale-[1.08]",
      };
    case "rest_site":
      return {
        src: "/images/sts2/events/unrest_site.webp",
        fallbackSrc: "/images/sts2/events/unrest_site.webp",
        imageClass: "object-contain scale-[1.02]",
      };
    case "treasure":
      return {
        src: "/images/sts2/icons/chest_icon.webp",
        fallbackSrc: "/images/sts2/icons/chest_icon.webp",
        imageClass: "object-contain scale-[1.18]",
      };
    case "unknown":
      return {
        src: "/images/sts2/nav/question_mark.png",
        fallbackSrc: "/images/sts2/nav/question_mark.png",
        imageClass: "object-contain scale-[1.08]",
      };
    case "elite":
    case "monster":
    default:
      return {
        src: "/images/sts2/nav/stats_monsters.png",
        fallbackSrc: "/images/sts2/nav/stats_monsters.png",
        imageClass: "object-contain scale-[1.06]",
      };
  }
}

function stepVisual(
  entry: ReplayActAnalysis["history"][number],
  type: ReplayMapPointType,
  act: ReplayActAnalysis,
  characterId: string,
) {
  switch (type) {
    case "ancient": {
      const ancientAsset = getAncientAsset(act);
      return {
        src: ancientAsset.node,
        fallbackSrc: ancientAsset.portrait,
        imageClass: "object-contain scale-[1.05]",
      };
    }
    case "boss":
      return {
        src: bossAssetPath(normalizeModelKey(entry.rooms[0]?.model_id)),
        fallbackSrc: "/images/sts2/nav/stats_monsters.png",
        imageClass: "object-contain scale-[1.04]",
      };
    case "shop":
      return {
        src: "/images/sts2/npcs/merchant.webp",
        fallbackSrc: "/images/sts2/npcs/fake_merchant.webp",
        imageClass: "object-contain scale-[1.08]",
      };
    case "rest_site":
      return {
        src: restAssetPath(characterId),
        fallbackSrc: "/images/sts2/events/unrest_site.webp",
        imageClass: "object-contain scale-[1.08]",
      };
    case "treasure":
      return {
        src: "/images/sts2/icons/chest_icon.webp",
        fallbackSrc: "/images/sts2/icons/chest_icon.webp",
        imageClass: "object-contain scale-[1.18]",
      };
    case "unknown":
      return {
        src: eventAssetPath(entry.rooms[0]?.model_id),
        fallbackSrc: "/images/sts2/nav/question_mark.png",
        imageClass: "object-cover",
      };
    case "elite":
    case "monster":
    default:
      return {
        src: encounterMonsterAssetPath(entry.rooms[0]?.model_id),
        fallbackSrc: "/images/sts2/nav/stats_monsters.png",
        imageClass: "object-contain scale-[1.04]",
      };
  }
}

function shellClasses(type: ReplayMapPointType, state: "inactive" | "active" | "current") {
  const meta = NODE_META[type];
  return {
    shell:
      state === "current"
        ? meta.currentShell
        : state === "active"
          ? meta.activeShell
          : meta.baseShell,
    glow:
      state === "current"
        ? meta.currentGlow
        : state === "active"
          ? meta.activeGlow
          : meta.baseGlow,
  };
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
  const visual = mapNodeVisual(node.type, act, node.row);
  const palette = shellClasses(node.type, state);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      <div className={`absolute inset-0 rounded-[1.7rem] blur-md ${palette.glow}`} />
      <div className={`absolute inset-0 rounded-[1.7rem] border backdrop-blur-[2px] ${palette.shell}`} />
      <div className="absolute inset-[2px] rounded-[1.6rem] bg-zinc-950/78" />
      <div className="absolute inset-[10%]">
        <AssetThumb
          src={visual.src}
          fallbackSrc={visual.fallbackSrc}
          alt={NODE_META[node.type].label}
          className={visual.imageClass}
        />
      </div>
    </div>
  );
}

function StepAsset({
  entry,
  type,
  act,
  characterId,
  current,
  size,
}: {
  entry: ReplayActAnalysis["history"][number];
  type: ReplayMapPointType;
  act: ReplayActAnalysis;
  characterId: string;
  current: boolean;
  size: "list" | "hero";
}) {
  const visual = stepVisual(entry, type, act, characterId);
  const idlePalette = shellClasses(type, current ? "current" : "inactive");
  const boxSize = size === "hero" ? 76 : 44;

  return (
    <div
      className="relative shrink-0"
      style={{ width: boxSize, height: boxSize }}
    >
      <div className={`absolute inset-0 rounded-[1.45rem] blur-md ${idlePalette.glow}`} />
      <div className={`absolute inset-0 rounded-[1.45rem] border ${idlePalette.shell}`} />
      <div className="absolute inset-[2px] rounded-[1.35rem] bg-zinc-950/82" />
      <div className="absolute inset-[12%] overflow-hidden rounded-[1.15rem]">
        <AssetThumb
          src={visual.src}
          fallbackSrc={visual.fallbackSrc}
          alt={NODE_META[type].label}
          className={visual.imageClass}
        />
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
  const [failed, setFailed] = useState(false);
  const resolvedSrc = failed ? fallbackSrc ?? src : src ?? fallbackSrc;

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
        if (!failed && fallbackSrc && resolvedSrc !== fallbackSrc) {
          setFailed(true);
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
