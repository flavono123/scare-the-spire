import "server-only";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AdminServiceFilter } from "@/components/dev/admin-service-filter";
import type { PostBlock } from "@/lib/chemical-types";
import type {
  ContactCategory,
  ContactInquiryEnv,
  ContactInquiryStatus,
} from "@/lib/contact-inquiries";
import {
  ADMIN_COMMENT_SERVICES,
  ADMIN_POST_SERVICES,
  ADMIN_SERVICE_LABELS,
  ADMIN_SERVICE_TOKEN_SRC,
  adminFilterHref,
  adminServicePostHref,
  COMMENT_OTHER_PREFIXES,
  commentStoryFilter,
  formatRate,
  isMissingRlsActivityMetricsRpc,
  mergeAdminServicePosts,
  parseRlsActivityMetrics,
  type AdminPostService,
  type AdminServicePostRow,
  type RlsActivityMetrics,
} from "@/lib/admin-rls-activity";
import {
  commentThreadHref,
  commentThreadService,
  type CommentThreadService,
} from "@/lib/comment-threads";
import { COMMENT_MAX_CHARS } from "@/lib/content-limits";
import { historyRunPlainText } from "@/lib/history-run-reference";
import { devToolsEnabled } from "@/lib/dev-tools";
import { getSiteOrigin } from "@/lib/site-origin";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { contactMessages } from "@/messages/contact";

const ROW_LIMIT = 50;
const CONTACT_ROW_LIMIT = 100;
const ADMIN_DATA_ENV = "production";
const PRODUCTION_SITE_ORIGIN = getSiteOrigin();

const CONTACT_ENV_LABELS: Record<ContactInquiryEnv, string> = {
  production: "운영",
  development: "개발",
};

const CONTACT_STATUS_LABELS: Record<ContactInquiryStatus, string> = {
  new: "접수",
  reviewing: "확인 중",
  done: "답변 완료",
  spam: "스팸",
};

const CONTACT_STATUSES = Object.keys(CONTACT_STATUS_LABELS) as ContactInquiryStatus[];
const CONTACT_INQUIRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ContactInquiryAdminRow {
  id: string;
  user_id: string | null;
  category: ContactCategory;
  message: string;
  reply_email: string | null;
  page_path: string;
  service_locale: string;
  game_locale: string;
  env: ContactInquiryEnv;
  status: ContactInquiryStatus;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  content_blocks: PostBlock[] | null;
  env: string;
  created_at: string;
}

interface QueryState<T> {
  data: T;
  count?: number;
  error?: string;
  note?: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

interface AdminSnapshot {
  comments: QueryState<CommentRow[]>;
  posts: QueryState<AdminServicePostRow[]>;
  metrics: QueryState<RlsActivityMetrics | null>;
}

async function readSupabase<T>(
  operation: string,
  promise: PromiseLike<SupabaseResult<T>>,
  fallback: T,
): Promise<QueryState<T>> {
  try {
    const { data, error, count } = await withSupabaseTimeout(operation, promise);
    if (error) return { data: fallback, error: error.message };
    return { data: data ?? fallback, count: count ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return { data: fallback, error: message };
  }
}

function createInquiryAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function readContactInquiries(): Promise<QueryState<ContactInquiryAdminRow[]> | null> {
  const admin = createInquiryAdminClient();
  if (!admin) return null;

  return readSupabase<ContactInquiryAdminRow[]>(
    "admin.contact_inquiries",
    admin
      .from("contact_inquiries")
      .select("id,user_id,category,message,reply_email,page_path,service_locale,game_locale,env,status,admin_response,responded_at,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(CONTACT_ROW_LIMIT),
    [],
  );
}

async function readComments(
  service: CommentThreadService | null,
): Promise<QueryState<CommentRow[]>> {
  let query = supabase
    .from("comments")
    .select("id, story_id, user_id, nickname, content, content_blocks, env, created_at", { count: "exact" })
    .eq("env", ADMIN_DATA_ENV)
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);

  const filter = commentStoryFilter(service);
  if (filter?.kind === "eq") query = query.eq("story_id", filter.value);
  else if (filter?.kind === "like") query = query.like("story_id", filter.value);
  else if (filter?.kind === "other") {
    query = query.neq("story_id", "byrdispatch");
    for (const prefix of COMMENT_OTHER_PREFIXES) {
      query = query.not("story_id", "like", `${prefix}%`);
    }
  }

  return readSupabase<CommentRow[]>("admin.comments", query, []);
}

function asPostRow(
  service: AdminPostService,
  row: {
    id: string;
    created_at: string;
    nickname?: string | null;
    user_id?: string | null;
    summary: string;
  },
): AdminServicePostRow {
  return {
    id: row.id,
    service,
    createdAt: row.created_at,
    nickname: (row.nickname ?? "").trim() || "-",
    summary: row.summary,
    href: productionHref(adminServicePostHref(service, row.id)),
    userId: row.user_id ?? "-",
  };
}

async function readServicePosts(
  service: AdminPostService | null,
): Promise<QueryState<AdminServicePostRow[]>> {
  const services = service ? [service] : [...ADMIN_POST_SERVICES];
  const results = await Promise.all(services.map((key) => readOneServicePosts(key)));
  const errors = results.flatMap((result) => result.error ? [result.error] : []);
  return {
    data: mergeAdminServicePosts(results.flatMap((result) => result.data)),
    count: results.reduce((sum, result) => sum + (result.count ?? result.data.length), 0),
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}

async function readOneServicePosts(
  service: AdminPostService,
): Promise<QueryState<AdminServicePostRow[]>> {
  switch (service) {
    case "stories": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string | null;
        nickname: string;
        sentence: string;
        created_at: string;
      }>>(
        "admin.community_stories",
        supabase
          .from("community_stories")
          .select("id, user_id, nickname, sentence, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .is("static_story_id", null)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.sentence),
        })),
      };
    }
    case "combo": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string;
        nickname: string;
        content: PostBlock[];
        content_text: string;
        created_at: string;
      }>>(
        "admin.combo_posts",
        supabase
          .from("combo_posts")
          .select("id, user_id, nickname, content, content_text, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(blockText(row.content) || row.content_text, 100),
        })),
      };
    }
    case "transfigure": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string;
        nickname: string;
        resource_type: string;
        resource_id: string;
        content: PostBlock[];
        content_text: string;
        title: string | null;
        transformed_name: string | null;
        created_at: string;
      }>>(
        "admin.transfigure_posts",
        supabase
          .from("transfigure_posts")
          .select("id, user_id, nickname, resource_type, resource_id, content, content_text, title, transformed_name, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(
            row.title?.trim()
              || row.transformed_name?.trim()
              || blockText(row.content)
              || row.content_text
              || `${row.resource_type}:${row.resource_id}`,
            100,
          ),
        })),
      };
    }
    case "this_or_that": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string;
        nickname: string;
        left_type: string;
        left_id: string;
        right_type: string;
        right_id: string;
        reason: string;
        created_at: string;
      }>>(
        "admin.this_or_that_posts",
        supabase
          .from("this_or_that_posts")
          .select("id, user_id, nickname, left_type, left_id, right_type, right_id, reason, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.reason || `${row.left_id} / ${row.right_id}`, 100),
        })),
      };
    }
    case "chemical_x": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string;
        nickname: string;
        content: PostBlock[];
        content_text: string;
        created_at: string;
      }>>(
        "admin.chemical_posts",
        supabase
          .from("chemical_posts")
          .select("id, user_id, nickname, content, content_text, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(blockText(row.content) || row.content_text, 80),
        })),
      };
    }
    case "decisions_decisions": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string;
        nickname: string;
        title: string;
        note: string;
        created_at: string;
      }>>(
        "admin.decisions_decisions_posts",
        supabase
          .from("decisions_decisions_posts")
          .select("id, user_id, nickname, title, note, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.title.trim() || row.note, 100),
        })),
      };
    }
    case "favorite_tournament": {
      const result = await readSupabase<Array<{
        id: string;
        user_id: string | null;
        nickname: string;
        title: string;
        note: string;
        created_at: string;
      }>>(
        "admin.favorite_tournament_posts",
        supabase
          .from("favorite_tournament_posts")
          .select("id, user_id, nickname, title, note, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.title.trim() || row.note, 100),
        })),
      };
    }
    case "history_course": {
      const result = await readSupabase<Array<{
        id: string;
        donor_user_id: string | null;
        character: string;
        ascension: number;
        win: boolean;
        created_at: string;
      }>>(
        "admin.runs",
        supabase
          .from("runs")
          .select("id, donor_user_id, character, ascension, win, created_at", { count: "exact" })
          .eq("env", ADMIN_DATA_ENV)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
        [],
      );
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          id: row.id,
          created_at: row.created_at,
          nickname: row.donor_user_id ? "공유" : "-",
          user_id: row.donor_user_id,
          summary: `${row.win ? "승리" : "패배"} · ${row.character} A${row.ascension}`,
        })),
      };
    }
  }
}

async function readRlsActivityMetrics(): Promise<QueryState<RlsActivityMetrics | null>> {
  const admin = createInquiryAdminClient();
  if (!admin) {
    return { data: null, note: "서버 키 설정 필요" };
  }

  try {
    const { data, error } = await withSupabaseTimeout(
      "admin.rls_activity_metrics",
      admin.rpc("get_rls_activity_metrics", { p_env: ADMIN_DATA_ENV }),
      20000,
    );
    if (error) {
      return {
        data: null,
        error: error.message,
        note: isMissingRlsActivityMetricsRpc(error)
          ? "get_rls_activity_metrics 마이그레이션이 필요합니다."
          : undefined,
      };
    }
    const parsed = parseRlsActivityMetrics(data);
    if (!parsed) return { data: null, error: "지표 응답을 읽지 못했습니다." };
    return { data: parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return { data: null, error: message };
  }
}

async function loadAdminSnapshot(
  postService: AdminPostService | null,
  commentService: CommentThreadService | null,
): Promise<AdminSnapshot | null> {
  if (!supabaseEnabled) return null;

  const [comments, posts, metrics] = await Promise.all([
    readComments(commentService),
    readServicePosts(postService),
    readRlsActivityMetrics(),
  ]);

  return { comments, posts, metrics };
}

async function respondToContactInquiry(formData: FormData) {
  "use server";

  let result: "saved" | "error" = "saved";
  try {
    if (!devToolsEnabled()) throw new Error("Dev tools are disabled");

    const id = String(formData.get("id") ?? "");
    const response = String(formData.get("response") ?? "").trim();
    const status = String(formData.get("status") ?? "") as ContactInquiryStatus;
    if (!CONTACT_INQUIRY_ID_PATTERN.test(id)) throw new Error("Invalid inquiry id");
    if (!CONTACT_STATUSES.includes(status)) throw new Error("Invalid inquiry status");
    if (response.length > 8000) throw new Error("Response is too long");
    if (!response && status === "done") throw new Error("A completed inquiry needs a response");

    const admin = createInquiryAdminClient();
    if (!admin) throw new Error("SUPABASE_SECRET_KEY is not configured");

    const { error } = await withSupabaseTimeout(
      "admin.contact_inquiries.update",
      admin
        .from("contact_inquiries")
        .update({
          admin_response: response || null,
          responded_at: response ? new Date().toISOString() : null,
          status: response ? "done" : status,
        })
        .eq("id", id),
    );
    if (error) throw error;

    revalidatePath("/dev/admin");
  } catch (error) {
    console.error("Failed to save contact inquiry response", error);
    result = "error";
  }

  redirect(`/dev/admin?contactSave=${result}#contact-save-result`);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function blockText(blocks: PostBlock[] | null | undefined): string {
  if (!blocks?.length) return "";

  return blocks.map((block) => {
    if (block.type === "text") return block.text;
    if (block.type === "entity") return block.displayText;
    if (block.type === "cost-token") {
      return block.kind === "energy"
        ? "@".repeat(Math.max(1, block.count))
        : "*".repeat(Math.max(1, block.count));
    }
    if (block.type === "youtube") return block.title;
    if (block.type === "history-run") return historyRunPlainText(block);
    return block.text;
  }).join("");
}

function productionHref(path: string): string {
  return `${PRODUCTION_SITE_ORIGIN}${path}`;
}

function countLabel(state: QueryState<unknown[]>): string {
  const total = state.count ?? state.data.length;
  if (state.count === undefined) return `${total.toLocaleString("ko-KR")}개`;
  return `${total.toLocaleString("ko-KR")}개`;
}

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      조회 실패: {error}
    </p>
  );
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      {detail && <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  );
}

function Section({
  title,
  count,
  error,
  children,
}: {
  title: string;
  count?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        {count && <span className="text-xs text-muted-foreground">{count}</span>}
      </div>
      <ErrorLine error={error} />
      {children}
    </section>
  );
}

function ServiceCell({
  service,
}: {
  service: keyof typeof ADMIN_SERVICE_LABELS;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-[9.5rem] items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ADMIN_SERVICE_TOKEN_SRC[service]}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5 shrink-0"
      />
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {ADMIN_SERVICE_LABELS[service]}
      </span>
    </span>
  );
}

export const metadata = {
  title: "Supabase Admin — DEV",
  description: "개발 전용 Supabase 컨텐츠 확인 페이지",
};

export default async function SupabaseAdminPage({
  contactSaveResult,
  postService,
  commentService,
}: {
  contactSaveResult?: "saved" | "error";
  postService: AdminPostService | null;
  commentService: CommentThreadService | null;
}) {
  if (!devToolsEnabled()) {
    notFound();
  }

  const [snapshot, contactInquiries] = await Promise.all([
    loadAdminSnapshot(postService, commentService),
    readContactInquiries(),
  ]);
  const contactRows = contactInquiries?.data ?? [];
  const metrics = snapshot?.metrics.data ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-primary">DEV ONLY</span>
            <h1 className="mt-1 text-2xl font-bold">Supabase Admin</h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>data: <code className="text-primary">{ADMIN_DATA_ENV}</code></div>
            <div>limit: latest {ROW_LIMIT}</div>
          </div>
        </div>
      </div>

      <Section
        title="문의 우편함"
        count={contactInquiries
          ? `전체 ${(contactInquiries.count ?? contactRows.length).toLocaleString("ko-KR")}개 · 최근 ${contactRows.length.toLocaleString("ko-KR")}개 표시`
          : "서버 키 설정 필요"}
        error={contactInquiries?.error}
      >
        {contactSaveResult && (
          <div
            id="contact-save-result"
            role={contactSaveResult === "saved" ? "status" : "alert"}
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${
              contactSaveResult === "saved"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {contactSaveResult === "saved"
              ? "저장했습니다."
              : "저장하지 못했습니다. 다시 시도해 주세요."}
          </div>
        )}
        {!contactInquiries ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-sm text-amber-100">
            <code>SUPABASE_SECRET_KEY</code>를 서버 환경에 설정하면 문의를 조회하고 답변할 수 있습니다.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {(["production", "development"] as const).map((env) => {
              const rows = contactRows.filter((inquiry) => inquiry.env === env);
              return (
                <div key={env}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={env === "production" ? "text-emerald-300" : "text-sky-300"}>
                      {CONTACT_ENV_LABELS[env]}
                    </span>
                    <code className="text-[10px] text-muted-foreground">{env}</code>
                    <span className="text-xs font-normal text-muted-foreground">{rows.length}개</span>
                  </h3>
                  <div className="space-y-3">
                    {rows.map((inquiry) => (
                      <article key={inquiry.id} className="rounded-md border border-border bg-card/35 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <strong className="text-primary">
                            {contactMessages.ko.categories[inquiry.category].label}
                          </strong>
                          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            {CONTACT_STATUS_LABELS[inquiry.status]}
                          </span>
                          <time className="ml-auto text-muted-foreground" dateTime={inquiry.created_at}>
                            {formatDate(inquiry.created_at)}
                          </time>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                          {inquiry.message}
                        </p>
                        <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-[11px] text-muted-foreground sm:grid-cols-2">
                          <div><dt className="inline font-semibold">답변 이메일 </dt><dd className="inline">{inquiry.reply_email ?? "-"}</dd></div>
                          <div><dt className="inline font-semibold">문의 위치 </dt><dd className="inline"><code>{inquiry.page_path}</code></dd></div>
                          <div><dt className="inline font-semibold">언어 </dt><dd className="inline">{inquiry.service_locale} / {inquiry.game_locale}</dd></div>
                          <div><dt className="inline font-semibold">user_id </dt><dd className="inline"><code>{inquiry.user_id ?? "-"}</code></dd></div>
                        </dl>
                        <form action={respondToContactInquiry} className="mt-4 space-y-2">
                          <input type="hidden" name="id" value={inquiry.id} />
                          <label className="block text-xs font-semibold text-muted-foreground" htmlFor={`response-${inquiry.id}`}>
                            운영자 답변
                          </label>
                          <textarea
                            id={`response-${inquiry.id}`}
                            name="response"
                            defaultValue={inquiry.admin_response ?? ""}
                            maxLength={8000}
                            rows={4}
                            className="w-full resize-y rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              name="status"
                              defaultValue={inquiry.status}
                              aria-label="문의 상태"
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                              {CONTACT_STATUSES.map((status) => (
                                <option key={status} value={status}>{CONTACT_STATUS_LABELS[status]}</option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="h-9 rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20"
                            >
                              저장
                            </button>
                            <span className="text-[11px] text-muted-foreground">
                              {inquiry.admin_response
                                ? "저장하면 기존 답변을 덮어씁니다."
                                : "답변을 입력하면 답변 완료로 저장됩니다."}
                            </span>
                          </div>
                        </form>
                      </article>
                    ))}
                    {rows.length === 0 && (
                      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        문의 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {!snapshot ? (
        <div className="rounded-md border border-border bg-card/40 px-4 py-6">
          <h2 className="text-base font-semibold">Supabase 연결 없음</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되면 이 페이지에서 production 데이터를 조회합니다.
          </p>
        </div>
      ) : (
        <>
          <Section
            title="RLS 식별 방문 · 리텐션"
            count={snapshot.metrics.note}
            error={snapshot.metrics.error}
          >
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Cloudflare Web Analytics는 페이지뷰는 보여 주지만 이탈(bounce)과 재방문 코호트는 없습니다.
              새 로그 파이프 없이, 이미 RLS 주체인 익명 <code>user_id</code>의 활동 시각과
              <code>auth.users</code>의 첫/마지막 세션만 집계합니다. 익명 세션은 글·댓글·좋아요·투표 등
              쓰기 순간에 만들어지므로 숫자는 CF 방문자가 아니라 <strong>식별된 활동 사용자</strong>입니다.
              페이지뷰 스트림이 없어서 bounce는 재구성할 수 없고, 하루만 활동한 비율이 가장 가까운 대리 지표입니다.
              아래 값은 기존 행을 날짜 버킷으로 다시 읽은 backfill입니다.
            </p>
            {metrics ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="식별 사용자"
                    value={metrics.site.identifiedUsers.toLocaleString("ko-KR")}
                    detail={`30일 ${metrics.site.users30d.toLocaleString("ko-KR")} · 7일 ${metrics.site.users7d.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="재방문율 (활동)"
                    value={formatRate(metrics.site.activityReturnRate)}
                    detail={`2일 이상 ${metrics.site.users2plusDays.toLocaleString("ko-KR")}명`}
                  />
                  <StatTile
                    label="하루만 활동"
                    value={formatRate(
                      metrics.site.identifiedUsers > 0
                        ? metrics.site.singleDayUsers / metrics.site.identifiedUsers
                        : null,
                    )}
                    detail="bounce 대리 · 페이지뷰 없음"
                  />
                  <StatTile
                    label="세션 재방문율"
                    value={formatRate(metrics.site.authReturnRate)}
                    detail={`last_sign_in 날짜 > 가입일 · ${metrics.site.authReturned.toLocaleString("ko-KR")}/${metrics.site.authUsers.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="D1 리텐션"
                    value={formatRate(metrics.site.d1Rate)}
                    detail={`다음날 활동 ${metrics.site.d1Retained.toLocaleString("ko-KR")} / 코호트 ${metrics.site.d1Cohort.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="D7 리텐션"
                    value={formatRate(metrics.site.d7Rate)}
                    detail={`7일 후 활동 ${metrics.site.d7Retained.toLocaleString("ko-KR")} / 코호트 ${metrics.site.d7Cohort.toLocaleString("ko-KR")}`}
                  />
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">서비스</th>
                        <th className="px-3 py-2 text-right">전체</th>
                        <th className="px-3 py-2 text-right">30일</th>
                        <th className="px-3 py-2 text-right">7일</th>
                        <th className="px-3 py-2 text-right">30일 점유</th>
                        <th className="px-3 py-2 text-right">재방문율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.services.map((row) => (
                        <tr key={row.service} className="border-t border-border/70">
                          <td className="px-3 py-2"><ServiceCell service={row.service} /></td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.usersAll.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.users30d.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.users7d.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRate(row.share30d)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRate(row.returnRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">날짜 (KST)</th>
                        <th className="px-3 py-2 text-right">활동 사용자</th>
                        <th className="px-3 py-2 text-right">신규</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.daily.map((row) => (
                        <tr key={row.day} className="border-t border-border/70">
                          <td className="px-3 py-2 tabular-nums">{row.day}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.users.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.newUsers.toLocaleString("ko-KR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {snapshot.metrics.note ?? "지표를 표시할 수 없습니다."}
              </div>
            )}
          </Section>

          <div className="mt-10 border-t border-border/70 pt-6">
            <h2 className="text-xl font-semibold text-primary">최신 작성</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              production 작성글을 댓글과 서비스 글 두 축으로만 봅니다. 서비스 글은 조각모음처럼 한 테이블입니다.
            </p>
          </div>

          <Section title="댓글" count={countLabel(snapshot.comments)} error={snapshot.comments.error}>
            <div className="mb-3">
              <AdminServiceFilter
                allLabel="전체"
                allHref={adminFilterHref({ posts: postService, comments: null })}
                allSelected={commentService === null}
                chips={ADMIN_COMMENT_SERVICES.map((service) => ({
                  key: service,
                  label: ADMIN_SERVICE_LABELS[service],
                  tokenSrc: ADMIN_SERVICE_TOKEN_SRC[service],
                  href: adminFilterHref({ posts: postService, comments: service }),
                  selected: commentService === service,
                }))}
              />
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">서비스</th>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">위치</th>
                    <th className="px-3 py-2">내용</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.comments.data.map((comment) => (
                    <tr key={comment.id} className="border-t border-border/70 align-top">
                      <td className="px-3 py-2">
                        <ServiceCell service={commentThreadService(comment.story_id)} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(comment.created_at)}</td>
                      <td className="px-3 py-2 text-primary">{comment.nickname}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={productionHref(commentThreadHref(comment.story_id))}
                          prefetch={false}
                          className="text-[11px] sts-text-aqua underline-offset-4 hover:underline"
                        >
                          {comment.story_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-pre-wrap break-words">{truncate(blockText(comment.content_blocks) || comment.content, COMMENT_MAX_CHARS)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{comment.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.comments.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>댓글 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="서비스 글" count={countLabel(snapshot.posts)} error={snapshot.posts.error}>
            <div className="mb-3">
              <AdminServiceFilter
                allLabel="전체"
                allHref={adminFilterHref({ posts: null, comments: commentService })}
                allSelected={postService === null}
                chips={ADMIN_POST_SERVICES.map((service) => ({
                  key: service,
                  label: ADMIN_SERVICE_LABELS[service],
                  tokenSrc: ADMIN_SERVICE_TOKEN_SRC[service],
                  href: adminFilterHref({ posts: service, comments: commentService }),
                  selected: postService === service,
                }))}
              />
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">서비스</th>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">요약</th>
                    <th className="px-3 py-2">글</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.posts.data.map((post) => (
                    <tr key={`${post.service}:${post.id}`} className="border-t border-border/70 align-top">
                      <td className="px-3 py-2"><ServiceCell service={post.service} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(post.createdAt)}</td>
                      <td className="px-3 py-2 text-primary">{post.nickname}</td>
                      <td className="px-3 py-2">{post.summary}</td>
                      <td className="px-3 py-2">
                        <Link href={post.href} prefetch={false} className="sts-text-aqua underline-offset-4 hover:underline">
                          {post.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.userId}</code></td>
                    </tr>
                  ))}
                  {snapshot.posts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>작성글 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </main>
  );
}
