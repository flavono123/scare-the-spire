"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  analyzeReplayRun,
  parseReplayRun,
  type ReplayActAnalysis,
  type ReplayHistoryEntry,
  type ReplayMapPointType,
  type ReplayRun,
} from "@/lib/sts2-run-replay";
import { localize, localizeAny } from "@/lib/sts2-i18n";

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
    untraveledColor: "#574738",
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
    outline: string;
  }
> = {
  neow: {
    node: "/images/sts2/ancient-nodes/ancient_node_neow.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_neow_outline.webp",
  },
  orobas: {
    node: "/images/sts2/ancient-nodes/ancient_node_orobas.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_orobas_outline.webp",
  },
  nonupeipe: {
    node: "/images/sts2/ancient-nodes/ancient_node_nonupeipe.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_nonupeipe_outline.webp",
  },
  darv: {
    node: "/images/sts2/ancient-nodes/ancient_node_darv.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_darv_outline.webp",
  },
  pael: {
    node: "/images/sts2/ancient-nodes/ancient_node_pael.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_pael_outline.webp",
  },
  tanx: {
    node: "/images/sts2/ancient-nodes/ancient_node_tanx.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_tanx_outline.webp",
  },
  tezcatara: {
    node: "/images/sts2/ancient-nodes/ancient_node_tezcatara.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_tezcatara_outline.webp",
  },
  vakuu: {
    node: "/images/sts2/ancient-nodes/ancient_node_vakuu.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_vakuu_outline.webp",
  },
};

const FALLBACK_ACT_MAP_META = ACT_MAP_META["ACT.OVERGROWTH"];

const BOSS_ASSETS: Record<
  string,
  {
    node: string;
    outline: string;
  }
> = {
  ceremonial_beast: {
    node: "/images/sts2/boss-nodes/boss_node_ceremonial_beast.webp",
    outline: "/images/sts2/boss-nodes/boss_node_ceremonial_beast_outline.webp",
  },
  doormaker: {
    node: "/images/sts2/boss-nodes/boss_node_doormaker.webp",
    outline: "/images/sts2/boss-nodes/boss_node_doormaker_outline.webp",
  },
  kaiser_crab: {
    node: "/images/sts2/boss-nodes/boss_node_kaiser_crab.webp",
    outline: "/images/sts2/boss-nodes/boss_node_kaiser_crab_outline.webp",
  },
  knowledge_demon: {
    node: "/images/sts2/boss-nodes/boss_node_knowledge_demon.webp",
    outline: "/images/sts2/boss-nodes/boss_node_knowledge_demon_outline.webp",
  },
  lagavulin_matriarch: {
    node: "/images/sts2/boss-nodes/boss_node_lagavulin_matriarch.webp",
    outline: "/images/sts2/boss-nodes/boss_node_lagavulin_matriarch_outline.webp",
  },
  queen: {
    node: "/images/sts2/boss-nodes/boss_node_queen.webp",
    outline: "/images/sts2/boss-nodes/boss_node_queen_outline.webp",
  },
  soul_fysh: {
    node: "/images/sts2/boss-nodes/boss_node_soul_fysh.webp",
    outline: "/images/sts2/boss-nodes/boss_node_soul_fysh_outline.webp",
  },
  test_subject: {
    node: "/images/sts2/boss-nodes/boss_node_test_subject.webp",
    outline: "/images/sts2/boss-nodes/boss_node_test_subject_outline.webp",
  },
  the_insatiable: {
    node: "/images/sts2/boss-nodes/boss_node_the_insatiable.webp",
    outline: "/images/sts2/boss-nodes/boss_node_the_insatiable_outline.webp",
  },
  the_kin: {
    node: "/images/sts2/boss-nodes/boss_node_the_kin.webp",
    outline: "/images/sts2/boss-nodes/boss_node_the_kin_outline.webp",
  },
  vantom: {
    node: "/images/sts2/boss-nodes/boss_node_vantom.webp",
    outline: "/images/sts2/boss-nodes/boss_node_vantom_outline.webp",
  },
  waterfall_giant: {
    node: "/images/sts2/boss-nodes/boss_node_waterfall_giant.webp",
    outline: "/images/sts2/boss-nodes/boss_node_waterfall_giant_outline.webp",
  },
};
const MAP_BOARD_PADDING_Y = 220;
const MAP_GAME_SCALE = 0.6;
const MAP_GAME_VIEWPORT_WIDTH = 1920;
const MAP_GAME_COLUMNS = 7;
const MAP_GAME_DIST_X = 1050 / MAP_GAME_COLUMNS;
const NORMAL_CONTROL_SIZE = 56;
const NORMAL_ICON_SIZE = 92;
const NORMAL_ICON_OVERFLOW = (NORMAL_ICON_SIZE - NORMAL_CONTROL_SIZE) / 2;
const ANCIENT_CONTROL_SIZE = 208;
const BOSS_CONTROL_WIDTH = 374;
const BOSS_CONTROL_HEIGHT = 306;
const MAP_SELECTION_RING_COLOR = "#241F1A";
const MAP_ICON_NATIVE_SIZES: Record<string, { width: number; height: number }> = {
  map_monster: { width: 66, height: 68 },
  map_elite: { width: 89, height: 70 },
  map_rest: { width: 61, height: 90 },
  map_chest: { width: 84, height: 59 },
  map_shop: { width: 69, height: 72 },
  map_unknown: { width: 73, height: 72 },
  map_unknown_monster: { width: 66, height: 68 },
  map_unknown_elite: { width: 89, height: 70 },
  map_unknown_shop: { width: 69, height: 72 },
  map_unknown_chest: { width: 84, height: 59 },
};
const MAP_OUTLINE_NATIVE_SIZES: Record<string, { width: number; height: number }> = {
  map_monster_outline: { width: 72, height: 74 },
  map_elite_outline: { width: 95, height: 77 },
  map_rest_outline: { width: 73, height: 95 },
  map_chest_outline: { width: 88, height: 67 },
  map_shop_outline: { width: 74, height: 76 },
  map_unknown_outline: { width: 80, height: 78 },
  map_chest_boss_outline: { width: 96, height: 83 },
};
const MAP_BACKDROP_SEGMENTS = [
  { name: "top", top: 0, height: 32 },
  { name: "middle", top: 32, height: 36 },
  { name: "bottom", top: 68, height: 32 },
] as const;

type StoredRun = {
  id: string;
  label: string;
  run: ReplayRun;
  kind: "preset" | "user";
};

const STORED_RUNS_KEY = "sts2-replay-poc:stored-runs:v1";
const STORED_ACTIVE_KEY = "sts2-replay-poc:active-run:v1";
const FIXTURE_INDEX_URL = "/dev/run-fixtures/index.json";

type FixtureIndexEntry = {
  slug: string;
  label: string;
  seed: string;
  ascension: number;
  build: string;
  character: string;
};

async function loadFixturePresets(): Promise<StoredRun[]> {
  try {
    const indexRes = await fetch(FIXTURE_INDEX_URL, { cache: "no-cache" });
    if (!indexRes.ok) return [];
    const entries = (await indexRes.json()) as FixtureIndexEntry[];
    const results = await Promise.all(
      entries.map(async (entry): Promise<StoredRun | null> => {
        try {
          const res = await fetch(`/dev/run-fixtures/${entry.slug}.json`, { cache: "no-cache" });
          if (!res.ok) return null;
          const text = await res.text();
          const run = parseReplayRun(text);
          return {
            id: `__preset_${entry.slug}`,
            label: `${entry.label} · ${entry.seed}`,
            run,
            kind: "preset",
          };
        } catch {
          return null;
        }
      }),
    );
    return results.filter((item): item is StoredRun => item !== null);
  } catch {
    return [];
  }
}

function readStoredRuns(): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORED_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Partial<StoredRun> =>
          entry &&
          typeof entry.id === "string" &&
          typeof entry.label === "string" &&
          entry.run &&
          typeof entry.run === "object",
      )
      .map<StoredRun>((entry) => ({
        id: entry.id as string,
        label: entry.label as string,
        run: entry.run as ReplayRun,
        kind: entry.kind === "preset" ? "preset" : "user",
      }));
  } catch {
    return [];
  }
}

function readActiveRunId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORED_ACTIVE_KEY);
  } catch {
    return null;
  }
}

function describeRun(run: ReplayRun): string {
  const character = run.players[0]?.character?.split(".").pop() ?? "?";
  return `${run.seed} · A${run.ascension} · ${character}`;
}

export function RunReplayPoc() {
  const [storedRuns, setStoredRuns] = useState<StoredRun[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    () => readActiveRunId(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  useEffect(() => {
    let cancelled = false;
    const persistedUser = readStoredRuns().filter((entry) => entry.kind === "user");
    loadFixturePresets().then((presets) => {
      if (cancelled) return;
      const next = [...presets, ...persistedUser];
      setStoredRuns(next);
      setActiveId((prev) => {
        if (prev && next.some((entry) => entry.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistable = storedRuns.filter((entry) => entry.kind === "user");
    try {
      window.localStorage.setItem(STORED_RUNS_KEY, JSON.stringify(persistable));
      if (activeId) window.localStorage.setItem(STORED_ACTIVE_KEY, activeId);
    } catch {
      // ignore quota
    }
  }, [storedRuns, activeId]);

  const activeEntry =
    storedRuns.find((entry) => entry.id === activeId) ?? storedRuns[0] ?? null;
  if (!activeEntry) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-zinc-400">
        Fixture 로딩 중…
      </div>
    );
  }
  const run = activeEntry.run;
  const sourceLabel = activeEntry.label;
  const analysis = analyzeReplayRun(run);
  const exactActs = analysis.acts.filter((act) => act.exactReplay).length;
  const zeroMatchActs = analysis.acts.filter((act) => act.matchedPathCount === 0).length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming: StoredRun[] = [];
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const next = parseReplayRun(text);
        const baseLabel = file.name.replace(/\.(run|json)$/i, "");
        const id = `user_${baseLabel}-${next.seed}-${Math.random().toString(36).slice(2, 8)}`;
        incoming.push({ id, label: `${baseLabel} · ${describeRun(next)}`, run: next, kind: "user" });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "파싱 실패";
        failures.push(`${file.name}: ${message}`);
      }
    }
    if (incoming.length === 0) {
      setError(failures.join("\n"));
      return;
    }
    setError(failures.length > 0 ? failures.join("\n") : null);
    startTransition(() => {
      setStoredRuns((prev) => [...prev, ...incoming]);
      setActiveId(incoming[0].id);
    });
  }

  function handleRemove(id: string) {
    const target = storedRuns.find((entry) => entry.id === id);
    if (!target || target.kind === "preset") return;
    startTransition(() => {
      setStoredRuns((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        setActiveId((prevId) =>
          prevId === id ? next[0]?.id ?? null : prevId,
        );
        return next;
      });
    });
  }

  function handleRelabel(id: string, nextLabel: string) {
    setStoredRuns((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, label: nextLabel } : entry)),
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          `.run` 업로드 기반 seeded replay PoC · 여러 파일을 저장해두고 전환해서 볼 수 있음
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
            replay, 여러 개면 ambiguous, 하나도 없으면 fallback(단일 경로)로 시연합니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
            >
              `.run` 파일 추가 (여러 개 선택 가능)
            </label>
            <input
              id={inputId}
              type="file"
              accept=".run,.json"
              multiple
              className="sr-only"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="소스" value={sourceLabel} tone="amber" />
            <StatCard label="Seed" value={analysis.run.seed} tone="blue" />
            <StatCard label="승천" value={`A${analysis.run.ascension}`} tone="red" />
            <StatCard
              label="Replay"
              value={
                zeroMatchActs > 0
                  ? `Zero ${zeroMatchActs}막`
                  : `Exact ${exactActs}/${analysis.acts.length}`
              }
              tone={
                exactActs === analysis.acts.length
                  ? "green"
                  : zeroMatchActs > 0
                    ? "red"
                    : "amber"
              }
            />
          </div>

          {error && (
            <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/60 p-6">
          <h2 className="text-lg font-bold text-zinc-100">판독 규칙</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            <li>
              <span className="font-semibold text-emerald-300">Exact</span>: 시드 맵 위 히스토리
              타입 시퀀스가 단일 경로로 결정됨.
            </li>
            <li>
              <span className="font-semibold text-amber-300">Ambiguous</span>: 시드 맵은 재생성됐지만
              `.run`만으로는 여러 후보가 남음.
            </li>
            <li>
              <span className="font-semibold text-red-300">Zero Match</span>: 시드/밸런스/모디파이어
              차이로 매칭 실패. MVP에선 가장 그럴듯한 행별 노드로 <strong>fallback 경로</strong>를
              보여줍니다.
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

      <RunLibrary
        entries={storedRuns}
        activeId={activeEntry.id}
        onSelect={(id) => {
          setError(null);
          setActiveId(id);
        }}
        onRelabel={handleRelabel}
        onRemove={handleRemove}
      />

      <div className="mt-8 space-y-8">
        {analysis.acts.map((act) => (
          <ActReplayCard
            key={`${activeEntry.id}-${act.actId}-${act.actIndex}`}
            act={act}
            run={run}
          />
        ))}
      </div>

      {isPending && (
        <div className="mt-6 text-sm text-zinc-400">런 파일을 분석 중입니다…</div>
      )}
    </div>
  );
}

function RunLibrary({
  entries,
  activeId,
  onSelect,
  onRelabel,
  onRemove,
}: {
  entries: StoredRun[];
  activeId: string;
  onSelect: (id: string) => void;
  onRelabel: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-400">
          Run Library ({entries.length})
        </h2>
        <p className="text-xs text-zinc-500">
          업로드한 런은 브라우저 localStorage에 저장됩니다. 라벨을 클릭해서 메모를 붙여두세요.
        </p>
      </div>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <div
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                  active
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-100"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left"
                  onClick={() => onSelect(entry.id)}
                  title={entry.label}
                >
                  <span className="block truncate font-medium">{entry.label}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {describeRun(entry.run)} · {entry.run.map_point_history.length}막
                  </span>
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-500 transition hover:text-amber-300"
                  onClick={() => {
                    const next = window.prompt("라벨 수정", entry.label);
                    if (next && next.trim() !== "" && next !== entry.label) {
                      onRelabel(entry.id, next.trim());
                    }
                  }}
                >
                  라벨
                </button>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    entry.kind === "preset" ? "text-sky-300/80" : "text-emerald-300/80"
                  }`}
                >
                  {entry.kind === "preset" ? "preset" : "upload"}
                </span>
                {entry.kind === "user" && (
                  <button
                    type="button"
                    className="text-xs text-red-400/80 transition hover:text-red-300"
                    onClick={() => {
                      if (window.confirm("이 런을 라이브러리에서 제거할까요?")) {
                        onRemove(entry.id);
                      }
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// "Synthetic activity time" weight per step (in seconds). Combat scales with
// turns_taken; non-combat uses fixed estimates. Doesn't reflect wall-clock —
// AFK time is naturally absent because we never read run_time per node.
function stepActivitySeconds(entry: ReplayHistoryEntry): number {
  const room = entry.rooms[0];
  const roomType = (room?.room_type ?? "").toLowerCase();
  const turns = room?.turns_taken ?? 0;
  const t = entry.map_point_type;
  if (t === "monster" || roomType === "monster") return Math.max(1, turns) * 8;
  if (t === "elite" || roomType === "elite") return Math.max(1, turns) * 8;
  if (t === "boss") return Math.max(1, turns) * 10;
  if (t === "ancient") return 60;
  if (t === "shop" || roomType === "shop") return 45;
  if (t === "treasure" || roomType === "treasure") return 15;
  if (t === "rest_site" || roomType === "rest_site") return 25;
  if (roomType === "event") return 60;
  return 30;
}

const PLAYBACK_RATES = [1, 2, 4, 8, 16] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];

function ActReplayCard({ act, run }: { act: ReplayActAnalysis; run: ReplayRun }) {
  const [step, setStep] = useState(act.history.length);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(2);
  const currentEntry = act.history[Math.max(0, step - 1)] ?? null;
  const currentType = act.historyTypes[Math.max(0, step - 1)] ?? "monster";
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [mapBoxHeight, setMapBoxHeight] = useState<number | null>(null);

  // Cumulative synthetic seconds at end of each step (1-indexed; index 0 = 0s).
  const cumulativeActivitySeconds = useMemo(() => {
    const arr = [0];
    let sum = 0;
    for (const entry of act.history) {
      sum += stepActivitySeconds(entry);
      arr.push(sum);
    }
    return arr;
  }, [act.history]);
  const totalActivitySeconds = cumulativeActivitySeconds[cumulativeActivitySeconds.length - 1];

  useEffect(() => {
    const node = mapBoxRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMapBoxHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Variable-duration playback: delay between step N → N+1 is proportional
  // to the activity weight of step N+1 (the one we're advancing to). At
  // playbackRate × R, every R activity-seconds maps to ~50ms of replay; an
  // unbroken slow pace would feel "real time" near rate 1 but we keep a hard
  // floor so combat-heavy floors don't drag forever.
  useEffect(() => {
    if (!playing) return;
    const nextEntry = act.history[step];
    if (!nextEntry) return;
    const seconds = stepActivitySeconds(nextEntry);
    // baseline: 1x ≈ ~50ms per activity-second. cap min to keep UI legible.
    const ms = Math.max(120, Math.round((seconds * 50) / playbackRate));
    const timer = window.setTimeout(() => {
      setStep((prev) => Math.min(prev + 1, act.history.length));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [playing, step, playbackRate, act.history]);

  // Auto-stop when we hit the last step. setState in effect is intentional
  // here — we're synchronizing the playing flag with the derived end state.
  useEffect(() => {
    if (playing && step >= act.history.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
    }
  }, [playing, step, act.history.length]);

  const statusTone =
    act.matchedPathCount === 0 ? "red" : act.exactReplay ? "green" : "amber";

  return (
    <section className="rounded-3xl border border-border bg-card/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-zinc-50">{act.actLabel}</h2>
            <StatusBadge tone={statusTone}>
              {act.matchedPathCount === 0
                ? "Zero Match"
                : act.exactReplay
                  ? "Exact Replay"
                  : `${act.matchedPathCount}${act.matchedPathCountCapped ? "+" : ""} candidates`}
            </StatusBadge>
            {act.mapVariant !== "standard" && (
              <StatusBadge tone="amber">
                {act.mapVariant === "golden_path" ? "Golden Path" : "Spoils Hourglass"}
              </StatusBadge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {act.actId} · floor {act.baseFloor}-{act.baseFloor + act.history.length - 1}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-zinc-700 bg-zinc-950/60 text-xs">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={`px-2.5 py-1 transition ${
                  playbackRate === rate
                    ? "bg-amber-500/20 text-amber-100"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
                aria-pressed={playbackRate === rate}
              >
                {rate}×
              </button>
            ))}
          </div>
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

      <RunTopBar
        run={run}
        act={act}
        step={step}
        activitySeconds={cumulativeActivitySeconds[step] ?? 0}
        totalActivitySeconds={totalActivitySeconds}
      />

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          ref={mapBoxRef}
          className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4"
        >
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

        <div
          className="flex min-h-0 flex-col gap-3 xl:h-full"
          style={mapBoxHeight ? { maxHeight: mapBoxHeight } : undefined}
        >
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
                  {NODE_META[currentType].label}
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  floor {act.baseFloor + step - 1} · 후보 노드{" "}
                  {act.candidateNodeIdsByStep[step - 1]?.length ?? 0}개
                </p>
              </div>
            </div>
          </div>

          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {act.history.map((entry, index) => {
              const floor = act.baseFloor + index;
              const stepType = act.historyTypes[index];
              const meta = NODE_META[stepType];
              const current = index + 1 === step;

              return (
                <li key={`${act.actId}-${floor}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setStep(index + 1);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      current
                        ? "border-amber-300/60 bg-amber-500/10"
                        : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-600 hover:bg-zinc-900/50"
                    }`}
                    aria-current={current ? "step" : undefined}
                  >
                    <StepAsset
                      entry={entry}
                      type={stepType}
                      act={act}
                      current={current}
                      size="list"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Floor {floor}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function SeededMapView({
  act,
  step,
}: {
  act: ReplayActAnalysis;
  step: number;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const meta = actMapMeta(act.actId);
  const layout = useMemo(() => buildMapLayout(act), [act]);
  const nodeMap = useMemo(() => new Map(act.nodes.map((node) => [node.id, node])), [act]);
  const questMarkerNodes = useMemo(
    () =>
      new Set<string>([
        ...act.furCoatMarkerNodeIds,
        ...(act.spoilsMarkerNodeId ? [act.spoilsMarkerNodeId] : []),
      ]),
    [act],
  );
  const flightArrivalNodes = useMemo(
    () => new Set(act.flightArrivalNodeIds),
    [act],
  );
  const nodeStepIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < act.candidateNodeIdsByStep.length; i++) {
      for (const nodeId of act.candidateNodeIdsByStep[i] ?? []) {
        if (!map.has(nodeId)) map.set(nodeId, i);
      }
    }
    return map;
  }, [act]);

  const { activeNodes, currentNodes, activeEdges } = useMemo(() => {
    const active = new Set<string>();
    const edges = new Set<string>();
    for (let index = 0; index < step; index++) {
      for (const nodeId of act.candidateNodeIdsByStep[index] ?? []) active.add(nodeId);
      for (const edgeId of act.candidateEdgeIdsByStep[index] ?? []) edges.add(edgeId);
    }
    return {
      activeNodes: active,
      currentNodes: new Set(act.candidateNodeIdsByStep[step - 1] ?? []),
      activeEdges: edges,
    };
  }, [act, step]);

  return (
    <div className="overflow-x-auto overflow-y-visible">
      <div
        className="relative rounded-[2rem] border bg-[#120e0a]"
        style={{ height: layout.height, width: layout.width, borderColor: meta.border }}
      >
        <MapBackdrop actId={act.actId} />
        <div className="absolute inset-0 bg-black/18" />
        <div className="absolute inset-[18px] rounded-[1.55rem] border border-white/6" />
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{ width: layout.width }}
        >
        {act.edges.flatMap((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return [];
          const visited = activeEdges.has(edge.id);

          return buildPathTicks(edge.id, from, to, act, layout).map((tick, index) => (
            <div
              key={`${edge.id}-${index}`}
              className="absolute"
              style={{
                left: tick.left,
                top: tick.top,
                width: 16 * MAP_GAME_SCALE,
                height: 16 * MAP_GAME_SCALE,
                transform: `translate(-50%, -50%) rotate(${tick.rotation}rad) scale(${visited ? 1.2 : 1
                  })`,
                filter:
                  "drop-shadow(0 0 1.4px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 0.6px rgba(0, 0, 0, 0.5))",
                ...maskStyle(
                  effectSrc("map_dot"),
                  visited ? meta.traveledColor : meta.untraveledColor,
                  visited ? 1 : 1,
                ),
              }}
            />
          ));
        })}

        {act.nodes.map((node) => {
          const active = activeNodes.has(node.id);
          const current = currentNodes.has(node.id);
          const position = layout.centers.get(node.id);
          const state = current ? "current" : active ? "active" : "inactive";
          const size = mapNodeSize(node, act);
          if (!position) return null;
          const scale = current ? 1.08 : active ? 1 : 0.95;

          const showQuestMarker = questMarkerNodes.has(node.id);
          const showFlightMarker = flightArrivalNodes.has(node.id) && active;
          const stepIndex = nodeStepIndex.get(node.id);
          const visited = active && stepIndex != null;
          const revealEntry = visited ? act.history[stepIndex] : null;
          const isHovered = hoveredNodeId === node.id;

          return (
            <div
              key={node.id}
              className="absolute"
              data-node-id={node.id}
              data-node-current={current ? "true" : undefined}
              style={{
                left: position.left - size.width / 2,
                top: position.top - size.height / 2,
                width: size.width,
                height: size.height,
                zIndex: isHovered ? 30 : undefined,
              }}
              onMouseEnter={() => visited && setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
            >
              <div
                className="absolute inset-0 transition-transform duration-300"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center center",
                }}
              >
                <MapNodeAsset
                  node={node}
                  act={act}
                  state={state}
                  size={size}
                  revealEntry={revealEntry}
                />
              </div>
              {visited && revealEntry && isHovered && (
                <NodeTooltip
                  act={act}
                  stepIndex={stepIndex}
                  entry={revealEntry}
                />
              )}
              {showQuestMarker && (
                <Image
                  src="/images/sts2/map/icons/map_spoils_map_marker.png"
                  alt="quest marker"
                  width={36}
                  height={36}
                  unoptimized
                  className="pointer-events-none absolute"
                  style={{
                    right: "-22%",
                    top: "-32%",
                    width: Math.round(size.width * 0.55),
                    height: Math.round(size.width * 0.55),
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
                  }}
                />
              )}
              {showFlightMarker && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: "-26%",
                    top: "-32%",
                    width: Math.round(size.width * 0.5),
                    height: Math.round(size.width * 0.5),
                  }}
                  title="윙부츠로 점프"
                >
                  <div
                    className="absolute inset-0 rounded-full border border-sky-300/60 bg-sky-950/80"
                    style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }}
                  />
                  <Image
                    src="/images/sts2/relics/winged_boots.webp"
                    alt="윙부츠"
                    fill
                    sizes="32px"
                    unoptimized
                    className="rounded-full p-[10%]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

        <div className="absolute bottom-4 left-4 rounded-full border border-white/8 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
          아래에서 위로 등반
        </div>
      </div>
    </div>
  );
}

export function MapBackdrop({ actId }: { actId: string }) {
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

type MapBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type MapPoint = {
  left: number;
  top: number;
};

type MapLayout = {
  width: number;
  height: number;
  centers: Map<string, MapPoint>;
  endpoints: Map<string, MapPoint>;
};

type RenderSize = {
  width: number;
  height: number;
};

function hasSecondBoss(act: ReplayActAnalysis) {
  return act.nodes.filter((node) => node.type === "boss").length > 1;
}

function mapGameRowCount(act: ReplayActAnalysis) {
  return act.rowCount - (hasSecondBoss(act) ? 2 : 1);
}

function mapGameRowScale(act: ReplayActAnalysis) {
  return hasSecondBoss(act) ? 0.9 : 1;
}

function gameDistY(act: ReplayActAnalysis) {
  return (2325 / (mapGameRowCount(act) - 1)) * mapGameRowScale(act);
}

function gameControlBox(
  node: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
): MapBox {
  const rowScale = mapGameRowScale(act);

  if (node.type === "boss") {
    const bossNodes = act.nodes.filter((candidate) => candidate.type === "boss");
    const maxBossRow = Math.max(...bossNodes.map((candidate) => candidate.row));
    return {
      left: -200,
      top: node.row === maxBossRow && bossNodes.length > 1 ? -2280 * rowScale : -1980 * rowScale,
      width: BOSS_CONTROL_WIDTH,
      height: BOSS_CONTROL_HEIGHT,
    };
  }

  if (node.type === "ancient") {
    return {
      left: -80,
      top: 720,
      width: ANCIENT_CONTROL_SIZE,
      height: ANCIENT_CONTROL_SIZE,
    };
  }

  if (node.row === 0) {
    return {
      left: -80,
      top: 800,
      width: NORMAL_CONTROL_SIZE,
      height: NORMAL_CONTROL_SIZE,
    };
  }

  return {
    left: -500 + node.col * MAP_GAME_DIST_X + stableSigned(`${node.id}:x`, 21),
    top: 740 - node.row * gameDistY(act) + stableSigned(`${node.id}:y`, 25),
    width: NORMAL_CONTROL_SIZE,
    height: NORMAL_CONTROL_SIZE,
  };
}

function gameVisualBox(
  node: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
): MapBox {
  const control = gameControlBox(node, act);

  if (node.type === "boss") {
    return control;
  }

  if (node.type === "ancient") {
    return control;
  }

  return {
    left: control.left - NORMAL_ICON_OVERFLOW,
    top: control.top - NORMAL_ICON_OVERFLOW,
    width: NORMAL_ICON_SIZE,
    height: NORMAL_ICON_SIZE,
  };
}

function gameNodeCenter(
  node: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
): MapPoint {
  const box = gameVisualBox(node, act);
  return {
    left: box.left + box.width / 2,
    top: box.top + box.height / 2,
  };
}

function gamePathEndpoint(
  node: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
): MapPoint {
  const control = gameControlBox(node, act);
  return {
    left: control.left + control.width / 2,
    top: control.top + control.height / 2,
  };
}

function buildMapLayout(act: ReplayActAnalysis): MapLayout {
  const boxes = act.nodes.map((node) => ({
    node,
    box: gameVisualBox(node, act),
  }));
  const minTop = Math.min(...boxes.map(({ box }) => box.top));
  const maxBottom = Math.max(...boxes.map(({ box }) => box.top + box.height));
  const width = Math.ceil(MAP_GAME_VIEWPORT_WIDTH * MAP_GAME_SCALE);

  // Game anchors its map bg horizontally on viewport center (screen x = 960)
  // with node positions defined in game-origin coords (x=0 == bg center).
  // So we map game x=0 -> board width/2 without re-centering on content, matching
  // the game's "grid midline is ~22px left of bg center" layout.
  const toBoardPoint = (point: MapPoint): MapPoint => ({
    left: width / 2 + point.left * MAP_GAME_SCALE,
    top: MAP_BOARD_PADDING_Y + (point.top - minTop) * MAP_GAME_SCALE,
  });

  return {
    width,
    height: Math.ceil((maxBottom - minTop) * MAP_GAME_SCALE + MAP_BOARD_PADDING_Y * 2),
    centers: new Map(act.nodes.map((node) => [node.id, toBoardPoint(gameNodeCenter(node, act))])),
    endpoints: new Map(act.nodes.map((node) => [node.id, toBoardPoint(gamePathEndpoint(node, act))])),
  };
}

function mapNodeSize(
  node: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
): RenderSize {
  const box = node.type === "boss" ? gameControlBox(node, act) : gameVisualBox(node, act);
  return {
    width: Math.round(box.width * MAP_GAME_SCALE),
    height: Math.round(box.height * MAP_GAME_SCALE),
  };
}

function buildPathTicks(
  edgeId: string,
  from: ReplayActAnalysis["nodes"][number],
  to: ReplayActAnalysis["nodes"][number],
  act: ReplayActAnalysis,
  layout: MapLayout,
) {
  const startGame = gamePathEndpoint(from, act);
  const endGame = gamePathEndpoint(to, act);
  const dx = endGame.left - startGame.left;
  const dy = endGame.top - startGame.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const spacing = 22;
  const count = Math.floor(length / spacing) + 1;
  const unitX = length === 0 ? 0 : dx / length;
  const unitY = length === 0 ? 0 : dy / length;
  const baseRotation = Math.atan2(dy, dx) + Math.PI / 2;

  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => {
    const step = index + 1;
    const gamePoint = {
      left: startGame.left + unitX * spacing * step + stableSigned(`${edgeId}:${step}:x`, 3),
      top: startGame.top + unitY * spacing * step + stableSigned(`${edgeId}:${step}:y`, 3),
    };

    return {
      left:
        (layout.endpoints.get(from.id)?.left ?? 0) +
        ((gamePoint.left - startGame.left) * MAP_GAME_SCALE),
      top:
        (layout.endpoints.get(from.id)?.top ?? 0) +
        ((gamePoint.top - startGame.top) * MAP_GAME_SCALE),
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
    outline: asset?.outline ?? "/images/sts2/ancient-nodes/ancient_node_neow_outline.webp",
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

function getBossAsset(bossKey: string | null) {
  if (!bossKey) return null;
  const stripped = bossKey.replace(/_boss$/, "");
  return BOSS_ASSETS[stripped] ?? null;
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

function circleOpacity(state: "inactive" | "active" | "current") {
  if (state === "inactive") return 0;
  return state === "current" ? 1 : 0.92;
}

function scaleNativeSize(size: RenderSize): RenderSize {
  return {
    width: Math.round(size.width * MAP_GAME_SCALE),
    height: Math.round(size.height * MAP_GAME_SCALE),
  };
}

function mapIconRenderSize(iconName: string): RenderSize {
  return scaleNativeSize(MAP_ICON_NATIVE_SIZES[iconName] ?? { width: NORMAL_ICON_SIZE, height: NORMAL_ICON_SIZE });
}

function mapOutlineRenderSize(outlineName: string): RenderSize {
  return scaleNativeSize(MAP_OUTLINE_NATIVE_SIZES[outlineName] ?? { width: NORMAL_ICON_SIZE, height: NORMAL_ICON_SIZE });
}

function MapSelectionRing({
  state,
  inset,
}: {
  state: "inactive" | "active" | "current";
  inset: string;
}) {
  if (state === "inactive") {
    return null;
  }

  return (
    <div
      className="absolute"
      style={{
        inset,
        ...maskStyle(effectSrc("map_circle_4"), MAP_SELECTION_RING_COLOR, circleOpacity(state)),
      }}
    />
  );
}

function bossKeyForRow(act: ReplayActAnalysis, row: number) {
  const bossKeys = getBossKeys(act);
  const bossRows = act.nodes.filter((node) => node.type === "boss").map((node) => node.row);
  const maxBossRow = Math.max(...bossRows);
  // The map has two boss tiles only on the A10 final act. When the second
  // tile is present, its row is `maxBossRow`; for non-A10 acts there is only
  // one boss tile and its row also equals `maxBossRow`.
  const hasSecondBossTile = bossRows.length > 1;
  const isSecondBossRow = hasSecondBossTile && row === maxBossRow;

  if (isSecondBossRow) {
    // Prefer history; fall back to the UpFront-RNG prediction when the run
    // ended before the player reached the second boss.
    return bossKeys[1] ?? normalizePredictedKey(act.predictedSecondBoss);
  }
  return bossKeys[0] ?? normalizePredictedKey(act.predictedFirstBoss);
}

function normalizePredictedKey(value: string | null | undefined) {
  if (!value) return null;
  return value.toLowerCase();
}

function NodeTooltip({
  act,
  stepIndex,
  entry,
}: {
  act: ReplayActAnalysis;
  stepIndex: number;
  entry: ReplayHistoryEntry;
}) {
  const floor = act.baseFloor + stepIndex;
  const room = entry.rooms[0];
  const { typeLabel, nameLabel } = describeNodeForTooltip(entry);

  const turns = room?.turns_taken ?? 0;
  const damage = entry.damage_taken ?? 0;
  const healed = entry.hp_healed ?? 0;
  const maxGained = entry.max_hp_gained ?? 0;
  const maxLost = entry.max_hp_lost ?? 0;
  const goldGained = entry.gold_gained ?? 0;
  const goldSpent = entry.gold_spent ?? 0;
  const goldLost = entry.gold_lost ?? 0;
  const goldStolen = entry.gold_stolen ?? 0;

  // Rewards: cards gained + picked relics/potions + gold gained.
  const cardsGained = (entry.cards_gained ?? []).map((c) => c.id);
  const relicPicked = (entry.relic_choices ?? []).filter((c) => c.picked).map((c) => c.id);
  const potionPicked = (entry.potion_choices ?? []).filter((c) => c.picked).map((c) => c.id);

  // Skipped: card_choices not picked + relic_choices not picked + potion_choices not picked.
  const cardSkipped = (entry.card_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);
  const relicSkipped = (entry.relic_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);
  const potionSkipped = (entry.potion_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);

  const cardRemoved = (entry.cards_removed ?? entry.cards_lost ?? []).map((c) => c.id);

  const hasRewards =
    cardsGained.length > 0 ||
    relicPicked.length > 0 ||
    potionPicked.length > 0 ||
    goldGained > 0 ||
    cardRemoved.length > 0;
  const hasSkipped =
    cardSkipped.length > 0 || relicSkipped.length > 0 || potionSkipped.length > 0;

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: "100%",
        top: "50%",
        transform: "translate(8px, -50%)",
        width: 280,
      }}
    >
      <div
        style={{
          borderStyle: "solid",
          borderWidth: 24,
          borderImage:
            "url('/images/sts2/ui/hover_tip.png') 24 fill / 24px / 0 stretch",
          padding: "4px 8px",
          fontSize: 12,
          lineHeight: 1.45,
          color: "#e2e8f0",
          fontWeight: 500,
        }}
      >
        <div style={{ color: "#FFD479", fontWeight: 700 }}>{floor}층</div>
        <div className="flex flex-wrap gap-x-3">
          {typeof entry.current_hp === "number" && (
            <span style={{ color: "#FF7A7A" }}>
              {entry.current_hp}/{entry.max_hp ?? "—"} 체력
            </span>
          )}
          {typeof entry.current_gold === "number" && (
            <span style={{ color: "#FFD479" }}>{entry.current_gold}골드</span>
          )}
        </div>
        <div className="mt-1 text-zinc-100">
          {typeLabel}
          {nameLabel ? `: ${nameLabel}` : ""}
        </div>
        <ul className="ml-3 space-y-0.5">
          {damage > 0 && <li style={{ color: "#FF7A7A" }}>{damage} 피해</li>}
          {healed > 0 && <li style={{ color: "#86EFAC" }}>체력 {healed} 회복</li>}
          {maxGained > 0 && (
            <li style={{ color: "#86EFAC" }}>최대 체력 {maxGained} 획득</li>
          )}
          {maxLost > 0 && <li style={{ color: "#FF7A7A" }}>최대 체력 {maxLost} 손실</li>}
          {goldStolen > 0 && (
            <li style={{ color: "#FF7A7A" }}>{goldStolen} 골드 도난</li>
          )}
          {goldLost > 0 && goldStolen === 0 && (
            <li style={{ color: "#FF7A7A" }}>{goldLost} 골드 손실</li>
          )}
          {goldSpent > 0 && <li>{goldSpent} 골드 소모</li>}
          {turns > 0 && <li>{turns}턴</li>}
          {entry.map_point_type === "ancient" &&
            (entry.relic_choices ?? []).map((c) => (
              <li key={`ac-${c.id}`}>
                {localize("relics", c.id) ?? c.id}{" "}
                {c.picked ? "선택" : "건너뜀"}
              </li>
            ))}
        </ul>

        {hasRewards && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              보상:
            </div>
            <ul className="ml-3 space-y-0.5">
              {goldGained > 0 && <li>$ {goldGained} 골드</li>}
              {relicPicked.map((id) => (
                <li key={`r-${id}`}>⊡ {localize("relics", id) ?? id}</li>
              ))}
              {cardsGained.map((id, i) => (
                <li key={`cg-${id}-${i}`}>▤ {localize("cards", id) ?? id}</li>
              ))}
              {potionPicked.map((id) => (
                <li key={`p-${id}`}>⊓ {localize("potions", id) ?? id}</li>
              ))}
              {cardRemoved.map((id, i) => (
                <li key={`cr-${id}-${i}`}>✕ {localize("cards", id) ?? id} 제거</li>
              ))}
            </ul>
          </>
        )}

        {hasSkipped && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              건너뜀:
            </div>
            <ul className="ml-3 space-y-0.5">
              {cardSkipped.map((id, i) => (
                <li key={`cs-${id}-${i}`}>▤ {localize("cards", id) ?? id}</li>
              ))}
              {relicSkipped.map((id) => (
                <li key={`rs-${id}`}>⊡ {localize("relics", id) ?? id}</li>
              ))}
              {potionSkipped.map((id) => (
                <li key={`ps-${id}`}>⊓ {localize("potions", id) ?? id}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function describeNodeForTooltip(entry: ReplayHistoryEntry): {
  typeLabel: string;
  nameLabel: string | null;
} {
  const room = entry.rooms[0];
  const modelId = room?.model_id ?? null;
  const roomType = (room?.room_type ?? "").toLowerCase();
  const type = entry.map_point_type;

  const monsterName = () =>
    localizeAny(modelId, ["encounters"]) || null;

  if (type === "ancient") {
    return { typeLabel: "고대의 존재", nameLabel: localize("ancients", modelId) };
  }
  if (type === "boss") {
    return { typeLabel: "보스", nameLabel: monsterName() };
  }
  if (type === "elite") {
    return { typeLabel: "엘리트", nameLabel: monsterName() };
  }
  if (type === "monster") {
    return { typeLabel: "적", nameLabel: monsterName() };
  }
  if (type === "rest_site") {
    return { typeLabel: "휴식 장소", nameLabel: null };
  }
  if (type === "shop") {
    return { typeLabel: "상점", nameLabel: null };
  }
  if (type === "treasure") {
    return { typeLabel: "보물 방", nameLabel: null };
  }
  // unknown — reveal by room_type
  if (type === "unknown") {
    if (roomType === "event") {
      return { typeLabel: "이벤트", nameLabel: localize("events", modelId) };
    }
    if (roomType === "monster") {
      return { typeLabel: "적", nameLabel: monsterName() };
    }
    if (roomType === "shop") {
      return { typeLabel: "상점", nameLabel: null };
    }
    if (roomType === "treasure") {
      return { typeLabel: "보물 방", nameLabel: null };
    }
    if (roomType === "rest_site") {
      return { typeLabel: "휴식 장소", nameLabel: null };
    }
  }
  return { typeLabel: "?", nameLabel: null };
}

function MapNodeAsset({
  node,
  act,
  state,
  size,
  revealEntry,
}: {
  node: ReplayActAnalysis["nodes"][number];
  act: ReplayActAnalysis;
  state: "inactive" | "active" | "current";
  size: RenderSize;
  revealEntry?: ReplayHistoryEntry | null;
}) {
  if (node.type === "ancient") {
    const ancientAsset = getAncientAsset(act);
    return (
      <AncientMapAsset
        actId={act.actId}
        size={size}
        src={ancientAsset.node}
        outlineSrc={ancientAsset.outline}
        alt={NODE_META[node.type].label}
      />
    );
  }

  if (node.type === "boss") {
    const bossKey = bossKeyForRow(act, node.row);
    const bossAsset = getBossAsset(bossKey);
    if (!bossAsset) {
      // 보스 미도달 (early death) 인 막에선 history 에 boss 엔트리가 없음.
      // 게임 코드는 RunManager.GenerateRooms 의 UpFront RNG 흐름으로 보스를
      // 결정론적으로 고르지만 우리가 그 시뮬레이션을 아직 안 함 — placeholder
      // 에 act 의 가능한 보스 풀을 후보로 노출.
      return <UnknownBossPlaceholder size={size} pool={act.bossPool} />;
    }
    return (
      <BossMapAsset
        actId={act.actId}
        size={size}
        src={bossAsset.node}
        outlineSrc={bossAsset.outline}
        alt={NODE_META[node.type].label}
      />
    );
  }

  // Visited unknown nodes reveal their underlying type as in-game (monster?,
  // shop?, etc.). Pre-visit they remain just `?`.
  const useReveal =
    node.type === "unknown" && state !== "inactive" && revealEntry != null;
  const iconName = useReveal
    ? revealedUnknownIconName(revealEntry)
    : mapIconNameForType(node.type);
  const outlineName = useReveal
    ? revealedUnknownOutlineName(revealEntry)
    : mapOutlineNameForType(node.type);
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
  size: RenderSize;
  iconName: string;
  outlineName: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);
  const iconSize = mapIconRenderSize(iconName);
  const outlineSize = mapOutlineRenderSize(outlineName);

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <MapSelectionRing state={state} inset="-18%" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: outlineSize.width,
          height: outlineSize.height,
          ...maskStyle(mapOutlineSrc(outlineName), meta.bgColor, outlineOpacity(state)),
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: iconSize.width, height: iconSize.height, opacity: nodeOpacity(state) }}
      >
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
  const squareSize = { width: boxSize, height: boxSize };

  if (type === "ancient") {
    const ancientAsset = getAncientAsset(act);
    return (
      <AncientMapAsset
        actId={act.actId}
        size={squareSize}
        src={ancientAsset.node}
        outlineSrc={ancientAsset.outline}
        alt={NODE_META[type].label}
      />
    );
  }

  if (type === "boss") {
    const bossKey = normalizeModelKey(entry.rooms[0]?.model_id);
    const bossAsset = getBossAsset(bossKey);
    if (!bossAsset) return null;
    return (
      <BossMapAsset
        actId={act.actId}
        size={squareSize}
        src={bossAsset.node}
        outlineSrc={bossAsset.outline}
        alt={NODE_META[type].label}
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
      size={squareSize}
      iconName={iconName}
      outlineName={outlineName}
      alt={NODE_META[type].label}
    />
  );
}

function AncientMapAsset({
  actId,
  size,
  src,
  outlineSrc,
  alt,
}: {
  actId: string;
  size: RenderSize;
  src: string;
  outlineSrc: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <div className="absolute inset-0" style={maskStyle(outlineSrc, meta.bgColor, 1)}>
        <span className="sr-only">{alt}</span>
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.18 }}>
        <AssetThumb src={src} fallbackSrc={null} alt={alt} className="object-contain" />
      </div>
      <div className="absolute inset-0" style={maskStyle(src, MAP_SELECTION_RING_COLOR, 1)} />
    </div>
  );
}

function UnknownBossPlaceholder({
  size,
  pool,
}: {
  size: RenderSize;
  pool: string[];
}) {
  const candidateLabels = pool.map((id) => localize("encounters", id) ?? id);
  const tooltip =
    pool.length > 0
      ? `보스 미도달 — 가능한 후보: ${candidateLabels.join(", ")}`
      : "보스 미도달";
  // Show up to 3 candidate icons in a row. We use the existing boss
  // silhouette assets in dim mode.
  const iconSize = Math.round(size.height * 0.4);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-3xl border border-rose-500/30 bg-rose-950/40 flex flex-col items-center justify-center gap-1"
      style={{ width: size.width, height: size.height }}
      title={tooltip}
    >
      <div className="flex items-center gap-1">
        {pool.slice(0, 3).map((bossId) => {
          const key = normalizeModelKey(bossId)?.replace(/_boss$/, "") ?? "";
          const asset = BOSS_ASSETS[key];
          if (!asset) {
            return (
              <span
                key={bossId}
                className="text-rose-200/40 font-bold"
                style={{ fontSize: 12 }}
              >
                ?
              </span>
            );
          }
          return (
            <div
              key={bossId}
              className="relative"
              style={{ width: iconSize, height: iconSize, opacity: 0.5 }}
            >
              <Image
                src={asset.node}
                alt={candidateLabels[pool.indexOf(bossId)] ?? bossId}
                fill
                sizes="40px"
                unoptimized
                className="object-contain"
              />
            </div>
          );
        })}
      </div>
      <span
        className="text-rose-200/70 font-black"
        style={{ fontSize: Math.round(size.height * 0.18) }}
        aria-hidden
      >
        ?
      </span>
    </div>
  );
}

function BossMapAsset({
  actId,
  size,
  src,
  outlineSrc,
  alt,
}: {
  actId: string;
  size: RenderSize;
  src: string;
  outlineSrc: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <div className="absolute inset-0" style={maskStyle(outlineSrc, meta.bgColor, 1)}>
        <span className="sr-only">{alt}</span>
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.18 }}>
        <AssetThumb src={src} fallbackSrc={null} alt={alt} className="object-contain" />
      </div>
      <div className="absolute inset-0" style={maskStyle(src, MAP_SELECTION_RING_COLOR, 1)} />
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

const CHARACTER_PORTRAIT_SRC: Record<string, string> = {
  "CHARACTER.IRONCLAD": "/images/sts2/characters/char_select_ironclad.webp",
  "CHARACTER.SILENT": "/images/sts2/characters/char_select_silent.webp",
  "CHARACTER.DEFECT": "/images/sts2/characters/char_select_defect.webp",
  "CHARACTER.NECROBINDER": "/images/sts2/characters/char_select_necrobinder.webp",
  "CHARACTER.REGENT": "/images/sts2/characters/char_select_regent.webp",
};

const CHARACTER_LABEL: Record<string, string> = {
  "CHARACTER.IRONCLAD": "아이언클래드",
  "CHARACTER.SILENT": "사일런트",
  "CHARACTER.DEFECT": "디펙트",
  "CHARACTER.NECROBINDER": "네크로바인더",
  "CHARACTER.REGENT": "리젠트",
};

function relicIconSrc(relicId: string): string {
  const slug = relicId.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

function relicReadableName(relicId: string): string {
  return relicId.replace(/^RELIC\./, "").replace(/_/g, " ").toLowerCase();
}

function formatHms(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RunTopBar({
  run,
  act,
  step,
  activitySeconds,
  totalActivitySeconds,
}: {
  run: ReplayRun;
  act: ReplayActAnalysis;
  step: number;
  activitySeconds: number;
  totalActivitySeconds: number;
}) {
  const player = run.players[0];
  const character = player?.character ?? "CHARACTER.SILENT";
  const portraitSrc = CHARACTER_PORTRAIT_SRC[character];
  const characterLabel = CHARACTER_LABEL[character] ?? character.split(".").pop();
  const currentFloor = act.baseFloor + Math.max(0, step - 1);
  const currentEntry = act.history[Math.max(0, step - 1)] ?? null;

  // Walk history from floor 1 to currentFloor to backfill the most recent hp/gold
  // snapshot we have (some entries — boss, rest exits in older builds — can be
  // missing the stats).
  let hp: number | undefined;
  let maxHp: number | undefined;
  let gold: number | undefined;
  let floor = 1;
  for (const pastAct of run.map_point_history) {
    for (const entry of pastAct) {
      if (floor > currentFloor) break;
      if (typeof entry.current_hp === "number") hp = entry.current_hp;
      if (typeof entry.max_hp === "number") maxHp = entry.max_hp;
      if (typeof entry.current_gold === "number") gold = entry.current_gold;
      floor += 1;
    }
    if (floor > currentFloor) break;
  }

  const relicsByFloor = (player?.relics ?? [])
    .filter((relic) => typeof relic.id === "string")
    .map((relic) => ({
      id: relic.id!,
      floor: relic.floor_added_to_deck ?? 0,
    }))
    .filter((relic) => relic.floor > 0 && relic.floor <= currentFloor)
    .sort((a, b) => a.floor - b.floor);

  const hasWingedBoots = relicsByFloor.some((relic) =>
    relic.id.toUpperCase().endsWith("WINGED_BOOTS"),
  );
  const wingedBootsJustPicked =
    hasWingedBoots &&
    currentEntry != null &&
    relicsByFloor[relicsByFloor.length - 1]?.id.toUpperCase().endsWith("WINGED_BOOTS") &&
    relicsByFloor[relicsByFloor.length - 1]?.floor === currentFloor;

  // AFK suspicion: run_time vs synthetic active time. If recorded run is much
  // longer than the activity-weighted estimate, flag it.
  const recordedRunTime = run.run_time ?? 0;
  const afkRatio =
    totalActivitySeconds > 0 ? recordedRunTime / totalActivitySeconds : 0;
  const afkSuspect = afkRatio >= 1.8 && recordedRunTime > 0;

  return (
    <div className="mt-5 space-y-3 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black/80 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-black/40">
          {portraitSrc && (
            <Image
              src={portraitSrc}
              alt={characterLabel ?? character}
              fill
              sizes="56px"
              className="object-cover"
            />
          )}
          {run.ascension > 0 && (
            <span className="absolute -bottom-1 -right-1 rounded-full border border-red-500/60 bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-red-200">
              A{run.ascension}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-bold text-zinc-100">{characterLabel}</span>
            <span className="text-xs text-zinc-500">{run.seed}</span>
            <span className="text-xs text-zinc-500">· floor {currentFloor}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="text-red-400">♥</span>
              <span className="font-semibold text-zinc-100">
                {hp ?? "—"}
                <span className="text-zinc-500">/{maxHp ?? "—"}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="text-amber-300">◉</span>
              <span className="font-semibold text-zinc-100">{gold ?? "—"}</span>
            </span>
            {hasWingedBoots && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  wingedBootsJustPicked
                    ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                    : "border-sky-400/30 bg-sky-500/5 text-sky-300/80"
                }`}
                title="날개 부츠 활성 · 경로 제약 무시 가능"
              >
                Flight
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-amber-200">
          <span
            className="inline-flex items-center gap-1.5 text-base font-bold tabular-nums"
            title="활동 시간 추정 (전투 turns × 8s + 비전투 노드별 가중)"
          >
            <span aria-hidden>⏱</span>
            <span>{formatHms(activitySeconds)}</span>
          </span>
          {recordedRunTime > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                afkSuspect
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  : "border-zinc-700 bg-zinc-900/60 text-zinc-400"
              }`}
              title={
                afkSuspect
                  ? `기록 ${formatHms(recordedRunTime)} (AFK 의심: 활동 추정 ${formatHms(totalActivitySeconds)} 대비 ${afkRatio.toFixed(1)}배)`
                  : `기록 ${formatHms(recordedRunTime)}`
              }
            >
              {afkSuspect ? "AFK?" : "기록"} {formatHms(recordedRunTime)}
            </span>
          )}
        </div>
      </div>

      {relicsByFloor.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {relicsByFloor.map((relic) => {
            const acquired = relic.floor === currentFloor;
            return (
              <div
                key={`${relic.id}-${relic.floor}`}
                className={`relative h-10 w-10 overflow-hidden rounded-lg border transition ${
                  acquired
                    ? "border-amber-400/80 bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                    : "border-zinc-700 bg-zinc-900/60"
                }`}
                title={`${relicReadableName(relic.id)} · floor ${relic.floor}`}
              >
                <Image
                  src={relicIconSrc(relic.id)}
                  alt={relicReadableName(relic.id)}
                  fill
                  sizes="40px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">아직 획득한 유물 없음</p>
      )}
    </div>
  );
}
