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
const MAP_BOARD_PADDING_Y = 120;
const MAP_GAME_SCALE = 1;
const MAP_GAME_CANVAS_WIDTH = 2035;
const MAP_GAME_COLUMNS = 7;
const MAP_GAME_DIST_X = 1050 / MAP_GAME_COLUMNS;
const NORMAL_CONTROL_SIZE = 56;
const NORMAL_ICON_SIZE = 92;
const NORMAL_ICON_OVERFLOW = (NORMAL_ICON_SIZE - NORMAL_CONTROL_SIZE) / 2;
const ANCIENT_CONTROL_SIZE = 208;
const BOSS_CONTROL_WIDTH = 374;
const BOSS_CONTROL_HEIGHT = 306;
const MAP_SELECTION_RING_COLOR = "#241F1A";
const MAP_BOSS_UNTRAVELED_COLOR = "rgba(125, 106, 85, 0.85)";
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

const BUILTIN_RUN: StoredRun = {
  id: "__builtin_sample",
  label: "내장 샘플 (PH19VCZ8LG · A10)",
  run: SAMPLE_RUN,
  kind: "preset",
};

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
  const [storedRuns, setStoredRuns] = useState<StoredRun[]>([BUILTIN_RUN]);
  const [activeId, setActiveId] = useState<string>(BUILTIN_RUN.id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  useEffect(() => {
    let cancelled = false;
    const persistedUser = readStoredRuns().filter((entry) => entry.kind === "user");
    loadFixturePresets().then((presets) => {
      if (cancelled) return;
      const presetEntries = presets.length > 0 ? presets : [];
      setStoredRuns([BUILTIN_RUN, ...presetEntries, ...persistedUser]);
    });
    const activePersisted = readActiveRunId();
    if (activePersisted) {
      setActiveId(activePersisted);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistable = storedRuns.filter((entry) => entry.kind === "user");
    try {
      window.localStorage.setItem(STORED_RUNS_KEY, JSON.stringify(persistable));
      window.localStorage.setItem(STORED_ACTIVE_KEY, activeId);
    } catch {
      // ignore quota
    }
  }, [storedRuns, activeId]);

  const activeEntry = storedRuns.find((entry) => entry.id === activeId) ?? BUILTIN_RUN;
  const run = activeEntry.run;
  const sourceLabel = activeEntry.label;
  const analysis = analyzeReplayRun(run);
  const exactActs = analysis.acts.filter((act) => act.exactReplay).length;
  const fallbackActs = analysis.acts.filter((act) => act.fallbackUsed).length;

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
      setStoredRuns((prev) => prev.filter((entry) => entry.id !== id));
      setActiveId((prevId) => (prevId === id ? BUILTIN_RUN.id : prevId));
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
            <button
              type="button"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              onClick={() => {
                setError(null);
                setActiveId(BUILTIN_RUN.id);
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
              label="Replay"
              value={
                exactActs === analysis.acts.length
                  ? `Exact ${exactActs}/${analysis.acts.length}`
                  : fallbackActs > 0
                    ? `Fallback ${fallbackActs}막`
                    : `Exact ${exactActs}/${analysis.acts.length}`
              }
              tone={
                exactActs === analysis.acts.length
                  ? "green"
                  : fallbackActs > 0
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
          <ActReplayCard key={`${activeEntry.id}-${act.actId}-${act.actIndex}`} act={act} />
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-zinc-50">{act.actLabel}</h2>
            <StatusBadge tone={statusTone}>
              {act.matchedPathCount === 0
                ? "Zero Match"
                : act.exactReplay
                  ? "Exact Replay"
                  : `${act.matchedPathCount}${act.matchedPathCountCapped ? "+" : ""} candidates`}
            </StatusBadge>
            {act.fallbackUsed && (
              <StatusBadge tone="amber">Fallback path</StatusBadge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {act.actId} · floor {act.baseFloor}-{act.baseFloor + act.history.length - 1}
            {act.fallbackUsed && (
              <span className="ml-2 text-xs text-amber-300">
                · 시드 매칭이 실패해 히스토리 row별 best-guess 노드를 보여주는 중
              </span>
            )}
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

      <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Seeded Map
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              step {step}/{act.history.length} · {currentEntry ? formatRoomSummary(currentEntry) : "N/A"}
            </p>
          </div>
          <input
            type="range"
            min={1}
            max={act.history.length}
            value={step}
            className="w-full max-w-md accent-amber-300"
            onChange={(event) => {
              setPlaying(false);
              setStep(Number(event.target.value));
            }}
          />
        </div>

        <SeededMapView act={act} step={step} />

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
          {currentEntry && (
            <StepAsset
              entry={currentEntry}
              type={currentType}
              act={act}
              current
              size="list"
            />
          )}
          <span className="font-medium text-zinc-100">
            {currentEntry ? NODE_META[currentType].label : "미확인"}
          </span>
          <span className="text-zinc-500">
            floor {act.baseFloor + step - 1}
          </span>
          <span className="text-zinc-500">
            후보 노드 {act.candidateNodeIdsByStep[step - 1]?.length ?? 0}개
          </span>
        </div>
      </div>
    </section>
  );
}

function SeededMapView({ act, step }: { act: ReplayActAnalysis; step: number }) {
  const meta = actMapMeta(act.actId);
  const nodeMap = new Map(act.nodes.map((node) => [node.id, node]));
  const layout = buildMapLayout(act);
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

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{
                left: position.left,
                top: position.top,
                transform: `translate(-50%, -50%) scale(${current ? 1.08 : active ? 1 : 0.95
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
  const minLeft = Math.min(...boxes.map(({ box }) => box.left));
  const maxRight = Math.max(...boxes.map(({ box }) => box.left + box.width));
  const contentMidlineX = (minLeft + maxRight) / 2;
  const width = Math.ceil(MAP_GAME_CANVAS_WIDTH * MAP_GAME_SCALE);

  const toBoardPoint = (point: MapPoint): MapPoint => ({
    left: width / 2 + (point.left - contentMidlineX) * MAP_GAME_SCALE,
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
  size: RenderSize;
}) {
  if (node.type === "ancient") {
    const ancientAsset = getAncientAsset(act);
    return (
      <AncientMapAsset
        actId={act.actId}
        state={state}
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
    if (!bossAsset) return null;
    return (
      <BossMapAsset
        actId={act.actId}
        state={state}
        size={size}
        src={bossAsset.node}
        outlineSrc={bossAsset.outline}
        alt={NODE_META[node.type].label}
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
        state={state}
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
        state={state}
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
  state,
  size,
  src,
  outlineSrc,
  alt,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: RenderSize;
  src: string;
  outlineSrc: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);
  const iconColor = state === "inactive" ? MAP_BOSS_UNTRAVELED_COLOR : MAP_SELECTION_RING_COLOR;

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <MapSelectionRing state={state} inset="-12%" />
      <div className="absolute inset-0" style={maskStyle(outlineSrc, meta.bgColor, 1)}>
        <span className="sr-only">{alt}</span>
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.18 }}>
        <AssetThumb src={src} fallbackSrc={null} alt={alt} className="object-contain" />
      </div>
      <div className="absolute inset-0" style={maskStyle(src, iconColor, state === "inactive" ? 0.9 : 1)} />
    </div>
  );
}

function BossMapAsset({
  actId,
  state,
  size,
  src,
  outlineSrc,
  alt,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: RenderSize;
  src: string;
  outlineSrc: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);
  const iconColor = state === "inactive" ? MAP_BOSS_UNTRAVELED_COLOR : MAP_SELECTION_RING_COLOR;

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <MapSelectionRing state={state} inset="-12%" />
      <div className="absolute inset-0" style={maskStyle(outlineSrc, meta.bgColor, 1)}>
        <span className="sr-only">{alt}</span>
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.18 }}>
        <AssetThumb src={src} fallbackSrc={null} alt={alt} className="object-contain" />
      </div>
      <div className="absolute inset-0" style={maskStyle(src, iconColor, state === "inactive" ? 0.9 : 1)} />
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
