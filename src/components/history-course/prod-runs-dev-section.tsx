"use client";

import { ExternalLink, Loader2, Play, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRun } from "@/lib/run-store";
import { getSiteOrigin } from "@/lib/site-origin";
import { cn } from "@/lib/utils";

interface ProdRunSummary {
  id: string;
  seed: string;
  build: string;
  character: string;
  ascension: number;
  win: boolean;
  start_time: number | null;
  run_time: number | null;
  acts_count: number;
  total_floors: number;
  created_at: string;
}

interface ProdRunListResponse {
  runs?: ProdRunSummary[];
  count?: number;
  message?: string;
}

interface ProdRunDetailResponse {
  run?: ProdRunSummary & { raw: string };
  message?: string;
}

const PRODUCTION_SITE_ORIGIN = getSiteOrigin();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function ProdRunsDevSection() {
  const isDev = process.env.NODE_ENV === "development";
  const router = useRouter();
  const [runs, setRuns] = useState<ProdRunSummary[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isDev) return;

    let cancelled = false;
    setError(null);
    setRuns(null);

    fetch("/api/dev/history-course-runs", { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json()) as ProdRunListResponse;
        if (!res.ok) throw new Error(payload.message ?? "prod 런 목록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setRuns(payload.runs ?? []);
        setCount(payload.count ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setRuns([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isDev, refreshKey]);

  const filteredRuns = useMemo(() => {
    const q = normalized(query);
    if (!runs || !q) return runs ?? [];
    return runs.filter((run) =>
      [
        run.id,
        run.seed,
        run.build,
        run.character,
        run.win ? "victory 승리" : "loss 패배",
        `a${run.ascension}`,
      ].some((value) => normalized(value).includes(q)),
    );
  }, [query, runs]);

  const openLocalRun = async (runId: string) => {
    setPendingRunId(runId);
    setError(null);

    try {
      const res = await fetch(`/api/dev/history-course-runs/${runId}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as ProdRunDetailResponse;
      if (!res.ok || !payload.run) {
        throw new Error(payload.message ?? "prod 런을 불러오지 못했습니다.");
      }

      await saveRun({
        runId: payload.run.id,
        raw: payload.run.raw,
        origin: "donation-cache",
      });
      router.push(`/history-course/${payload.run.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setPendingRunId(null);
    }
  };

  if (!isDev) return null;

  const loadedCount = count ?? runs?.length ?? 0;
  const loading = runs === null;

  return (
    <section className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-yellow-400">DEV ONLY</div>
          <h2 className="mt-1 text-sm font-bold text-zinc-100">
            production 공유 런
            {!loading && (
              <span className="ml-2 font-medium text-zinc-500">
                ({loadedCount > 99 ? "99+" : loadedCount})
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            prod runid를 현재 로컬 dev의 역사 강의서 상세 화면으로 바로 엽니다.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80 sm:flex-row">
          <label className="relative block flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="runid, seed, build, character"
              className="min-h-9 w-full rounded-md border border-zinc-800 bg-black/30 py-2 pl-9 pr-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-400/70"
            />
          </label>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-black/20 px-2.5 text-xs font-semibold text-zinc-300 transition hover:border-yellow-400/60 hover:text-yellow-200"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="bg-black/30 text-zinc-500">
            <tr>
              <th className="px-3 py-2">공유일</th>
              <th className="px-3 py-2">결과</th>
              <th className="px-3 py-2">캐릭터</th>
              <th className="px-3 py-2">승천</th>
              <th className="px-3 py-2">층</th>
              <th className="px-3 py-2">시간</th>
              <th className="px-3 py-2">빌드</th>
              <th className="px-3 py-2">seed</th>
              <th className="px-3 py-2">runid</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={10}>
                  prod 런을 불러오는 중...
                </td>
              </tr>
            ) : filteredRuns.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={10}>
                  표시할 prod 런이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRuns.map((run) => {
                const pending = pendingRunId === run.id;
                return (
                  <tr key={run.id} className="border-t border-zinc-800/80">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {formatDate(run.created_at)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        run.win ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {run.win ? "승리" : "패배"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{run.character}</td>
                    <td className="px-3 py-2 text-zinc-300">A{run.ascension}</td>
                    <td className="px-3 py-2 text-zinc-300">{run.total_floors}</td>
                    <td className="px-3 py-2 text-zinc-300">{formatDuration(run.run_time)}</td>
                    <td className="px-3 py-2">
                      <code className="text-zinc-500">{run.build}</code>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-zinc-400">{run.seed}</code>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-zinc-300">{run.id}</code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          data-testid="prod-run-local-open"
                          data-run-id={run.id}
                          onClick={() => void openLocalRun(run.id)}
                          disabled={pending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-yellow-400 px-2.5 text-xs font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-60"
                        >
                          {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Play className="h-3.5 w-3.5" aria-hidden />
                          )}
                          로컬
                        </button>
                        <Link
                          href={`${PRODUCTION_SITE_ORIGIN}/history-course/${run.id}`}
                          prefetch={false}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-black/20 text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
                          title="production에서 열기"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
