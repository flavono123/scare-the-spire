import Image from "@/components/ui/static-image";
import {
  getPageOgStatus,
  pageOgStatusLabel,
  type PageOgStatusRow,
} from "@/lib/page-og-status";

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300"
          : "rounded-full border border-red-400/35 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-300"
      }
    >
      {pageOgStatusLabel(ok)}
    </span>
  );
}

function OgImagePreview({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-zinc-700/70 bg-zinc-950 ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,0.12),transparent_55%)]" />
      <Image
        src={src}
        alt={alt}
        width={300}
        height={228}
        className="relative h-full w-full object-contain p-4"
      />
    </div>
  );
}

function RouteChips({ rows }: { rows: PageOgStatusRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((row) => (
        <span
          key={row.route}
          className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-300"
        >
          {row.route}
        </span>
      ))}
    </div>
  );
}

export default async function OgImagesDevPage() {
  const status = await getPageOgStatus();
  const groupedMappedRows = status.rules.map(({ rule, exists }) => ({
    rule,
    exists,
    rows: status.mappedRows.filter((row) => row.rule?.pattern === rule.pattern),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          페이지별 OG 이미지 매핑 현황
        </span>
      </div>

      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">OG 이미지 현황</h1>
          <p className="mt-1 text-sm text-zinc-400">
            라우트 매핑 규칙과 실제 페이지 적용 이미지를 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-lg font-bold text-zinc-50">{status.rows.length}</div>
            <div className="text-[11px] text-zinc-500">전체</div>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <div className="text-lg font-bold text-emerald-300">{status.mappedRows.length}</div>
            <div className="text-[11px] text-emerald-200/70">매핑</div>
          </div>
          <div className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2">
            <div className="text-lg font-bold text-zinc-200">{status.defaultRows.length}</div>
            <div className="text-[11px] text-zinc-500">기본</div>
          </div>
          <div className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2">
            <div className="text-lg font-bold text-red-300">{status.missingCount}</div>
            <div className="text-[11px] text-red-200/70">누락</div>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-300">매핑 규칙</h2>
          <span className="text-xs text-zinc-500">{status.rules.length} rules</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {groupedMappedRows.map(({ rule, exists, rows }) => (
            <article
              key={rule.pattern}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
            >
              <div className="flex items-start gap-4">
                <OgImagePreview
                  src={rule.image.url}
                  alt={rule.image.alt}
                  className="h-36 w-48 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-bold text-zinc-50">{rule.label}</h3>
                    <StatusBadge ok={exists} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-amber-200">{rule.pattern}</p>
                  <p className="mt-2 text-sm text-zinc-400">{rule.image.alt}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {rule.image.width} x {rule.image.height} · {rows.length} pages
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <RouteChips rows={rows} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-300">기본 이미지</h2>
          <span className="text-xs text-zinc-500">{status.defaultRows.length} pages</span>
        </div>
        <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div>
              <OgImagePreview
                src={status.defaultImage.url}
                alt={status.defaultImage.alt}
                className="aspect-[1000/760] w-full"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-200">{status.defaultImage.alt}</span>
                <StatusBadge ok={status.defaultExists} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {status.defaultImage.width} x {status.defaultImage.height}
              </p>
            </div>
            <RouteChips rows={status.defaultRows} />
          </div>
        </article>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-300">페이지별 적용</h2>
          <span className="text-xs text-zinc-500">{status.rows.length} pages</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {status.rows.map((row) => (
            <article
              key={row.route}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
            >
              <OgImagePreview
                src={row.image.url}
                alt={row.image.alt}
                className="aspect-[1000/760] w-full"
              />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-zinc-200">{row.route}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {row.rule?.label ?? "기본 이미지"}
                  </p>
                </div>
                <StatusBadge ok={row.exists} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
