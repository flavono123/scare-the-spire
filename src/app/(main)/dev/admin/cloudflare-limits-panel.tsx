import "server-only";

import {
  CLOUDFLARE_FREE_LIMITS as L,
  readCloudflareLimits,
  type WorkerDeployStats,
} from "../../../../../scripts/lib/cloudflare-limits";

const n = (value: number) => value.toLocaleString("ko-KR");
const kst = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

function tone(used: number, warnAt: number, stopAt: number) {
  if (used >= stopAt) return { bar: "bg-red-500", text: "text-red-300" };
  if (used >= warnAt) return { bar: "bg-amber-400", text: "text-amber-300" };
  return { bar: "bg-emerald-500", text: "text-emerald-300" };
}

function Meter({
  label,
  used,
  limit,
  budget,
  unit = "",
  detail,
}: {
  label: string;
  used: number;
  limit: number;
  /** Our own stop line below the platform limit (cf:assets fails past it). */
  budget?: number;
  unit?: string;
  detail?: string;
}) {
  const t = tone(used, budget ?? limit * 0.8, budget ?? limit * 0.95);
  const ratio = Math.min(1, used / limit);
  return (
    <div className="rounded-md border border-border bg-card/40 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${t.text}`}>{((used / limit) * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">
        {n(used)}{unit} <span className="text-sm font-normal text-muted-foreground">/ {n(limit)}{unit}</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label} ${n(used)} / ${n(limit)}`}>
        <div className={`h-full ${t.bar}`} style={{ width: `${ratio * 100}%` }} />
        {budget !== undefined && (
          <div className="absolute inset-y-0 w-px bg-foreground/80" style={{ left: `${(budget / limit) * 100}%` }} />
        )}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        남은 {n(limit - used)}{unit}
        {budget !== undefined && ` · 예산(${n(budget)})까지 ${n(budget - used)}`}
        {detail && ` · ${detail}`}
      </div>
    </div>
  );
}

function DeploySource({ stats }: { stats: WorkerDeployStats }) {
  const live = stats.versionId === stats.liveVersionId;
  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      <code>{stats.worker}</code> · 배포{" "}
      <a href={stats.run.url} target="_blank" rel="noreferrer" className="sts-text-aqua underline-offset-4 hover:underline">
        {kst(stats.run.createdAt)} {stats.run.sha.slice(0, 8)}
      </a>{" "}
      · 버전 <code>{stats.versionId?.slice(0, 8)}</code>{" "}
      {live ? (
        <span className="text-emerald-300">운영 중</span>
      ) : (
        <span className="text-red-300">운영 버전과 다름 (운영 {stats.liveVersionId?.slice(0, 8) ?? "?"}) — CI 밖 배포·롤백 확인</span>
      )}
    </p>
  );
}

/** What one addition costs in main Worker static files (docs/CLOUDFLARE_LIMITS.md). */
const UNIT_COSTS = [
  ["STS1·STS2 백과사전 상세 항목 1개", "4 + 이미지", "ko·en × HTML·RSC. 게임 전용 로케일(zh, ja…)은 상세를 복사하지 않음"],
  ["백과사전 목록(분류) 1개", "28", "로케일 접두 14개(기본 + 13) × HTML·RSC"],
  ["서비스 라우트 1개 (/foo)", "28", "로케일 14 × HTML·RSC"],
  ["서비스 상세 shell 1개 (/foo/__id__)", "28", "로케일 14 × HTML·RSC"],
  ["짜퍼 새 게임 탭 1개 (/vexing-puzzlebox/foo)", "28 + 이미지", "탭이 라우트라 로케일 14 × HTML·RSC (STATIC_EXACT_SERVICE_PAGES)"],
  ["짜퍼 기존 게임에 문항 추가", "이미지 수", "페이지는 그대로, 새 그림·데이터 파일만"],
  ["public/ 이미지·JSON 1개", "1", "제외 목록(cloudflare-asset-excludes.mjs)·patch Worker 경로는 0"],
] as const;

export async function CloudflareLimitsPanel() {
  const report = await readCloudflareLimits();
  const { main, patch } = report.workers;
  const assets = report.staticAssets;
  const mainFiles = main?.assetFiles ?? assets?.used ?? null;
  const budget = assets?.budget ?? L.staticAssetFilesPerVersion - 500;
  const todayRequests = report.today
    ? Object.values(report.today.requestsByScript).reduce((sum, value) => sum + value, 0)
    : null;
  const d1Today = report.today ? Object.values(report.today.d1ByDatabase) : [];
  const groups = Object.entries(assets?.groups ?? {});
  const topLevel = new Map<string, number>();
  for (const [group, count] of groups) {
    const key = group.split("/").slice(0, group.startsWith("_cf_static_pages") ? 2 : 1).join("/");
    topLevel.set(key, (topLevel.get(key) ?? 0) + count);
  }

  return (
    <div className="mt-6 space-y-8">
      <p className="text-xs text-muted-foreground">
        기준: 운영. 정적 애셋·워커 크기는 운영 배포 GitHub Actions 로그(wrangler 업로드 manifest), 나머지는 Cloudflare API.
        Workers Free 한도. 일일 한도는 00:00 UTC(09:00 KST)에 초기화. 조회 {kst(report.generatedAt)} · CLI{" "}
        <code>pnpm cf:limits</code> · 설명 <code>docs/CLOUDFLARE_LIMITS.md</code>
      </p>
      {report.errors.map((error) => (
        <p key={error} className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          조회 실패: {error}
        </p>
      ))}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-primary">정적 애셋 파일 수 (버전당 20,000)</h2>
        {mainFiles !== null ? (
          <>
            <Meter
              label="main Worker"
              used={mainFiles}
              limit={L.staticAssetFilesPerVersion}
              budget={budget}
              detail="세로선 = cf:assets 예산(넘으면 빌드 실패, 예비 500은 급한 패치 몫)"
            />
            {main && <DeploySource stats={main} />}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">main 배포 기록을 찾지 못했습니다.</p>
        )}
        {patch?.assetFiles != null && (
          <div className="mt-4">
            <Meter label="patch Worker (패치노트, 니오우스레터 이미지)" used={patch.assetFiles} limit={L.staticAssetFilesPerVersion} />
            <DeploySource stats={patch} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-primary">추가 1건당 main 파일 비용</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">추가하는 것</th><th className="px-3 py-2">파일</th><th className="px-3 py-2">근거</th></tr>
            </thead>
            <tbody>
              {UNIT_COSTS.map(([what, cost, why]) => (
                <tr key={what} className="border-t border-border/70">
                  <td className="px-3 py-2">{what}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{cost}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mainFiles !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            예산까지 남은 {n(budget - mainFiles)}개 = 상세 항목(이미지 1장 포함, 5개) 약 {n(Math.floor((budget - mainFiles) / 5))}개
            또는 라우트 약 {n(Math.floor((budget - mainFiles) / 28))}개.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-primary">main 정적 애셋 분포</h2>
        {groups.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              ["상위 경로", [...topLevel].sort((a, b) => b[1] - a[1])],
              ["세부 경로 (상위 25)", groups.slice(0, 25)],
            ].map(([title, rows]) => (
              <div key={title as string} className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2">{title as string}</th><th className="px-3 py-2 text-right">파일</th></tr>
                  </thead>
                  <tbody>
                    {(rows as [string, number][]).map(([path, count]) => (
                      <tr key={path} className="border-t border-border/70">
                        <td className="px-3 py-1.5"><code className="text-xs">{path}</code></td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{n(count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            분포는 이 기능이 들어간 다음 운영 배포부터 로그에 남습니다. 지금 분포는 로컬 <code>pnpm cf:build</code> 출력의
            <code> Cloudflare static asset groups</code> 줄을 보세요.
          </p>
        )}
        {assets?.largestPath && (
          <p className="mt-2 text-xs text-muted-foreground">
            가장 큰 파일 {assets.largestMiB} MiB / 25 MiB · <code>{assets.largestPath}</code>
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-primary">그 밖의 Free 한도</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {main?.gzipKiB != null && (
            <Meter label="main Worker 코드 (gzip)" used={Math.round(main.gzipKiB)} limit={L.workerGzipKiB} budget={256} unit=" KiB" />
          )}
          {todayRequests !== null && (
            <Meter
              label="오늘 Worker 요청 (계정 전체)"
              used={todayRequests}
              limit={L.requestsPerDay}
              detail={Object.entries(report.today!.requestsByScript).map(([name, count]) => `${name} ${n(count)}`).join(", ")}
            />
          )}
          {report.today && (
            <>
              <Meter label="오늘 D1 읽은 행" used={d1Today.reduce((s, v) => s + v.rowsRead, 0)} limit={L.d1RowsReadPerDay} />
              <Meter label="오늘 D1 쓴 행" used={d1Today.reduce((s, v) => s + v.rowsWritten, 0)} limit={L.d1RowsWrittenPerDay} />
            </>
          )}
          {report.d1?.map((db) => (
            <Meter key={db.id} label={`D1 ${db.name} 용량`} used={Math.round(db.bytes / 1e6)} limit={L.d1BytesPerDatabase / 1e6} unit=" MB" />
          ))}
        </div>
      </section>
    </div>
  );
}
