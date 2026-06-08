"use client";

import { Check, Copy, ExternalLink, Loader2, Play, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRun } from "@/lib/run-store";
import { cn } from "@/lib/utils";

export interface ProdRunSummary {
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

interface ProdRunDetailResponse {
  run?: ProdRunSummary & { raw: string };
  message?: string;
}

interface Props {
  runs: ProdRunSummary[];
  count?: number;
  error?: string;
}

const PRODUCTION_SITE_ORIGIN = "https://scare-the-spire.vercel.app";

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

export default function HistoryCourseRunsDevPage({
  runs,
  count,
  error,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [manualRunId, setManualRunId] = useState("");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    const q = normalized(query);
    if (!q) return runs;
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
    const targetRunId = runId.trim();
    if (!targetRunId) return;
    setPendingRunId(targetRunId);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/dev/history-course-runs/${targetRunId}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as ProdRunDetailResponse;
      if (!res.ok || !payload.run) {
        throw new Error(payload.message ?? "prod run 조회에 실패했습니다.");
      }
      await saveRun({
        runId: payload.run.id,
        raw: payload.run.raw,
        origin: "donation-cache",
      });
      router.push(`/history-course/${payload.run.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusMessage(message);
    } finally {
      setPendingRunId(null);
    }
  };

  const copyRunId = async (runId: string) => {
    await navigator.clipboard.writeText(runId);
    setCopiedRunId(runId);
    window.setTimeout(() => {
      setCopiedRunId((current) => (current === runId ? null : current));
    }, 1400);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-yellow-400">DEV ONLY</span>
            <h1 className="mt-1 text-2xl font-bold text-zinc-50">
              역사 강의서 prod run 테스트
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              production에 공유된 runid를 로컬 IndexedDB에 캐시한 뒤 현재 dev 서버의 상세 화면에서 엽니다.
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>
              data: <code className="text-yellow-300">production</code>
            </div>
            <div>loaded: {(count ?? runs.length).toLocaleString("ko-KR")}</div>
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-md border border-border bg-card/40 p-4">
        <h2 className="text-sm font-semibold text-yellow-300">직접 열기</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void openLocalRun(manualRunId);
          }}
        >
          <input
            value={manualRunId}
            onChange={(event) => setManualRunId(event.target.value)}
            placeholder="prod runid"
            className="min-h-10 flex-1 rounded-md border border-border bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-400/70"
          />
          <button
            type="submit"
            disabled={!manualRunId.trim() || pendingRunId === manualRunId.trim()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingRunId === manualRunId.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            로컬에서 열기
          </button>
        </form>
        {statusMessage && (
          <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {statusMessage}
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-yellow-400">
              최근 production 공유 런
            </h2>
            {error && (
              <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                조회 실패: {error}
              </p>
            )}
          </div>
          <label className="relative block w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="runid, seed, build, character"
              className="min-h-10 w-full rounded-md border border-border bg-black/30 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-400/70"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
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
              {filteredRuns.map((run) => {
                const pending = pendingRunId === run.id;
                const copied = copiedRunId === run.id;
                return (
                  <tr key={run.id} className="border-t border-border/70">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
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
                    <td className="px-3 py-2">{run.character}</td>
                    <td className="px-3 py-2">A{run.ascension}</td>
                    <td className="px-3 py-2">{run.total_floors}</td>
                    <td className="px-3 py-2">{formatDuration(run.run_time)}</td>
                    <td className="px-3 py-2">
                      <code className="text-[11px] text-zinc-500">{run.build}</code>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-[11px] text-zinc-400">{run.seed}</code>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-[11px] text-zinc-300">{run.id}</code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
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
                        <button
                          type="button"
                          onClick={() => void copyRunId(run.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-black/20 text-zinc-300 transition hover:border-yellow-400/60 hover:text-yellow-200"
                          title="runid 복사"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                        <Link
                          href={`${PRODUCTION_SITE_ORIGIN}/history-course/${run.id}`}
                          prefetch={false}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-black/20 text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
                          title="production에서 열기"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRuns.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-zinc-500" colSpan={10}>
                    표시할 production 공유 런이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
