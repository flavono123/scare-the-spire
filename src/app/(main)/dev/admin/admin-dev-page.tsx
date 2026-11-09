import "server-only";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminTabs } from "./admin-tabs";
import type { AdminTabId } from "./admin-tab-ids";
import { notFound, redirect } from "next/navigation";
import { AdminActivityChart } from "@/components/dev/admin-activity-chart";
import { AdminAuthorTable } from "@/components/dev/admin-author-table";
import { AdminAuthorTimelineChart } from "@/components/dev/admin-author-timeline-chart";
import { AdminProfileNicknames } from "@/components/dev/admin-profile-nicknames";
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
  aggregateAdminAuthors,
  buildAuthorTimeSeries,
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
import { historyRunFloorPlainText } from "@/lib/history-run-floor";
import { historyRunPlainText } from "@/lib/history-run-reference";
import { emotePlainText } from "@/lib/emote-con";
import { devToolsEnabled } from "@/lib/dev-tools";
import {
  DEFAULT_PROFILE_NICKNAMES,
  parseNicknamePoolRows,
  parseNicknamePoolsFromFormData,
  type ProfileNicknamePools,
} from "@/lib/profile-character-nicknames";
import { getSiteOrigin } from "@/lib/site-origin";
import { contactMessages } from "@/messages/contact";
// Server-only operator tools (plan 5.7): D1 through wrangler, Supabase through fetch.
import { adminDeps } from "../../../../../scripts/admin/admin-deps";
import {
  ADMIN_D1_ENV,
  readAdminComments,
  readAdminContactInquiries,
  readAdminNicknamePools,
  readAdminServicePosts,
  readRlsActivityMetricsRpc,
} from "../../../../../scripts/admin/admin-reads";
import { replyToContactInquiry, saveProfileNicknamePools } from "../../../../../scripts/admin/admin-writes";
import { supabaseAdminConfig } from "../../../../../scripts/lib/supabase-admin";

const ROW_LIMIT = 50;
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
  avatar_id?: string | null;
  avatar_kind?: string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
}

interface QueryState<T> {
  data: T;
  count?: number;
  error?: string;
  note?: string;
}

interface NicknamePoolState {
  pools: ProfileNicknamePools;
  source: "stored" | "defaults";
  canEdit: boolean;
  error?: string;
}

interface AdminSnapshot {
  comments: QueryState<CommentRow[]>;
  posts: QueryState<AdminServicePostRow[]>;
  metrics: QueryState<RlsActivityMetrics | null>;
}

/** The env D1s of the dev server (remote unless ADMIN_D1=local). */
const adminD1 = () => adminDeps().d1;

async function readContactInquiries(): Promise<QueryState<ContactInquiryAdminRow[]> | null> {
  // From the store the reply writes to (source.contact of each env), so a reply shows at once.
  const result = await readAdminContactInquiries(adminDeps());
  if (!result) return null;
  return { data: result.data as unknown as ContactInquiryAdminRow[], count: result.count, error: result.error };
}

async function readComments(
  service: CommentThreadService | null,
): Promise<QueryState<CommentRow[]>> {
  const result = await readAdminComments(adminD1()(ADMIN_D1_ENV), service);
  return { data: result.data as unknown as CommentRow[], count: result.count, error: result.error };
}

function asPostRow(
  service: AdminPostService,
  row: {
    id: string;
    created_at: string;
    nickname?: string | null;
    user_id?: string | null;
    summary: string;
    avatar_id?: string | null;
    avatar_kind?: string | null;
    palette_id?: string | null;
    palette_swapped?: boolean | null;
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
    avatar_id: row.avatar_id,
    avatar_kind: row.avatar_kind,
    palette_id: row.palette_id,
    palette_swapped: row.palette_swapped,
  };
}

async function readServicePosts(
  service: AdminPostService | null,
): Promise<QueryState<AdminServicePostRow[]>> {
  const services = service ? [service] : [...ADMIN_POST_SERVICES];
  const read = await readAdminServicePosts(adminD1()(ADMIN_D1_ENV), services);
  const results = services.map((key) => readOneServicePosts(key, read[key]));
  const errors = results.flatMap((result) => result.error ? [result.error] : []);
  return {
    data: mergeAdminServicePosts(results.flatMap((result) => result.data)),
    count: results.reduce((sum, result) => sum + (result.count ?? result.data.length), 0),
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}

/** One service's D1 rows (already in the Supabase row shape) as admin post rows. */
function rowsAs<T>(result: QueryState<Record<string, unknown>[]>): QueryState<T> {
  return { data: result.data as unknown as T, count: result.count, error: result.error };
}

function readOneServicePosts(
  service: AdminPostService,
  read: QueryState<Record<string, unknown>[]>,
): QueryState<AdminServicePostRow[]> {
  switch (service) {
    case "stories": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string | null;
        nickname: string;
        sentence: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.sentence),
        })),
      };
    }
    case "combo": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string;
        nickname: string;
        content: PostBlock[];
        content_text: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(blockText(row.content) || row.content_text, 100),
        })),
      };
    }
    case "transfigure": {
      const result = rowsAs<Array<{
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
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
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
      const result = rowsAs<Array<{
        id: string;
        user_id: string;
        nickname: string;
        left_type: string;
        left_id: string;
        right_type: string;
        right_id: string;
        reason: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.reason || `${row.left_id} / ${row.right_id}`, 100),
        })),
      };
    }
    case "chemical_x": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string;
        nickname: string;
        content: PostBlock[];
        content_text: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(blockText(row.content) || row.content_text, 80),
        })),
      };
    }
    case "decisions_decisions": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string;
        nickname: string;
        title: string;
        note: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.title.trim() || row.note, 100),
        })),
      };
    }
    case "favorite_tournament": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string | null;
        nickname: string;
        title: string;
        note: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.title.trim() || row.note, 100),
        })),
      };
    }
    case "pagestorm": {
      const result = rowsAs<Array<{
        id: string;
        user_id: string;
        nickname: string;
        title: string;
        content_text: string;
        created_at: string;
        avatar_id?: string | null;
        avatar_kind?: string | null;
        palette_id?: string | null;
        palette_swapped?: boolean | null;
      }>>(read);
      return {
        ...result,
        data: result.data.map((row) => asPostRow(service, {
          ...row,
          summary: truncate(row.title.trim() || row.content_text, 100),
        })),
      };
    }
    case "history_course": {
      const result = rowsAs<Array<{
        id: string;
        donor_user_id: string | null;
        character: string;
        ascension: number;
        win: boolean;
        created_at: string;
      }>>(read);
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
  const config = supabaseAdminConfig();
  if (!config) {
    return { data: null, note: "서버 키 설정 필요" };
  }

  // A Supabase-side metric with no D1 counterpart: the RPC over fetch until step 7.
  const { data, error } = await readRlsActivityMetricsRpc(config, ADMIN_DATA_ENV);
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
}

async function loadAdminSnapshot(
  postService: AdminPostService | null,
  commentService: CommentThreadService | null,
): Promise<AdminSnapshot | null> {
  const [comments, posts, metrics] = await Promise.all([
    readComments(commentService),
    readServicePosts(postService),
    readRlsActivityMetrics(),
  ]);

  return { comments, posts, metrics };
}

async function readNicknamePools(): Promise<NicknamePoolState> {
  // From the store the save writes to (production's source.profile), so a save shows at once.
  const read = await readAdminNicknamePools(adminDeps());
  if (!read) {
    return {
      pools: DEFAULT_PROFILE_NICKNAMES,
      source: "defaults",
      canEdit: false,
    };
  }
  const { rows, gate, error } = read;
  // Saving needs the Supabase key only while production's profile source is Supabase.
  const canEdit = gate?.sources.profile === "d1" || supabaseAdminConfig() !== null;
  if (error) {
    return {
      pools: DEFAULT_PROFILE_NICKNAMES,
      source: "defaults",
      canEdit,
      error,
    };
  }
  return {
    pools: parseNicknamePoolRows(rows),
    source: rows.length > 0 ? "stored" : "defaults",
    canEdit,
  };
}

async function writeNicknamePools(pools: ProfileNicknamePools): Promise<void> {
  // Supabase, or D1 and its outbox rows, by the profile group's write source.
  await saveProfileNicknamePools(adminDeps(), pools);
}

async function saveProfileCharacterNicknames(formData: FormData) {
  "use server";

  let result: "saved" | "error" | "invalid" = "saved";
  try {
    if (!devToolsEnabled()) throw new Error("Dev tools are disabled");
    const pools = parseNicknamePoolsFromFormData(formData);
    if (!pools) {
      result = "invalid";
    } else {
      await writeNicknamePools(pools);
      revalidatePath("/dev/admin");
    }
  } catch (error) {
    console.error("Failed to save profile character nicknames", error);
    result = "error";
  }

  redirect(`/dev/admin?nicksSave=${result}&tab=nicks#nicks-save-result`);
}

async function resetProfileCharacterNicknames(formData: FormData) {
  "use server";
  void formData;

  let result: "saved" | "error" = "saved";
  try {
    if (!devToolsEnabled()) throw new Error("Dev tools are disabled");
    await writeNicknamePools(DEFAULT_PROFILE_NICKNAMES);
    revalidatePath("/dev/admin");
  } catch (error) {
    console.error("Failed to reset profile character nicknames", error);
    result = "error";
  }

  redirect(`/dev/admin?nicksSave=${result}&tab=nicks#nicks-save-result`);
}

async function respondToContactInquiry(formData: FormData) {
  "use server";

  let result: "saved" | "error" = "saved";
  try {
    if (!devToolsEnabled()) throw new Error("Dev tools are disabled");

    // The same checks as before (checkInquiryReply), then Supabase or D1 by source.contact of the
    // inquiry's env (each env's rows live in its own D1).
    await replyToContactInquiry(adminDeps(), {
      id: String(formData.get("id") ?? ""),
      dataEnv: String(formData.get("env") ?? ""),
      response: String(formData.get("response") ?? ""),
      status: String(formData.get("status") ?? "") as ContactInquiryStatus,
    });

    revalidatePath("/dev/admin");
  } catch (error) {
    console.error("Failed to save contact inquiry response", error);
    result = "error";
  }

  redirect(`/dev/admin?contactSave=${result}&tab=contact#contact-save-result`);
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
    if (block.type === "link") return block.title;
    if (block.type === "history-run") return historyRunPlainText(block);
    if (block.type === "history-run-floor") return historyRunFloorPlainText(block);
    if (block.type === "card-con") return block.displayText;
    if (block.type === "emote-con") return emotePlainText(block.emoteId);
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
  nicksSaveResult,
  postService,
  commentService,
  tab = "contact",
}: {
  tab?: AdminTabId;
  contactSaveResult?: "saved" | "error";
  nicksSaveResult?: "saved" | "error" | "invalid";
  postService: AdminPostService | null;
  commentService: CommentThreadService | null;
}) {
  if (!devToolsEnabled()) {
    notFound();
  }

  const [snapshot, contactInquiries, nicknamePools] = await Promise.all([
    loadAdminSnapshot(postService, commentService),
    readContactInquiries(),
    readNicknamePools(),
  ]);
  const contactRows = contactInquiries?.data ?? [];
  const metrics = snapshot?.metrics.data ?? null;
  const authors = snapshot
    ? aggregateAdminAuthors({
        comments: snapshot.comments.data,
        posts: snapshot.posts.data,
      })
    : [];
  const authorTimeSeries = snapshot
    ? buildAuthorTimeSeries({
        comments: snapshot.comments.data,
        posts: snapshot.posts.data,
      })
    : null;

  const noSnapshot = (
        <div className="rounded-md border border-border bg-card/40 px-4 py-6">
          <h2 className="text-base font-semibold">Supabase 연결 없음</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되면 이 페이지에서 production 데이터를 조회합니다.
          </p>
        </div>
  );
  const tabs = [
    { id: "contact", label: "문의 우편함" },
    { id: "metrics", label: "작성률" },
    { id: "authors", label: "작성자" },
    { id: "comments", label: "댓글" },
    { id: "posts", label: "서비스 글" },
    { id: "nicks", label: "프로필 닉네임" },
  ] as const;

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
      <AdminTabs
        tabs={tabs}
        initialTab={tab}
        panels={{
          contact: (
<>
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
                          <input type="hidden" name="env" value={inquiry.env} />
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
</>
          ),
          metrics: snapshot ? (
          <Section
            title="작성률 · 재작성률"
            count={snapshot.metrics.note}
            error={snapshot.metrics.error}
          >
            {metrics ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="작성률 (전체)"
                    value={metrics.site.identifiedUsers.toLocaleString("ko-KR")}
                    detail={`30일 ${metrics.site.users30d.toLocaleString("ko-KR")} · 7일 ${metrics.site.users7d.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="재작성률"
                    value={formatRate(metrics.site.activityReturnRate)}
                    detail={`2일 이상 작성 ${metrics.site.users2plusDays.toLocaleString("ko-KR")}명`}
                  />
                  <StatTile
                    label="하루만 작성"
                    value={formatRate(
                      metrics.site.identifiedUsers > 0
                        ? metrics.site.singleDayUsers / metrics.site.identifiedUsers
                        : null,
                    )}
                    detail={`하루만 작성 ${metrics.site.singleDayUsers.toLocaleString("ko-KR")}명`}
                  />
                  <StatTile
                    label="세션 재작성률"
                    value={formatRate(metrics.site.authReturnRate)}
                    detail={`JWT last_sign_in이 첫 작성일보다 뒤 · ${metrics.site.authReturned.toLocaleString("ko-KR")}/${metrics.site.authUsers.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="D1 재작성률"
                    value={formatRate(metrics.site.d1Rate)}
                    detail={`다음날 또 작성 ${metrics.site.d1Retained.toLocaleString("ko-KR")} / 코호트 ${metrics.site.d1Cohort.toLocaleString("ko-KR")}`}
                  />
                  <StatTile
                    label="D7 재작성률"
                    value={formatRate(metrics.site.d7Rate)}
                    detail={`7일 후 또 작성 ${metrics.site.d7Retained.toLocaleString("ko-KR")} / 코호트 ${metrics.site.d7Cohort.toLocaleString("ko-KR")}`}
                  />
                </div>
                <div className="mt-4">
                  <AdminActivityChart daily={metrics.daily} />
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
                        <th className="px-3 py-2 text-right">재작성률</th>
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
                <div className="mt-4 max-h-64 overflow-auto rounded-md border border-border">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted/90 text-xs text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2">날짜 (KST)</th>
                        <th className="px-3 py-2 text-right">작성</th>
                        <th className="px-3 py-2 text-right">신규</th>
                        <th className="px-3 py-2 text-right">작성 횟수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.daily.map((row) => (
                        <tr key={row.day} className="border-t border-border/70">
                          <td className="px-3 py-2 tabular-nums">{row.day}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.users.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.newUsers.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.writes.toLocaleString("ko-KR")}</td>
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
) : noSnapshot,
          authors: snapshot ? (
          <Section
            title="작성자 RLS 식별자 (UUID) 및 프로필 토큰"
            count={`${authors.length.toLocaleString("ko-KR")}명 식별`}
          >
            {authorTimeSeries && authorTimeSeries.days.length > 0 && (
              <div className="mb-4">
                <AdminAuthorTimelineChart timeSeries={authorTimeSeries} />
              </div>
            )}
            <AdminAuthorTable authors={authors} />
          </Section>
) : noSnapshot,
          comments: snapshot ? (
          <Section title="댓글" count={countLabel(snapshot.comments)} error={snapshot.comments.error}>
            <div className="mb-3">
              <AdminServiceFilter
                allLabel="전체"
                allHref={adminFilterHref({ posts: postService, comments: null, tab: "comments" })}
                allSelected={commentService === null}
                chips={ADMIN_COMMENT_SERVICES.map((service) => ({
                  key: service,
                  label: ADMIN_SERVICE_LABELS[service],
                  tokenSrc: ADMIN_SERVICE_TOKEN_SRC[service],
                  href: adminFilterHref({ posts: postService, comments: service, tab: "comments" }),
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
) : noSnapshot,
          posts: snapshot ? (
          <Section title="서비스 글" count={countLabel(snapshot.posts)} error={snapshot.posts.error}>
            <div className="mb-3">
              <AdminServiceFilter
                allLabel="전체"
                allHref={adminFilterHref({ posts: null, comments: commentService, tab: "posts" })}
                allSelected={postService === null}
                chips={ADMIN_POST_SERVICES.map((service) => ({
                  key: service,
                  label: ADMIN_SERVICE_LABELS[service],
                  tokenSrc: ADMIN_SERVICE_TOKEN_SRC[service],
                  href: adminFilterHref({ posts: service, comments: commentService, tab: "posts" }),
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
) : noSnapshot,
          nicks: (
<>
      <AdminProfileNicknames
        pools={nicknamePools.pools}
        source={nicknamePools.source}
        canEdit={nicknamePools.canEdit}
        saveResult={nicksSaveResult}
        error={nicknamePools.error}
        onSave={saveProfileCharacterNicknames}
        onReset={resetProfileCharacterNicknames}
      />
</>
          ),
        }}
      />
    </main>
  );
}
