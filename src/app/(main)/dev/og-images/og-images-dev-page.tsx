import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "@/components/ui/static-image";
import { devToolsEnabled } from "@/lib/dev-tools";
import {
  getOgFallbackAudit,
  writeOgFallbackDecision,
  type OgFallbackAudit,
  type OgFallbackGroup,
  type OgFallbackKind,
  type OgFallbackState,
} from "@/lib/og-fallback-audit";
import {
  getPageOgStatus,
  pageOgStatusLabel,
  type PageOgStatusRow,
} from "@/lib/page-og-status";

async function decideOgFallback(formData: FormData) {
  "use server";

  if (!devToolsEnabled()) throw new Error("Dev tools are disabled");
  const key = formData.get("key");
  const image = formData.get("image");
  const status = formData.get("status");
  if (typeof key !== "string" || !key.startsWith("/") || typeof image !== "string") {
    throw new Error("Invalid OG fallback decision");
  }
  if (status === "reset") {
    await writeOgFallbackDecision(key, null);
  } else if (status === "intended" || status === "undecided") {
    await writeOgFallbackDecision(key, { status, image, updatedAt: new Date().toISOString().slice(0, 10) });
  } else {
    throw new Error("Invalid OG fallback status");
  }
  revalidatePath("/dev/og-images");
  redirect("/dev/og-images#og-fallbacks");
}
import { getSiteOrigin } from "@/lib/site-origin";

const productionOrigin = getSiteOrigin();

type OgMetadataPreview = {
  inputPath: string;
  normalizedPath: string;
  fetchUrl?: string;
  status?: number;
  title?: string;
  description?: string;
  image?: string;
  imageDisplayUrl?: string;
  error?: string;
};

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([^\s=<>/"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    const normalized = body.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[normalized] ?? entity;
  });
}

function extractMetaContent(html: string, key: "name" | "property", value: string): string | undefined {
  const metaPattern = /<meta\s+[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[0]);
    if (attrs[key]?.toLowerCase() === value.toLowerCase() && attrs.content) {
      return decodeHtmlEntities(attrs.content.trim());
    }
  }

  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function normalizePreviewPath(inputPath: string): { path?: string; error?: string } {
  const trimmed = inputPath.trim();
  if (!trimmed) return { error: "상대경로를 입력하세요." };
  if (/^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(trimmed)) {
    return { error: "외부 URL이 아니라 로컬 상대경로만 입력할 수 있습니다." };
  }

  const withoutHash = trimmed.split("#", 1)[0] ?? "";
  const questionIndex = withoutHash.indexOf("?");
  const rawPath = questionIndex >= 0 ? withoutHash.slice(0, questionIndex) : withoutHash;
  const query = questionIndex >= 0 ? withoutHash.slice(questionIndex) : "";
  const pathWithLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const normalizedPath = pathWithLeadingSlash.replace(/\/+/g, "/").replace(/\/$/, "") || "/";

  if (normalizedPath === "/dev/og-images") {
    return { error: "OG 이미지 확인 페이지 자신은 미리보기 대상에서 제외합니다." };
  }

  return { path: `${normalizedPath}${query}` };
}

function requestOrigin(requestHeaders: Headers): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.split(",")[0]?.trim() || "localhost:3000";
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (/^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

function localDisplayImageUrl(imageUrl: string | undefined, origin: string): string | undefined {
  if (!imageUrl) return undefined;

  try {
    const url = new URL(imageUrl, origin);
    if (url.origin === origin || url.origin === productionOrigin) {
      return `${url.pathname}${url.search}`;
    }
    return url.href;
  } catch {
    return imageUrl;
  }
}

async function getOgMetadataPreview(inputPath: string | undefined): Promise<OgMetadataPreview | null> {
  if (!inputPath) return null;

  const normalized = normalizePreviewPath(inputPath);
  if (normalized.error || !normalized.path) {
    return {
      inputPath,
      normalizedPath: inputPath,
      error: normalized.error ?? "상대경로를 해석하지 못했습니다.",
    };
  }

  const origin = requestOrigin(await headers());
  const fetchUrl = new URL(normalized.path, origin);

  try {
    const response = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        accept: "text/html",
        "user-agent": "slseoun-og-dev-preview",
      },
    });

    if (!response.ok) {
      return {
        inputPath,
        normalizedPath: normalized.path,
        fetchUrl: fetchUrl.href,
        status: response.status,
        error: `페이지를 불러오지 못했습니다. HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const image =
      extractMetaContent(html, "property", "og:image") ??
      extractMetaContent(html, "name", "twitter:image");

    return {
      inputPath,
      normalizedPath: normalized.path,
      fetchUrl: fetchUrl.href,
      status: response.status,
      title:
        extractMetaContent(html, "property", "og:title") ??
        extractMetaContent(html, "name", "twitter:title") ??
        extractTitle(html),
      description:
        extractMetaContent(html, "property", "og:description") ??
        extractMetaContent(html, "name", "description") ??
        extractMetaContent(html, "name", "twitter:description"),
      image,
      imageDisplayUrl: localDisplayImageUrl(image, origin),
    };
  } catch (error) {
    return {
      inputPath,
      normalizedPath: normalized.path,
      fetchUrl: fetchUrl.href,
      error: error instanceof Error ? error.message : "페이지를 불러오지 못했습니다.",
    };
  }
}

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

function OgMetadataPreviewCard({ preview }: { preview: OgMetadataPreview }) {
  if (preview.error) {
    return (
      <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        <div className="font-semibold text-red-200">미리보기 실패</div>
        <p className="mt-1 text-red-100/80">{preview.error}</p>
        {preview.fetchUrl ? (
          <p className="mt-2 break-all font-mono text-xs text-red-100/60">{preview.fetchUrl}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 md:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        <OgImagePreview
          src={preview.imageDisplayUrl ?? preview.image ?? ""}
          alt={preview.title ?? "OG image"}
          className="aspect-[1000/760] w-full"
        />
        <p className="break-all font-mono text-xs text-zinc-500">
          {preview.image ?? "og:image 없음"}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">
            HTTP {preview.status ?? "-"}
          </span>
          <span className="break-all font-mono">{preview.normalizedPath}</span>
        </div>
        <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Link preview
          </p>
          <h3 className="mt-2 text-lg font-bold text-zinc-50">
            {preview.title ?? "og:title 없음"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {preview.description ?? "og:description 없음"}
          </p>
        </div>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="grid gap-1 md:grid-cols-[120px_1fr]">
            <dt className="text-zinc-500">og:title</dt>
            <dd className="break-words text-zinc-200">{preview.title ?? "-"}</dd>
          </div>
          <div className="grid gap-1 md:grid-cols-[120px_1fr]">
            <dt className="text-zinc-500">og:description</dt>
            <dd className="break-words text-zinc-200">{preview.description ?? "-"}</dd>
          </div>
          <div className="grid gap-1 md:grid-cols-[120px_1fr]">
            <dt className="text-zinc-500">og:image</dt>
            <dd className="break-all font-mono text-xs text-zinc-300">{preview.image ?? "-"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

const FALLBACK_KIND_LABEL: Record<OgFallbackKind, string> = {
  default: "사이트 기본 이미지",
  shared: "다른 페이지의 이미지",
  none: "og:image 없음",
  broken: "이미지 파일 없음",
};

const FALLBACK_STATE_LABEL: Record<OgFallbackState, string> = {
  unconfirmed: "미확인",
  undecided: "이미지 미정",
  intended: "의도한 fallback",
};

const FALLBACK_STATE_CLASS: Record<OgFallbackState, string> = {
  unconfirmed: "border-red-400/40 bg-red-500/10 text-red-200",
  undecided: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  intended: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
};

function formatBuiltAt(value: string | null): string {
  if (!value) return "빌드 없음";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function OgFallbackNotice({ audit }: { audit: OgFallbackAudit }) {
  const shells = audit.groups.filter((group) => group.recordShell).length;
  return (
    <section
      className={`mt-6 rounded-lg border p-4 text-sm ${
        audit.counts.unconfirmed > 0
          ? "border-red-500/40 bg-red-500/10 text-red-100"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      }`}
    >
      <p className="font-semibold">
        {audit.counts.unconfirmed > 0
          ? `확인 안 된 fallback ${audit.counts.unconfirmed}건이 있습니다. 의도한 fallback인지, 아직 이미지를 못 정한 것인지 골라 주세요.`
          : "모든 fallback을 확인했습니다."}{" "}
        <a href="#og-fallbacks" className="underline underline-offset-2">목록 보기</a>
      </p>
      <p className="mt-1 text-xs opacity-80">
        이미지 미정 {audit.counts.undecided}건 · 의도한 fallback {audit.counts.intended}건 · 빌드된 페이지 {audit.pageCount}개(게임 언어 접두사 제외) 기준
      </p>
      {shells > 0 && !audit.detailShellOgOn ? (
        <p className="mt-1 text-xs opacity-80">
          기록 셸 {shells}건: 운영 Worker의 <code>DETAIL_SHELL_OG</code>가 꺼져 있어 개별글도 목록 이미지로 나갑니다.
        </p>
      ) : null}
      {audit.staleKeys.length > 0 ? (
        <p className="mt-1 text-xs opacity-80">
          더 이상 fallback이 아닌 결정 {audit.staleKeys.length}건: {audit.staleKeys.join(", ")}
        </p>
      ) : null}
      <ul className="mt-2 grid gap-1 text-xs opacity-80 md:grid-cols-3">
        {audit.sources.map((source) => (
          <li key={source.id}>
            {source.label} · {formatBuiltAt(source.builtAt)} · HTML {source.fileCount}개 ·{" "}
            <code>{source.buildCommand}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OgFallbackRow({ group, origin }: { group: OgFallbackGroup; origin: string }) {
  const shown = group.paths.slice(0, 3);
  return (
    <article className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 md:grid-cols-[160px_1fr_auto]">
      {group.image ? (
        <OgImagePreview src={group.image} alt={group.key} className="h-28 w-40" />
      ) : (
        <div className="flex h-28 w-40 items-center justify-center rounded-md border border-dashed border-zinc-700 text-xs text-zinc-500">
          og:image 없음
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-all font-mono text-sm font-bold text-zinc-50">{group.key}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${FALLBACK_STATE_CLASS[group.state]}`}>
            {FALLBACK_STATE_LABEL[group.state]}
          </span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            {FALLBACK_KIND_LABEL[group.kind]}
            {group.kind === "shared" && group.owner ? ` (${group.owner})` : ""}
          </span>
          {group.recordShell ? (
            <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
              기록 셸
            </span>
          ) : null}
        </div>
        <p className="mt-1 break-all font-mono text-xs text-zinc-500">{group.image || "-"}</p>
        <p className="mt-2 text-xs text-zinc-400">
          페이지 {group.paths.length}개 · HTML {group.fileCount}개
          {group.key !== group.template ? ` · 라우트 ${group.template}` : ""}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs">
          {shown.map((pagePath) => (
            <li key={pagePath}>
              <a href={pagePath} className="break-all font-mono text-amber-200/80 hover:underline">{`${origin}${pagePath}`}</a>
            </li>
          ))}
        </ul>
        {group.paths.length > shown.length ? (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-zinc-500">전체 {group.paths.length}개 보기</summary>
            <ul className="mt-1 space-y-0.5">
              {group.paths.slice(shown.length).map((pagePath) => (
                <li key={pagePath}>
                  <a href={pagePath} className="break-all font-mono text-amber-200/80 hover:underline">{`${origin}${pagePath}`}</a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <form action={decideOgFallback} className="flex flex-row flex-wrap gap-2 md:flex-col">
        <input type="hidden" name="key" value={group.key} />
        <input type="hidden" name="image" value={group.image} />
        <button
          type="submit"
          name="status"
          value="intended"
          disabled={group.state === "intended"}
          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-40"
        >
          의도한 fallback
        </button>
        <button
          type="submit"
          name="status"
          value="undecided"
          disabled={group.state === "undecided"}
          className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/15 disabled:opacity-40"
        >
          이미지 미정
        </button>
        {group.state !== "unconfirmed" ? (
          <button
            type="submit"
            name="status"
            value="reset"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            미확인으로
          </button>
        ) : null}
      </form>
    </article>
  );
}

export default async function OgImagesDevPage({ previewPath }: { previewPath?: string }) {
  const [status, audit, preview, requestHeaders] = await Promise.all([
    getPageOgStatus(),
    getOgFallbackAudit(),
    getOgMetadataPreview(previewPath),
    headers(),
  ]);
  const origin = requestOrigin(requestHeaders);
  const groupedMappedRows = status.rules.map(({ rule, exists }) => ({
    rule,
    exists,
    rows: status.mappedRows.filter((row) => row.rule?.pattern === rule.pattern),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 rounded border border-primary/30 bg-primary/5 px-4 py-2">
        <span className="text-xs font-bold text-primary">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          실제 링크 프리뷰와 정적 OG 이미지 매핑 현황
        </span>
      </div>

      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">OG 이미지 현황</h1>
          <p className="mt-1 text-sm text-zinc-400">
            빌드 결과물의 실제 og:image를 전수로 읽어, 기본 이미지나 다른 페이지 이미지로 빠진 페이지를 모읍니다.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-lg font-bold text-zinc-50">{audit.pageCount}</div>
            <div className="text-[11px] text-zinc-500">빌드 페이지</div>
          </div>
          <div className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2">
            <div className="text-lg font-bold text-red-300">{audit.counts.unconfirmed}</div>
            <div className="text-[11px] text-red-200/70">미확인</div>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <div className="text-lg font-bold text-amber-300">{audit.counts.undecided}</div>
            <div className="text-[11px] text-amber-200/70">이미지 미정</div>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <div className="text-lg font-bold text-emerald-300">{audit.counts.intended}</div>
            <div className="text-[11px] text-emerald-200/70">의도한 fallback</div>
          </div>
        </div>
      </header>

      <OgFallbackNotice audit={audit} />

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-amber-300">링크 프리뷰 확인</span>
            <input
              name="path"
              defaultValue={previewPath ?? ""}
              placeholder="/compendium/cards/coordinate"
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-amber-400"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-md border border-amber-400/40 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 hover:bg-amber-400/15"
          >
            확인
          </button>
        </form>
        <p className="mt-3 text-xs text-zinc-500">
          카드와 게임 요소 query URL의 실제 og:title, og:description, og:image는 이 영역에서 확인합니다.
        </p>
        {preview ? <OgMetadataPreviewCard preview={preview} /> : null}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-300">정적 이미지 매핑 규칙</h2>
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

      <section id="og-fallbacks" className="mt-8 scroll-mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-300">Fallback 전체</h2>
          <span className="text-xs text-zinc-500">{audit.groups.length}건</span>
        </div>
        <div className="grid gap-3">
          {audit.groups.map((group) => (
            <OgFallbackRow key={group.key} group={group} origin={origin} />
          ))}
        </div>
      </section>
    </main>
  );
}
