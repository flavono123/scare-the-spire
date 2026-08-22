import "server-only";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { PostBlock } from "@/lib/chemical-types";
import type {
  ContactCategory,
  ContactInquiryEnv,
  ContactInquiryStatus,
} from "@/lib/contact-inquiries";
import { historyRunPlainText } from "@/lib/history-run-reference";
import { COMMENT_MAX_CHARS } from "@/lib/content-limits";
import { devToolsEnabled } from "@/lib/dev-tools";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { getSiteOrigin } from "@/lib/site-origin";
import { contactMessages } from "@/messages/contact";

const ROW_LIMIT = 50;
const CONTACT_ROW_LIMIT = 100;
const STATS_SAMPLE_LIMIT = 1000;
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

interface ChemicalPostRow {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
}

interface ComboPostRow {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  resources: Array<{
    type: string;
    id: string;
  }>;
  env: string;
  created_at: string;
}

interface TransfigurePostRow {
  id: string;
  user_id: string;
  nickname: string;
  resource_type: string;
  resource_id: string;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
}

interface CommunityStoryRow {
  id: string;
  user_id: string | null;
  nickname: string;
  sentence: string;
  game: string;
  entity_type: string | null;
  entity_id: string | null;
  source: string | null;
  env: string;
  created_at: string;
}

interface ThisOrThatPostRow {
  id: string;
  user_id: string;
  nickname: string;
  left_type: string;
  left_id: string;
  right_type: string;
  right_id: string;
  reason: string;
  env: string;
  created_at: string;
}

interface ThisOrThatVoteSummaryRow {
  post_id: string;
  left_count: number | string;
  right_count: number | string;
  total_count: number | string;
}

type ThisOrThatVoteTotalsRow = Omit<ThisOrThatVoteSummaryRow, "post_id">;

interface RunRow {
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
  donor_user_id: string | null;
  env: string;
  created_at: string;
}

interface LikeRow {
  story_id: string;
  user_id: string;
  env: string;
  created_at: string;
}

interface CommentLikeRow {
  comment_id: string;
  user_id: string;
}

interface EngagementCountRow {
  story_id: string;
  like_count: number | string;
  comment_count: number | string;
}

interface QueryState<T> {
  data: T;
  count?: number;
  error?: string;
  note?: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

interface AdminSnapshot {
  comments: QueryState<CommentRow[]>;
  communityStories: QueryState<CommunityStoryRow[]>;
  thisOrThatPosts: QueryState<ThisOrThatPostRow[]>;
  thisOrThatVotes: QueryState<ThisOrThatVoteSummaryRow[]>;
  thisOrThatVoteTotals: QueryState<ThisOrThatVoteTotalsRow[]>;
  chemicalPosts: QueryState<ChemicalPostRow[]>;
  comboPosts: QueryState<ComboPostRow[]>;
  transfigurePosts: QueryState<TransfigurePostRow[]>;
  runs: QueryState<RunRow[]>;
  likes: QueryState<LikeRow[]>;
  commentLikes: QueryState<CommentLikeRow[]>;
  engagementCounts: QueryState<EngagementCountRow[]>;
}

const CODEX_PATHS: Record<string, string> = {
  ancient: "ancients",
  affliction: "enchantments",
  card: "cards",
  encounter: "encounters",
  enchantment: "enchantments",
  epoch: "epochs",
  event: "events",
  monster: "monsters",
  potion: "potions",
  power: "powers",
  relic: "relics",
};

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
      // ponytail: show the latest 100 in one dev-only page; add pagination if the mailbox grows.
      .limit(CONTACT_ROW_LIMIT),
    [],
  );
}

async function readComments(): Promise<QueryState<CommentRow[]>> {
  return readSupabase<CommentRow[]>(
    "admin.comments",
    supabase
      .from("comments")
      .select("id, story_id, user_id, nickname, content, content_blocks, env, created_at", { count: "exact" })
      .eq("env", ADMIN_DATA_ENV)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    [],
  );
}

async function readCommentLikes(): Promise<QueryState<CommentLikeRow[]>> {
  return readSupabase<CommentLikeRow[]>(
    "admin.comment_likes",
    supabase
      .from("comment_likes")
      .select("comment_id, user_id", { count: "exact" })
      .limit(STATS_SAMPLE_LIMIT),
    [],
  );
}

async function loadAdminSnapshot(): Promise<AdminSnapshot | null> {
  if (!supabaseEnabled) return null;

  const [
    comments,
    communityStories,
    thisOrThatPosts,
    thisOrThatVoteTotals,
    chemicalPosts,
    comboPosts,
    transfigurePosts,
    runs,
    likes,
    commentLikes,
    engagementCounts,
  ] = await Promise.all([
    readComments(),
    readSupabase<CommunityStoryRow[]>(
      "admin.community_stories",
      supabase
        .from("community_stories")
        .select("id, user_id, nickname, sentence, game, entity_type, entity_id, source, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .is("static_story_id", null)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<ThisOrThatPostRow[]>(
      "admin.this_or_that_posts",
      supabase
        .from("this_or_that_posts")
        .select("id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<ThisOrThatVoteTotalsRow[]>(
      "admin.this_or_that_vote_totals",
      supabase.rpc("get_this_or_that_vote_totals", { p_env: ADMIN_DATA_ENV }),
      [],
    ),
    readSupabase<ChemicalPostRow[]>(
      "admin.chemical_posts",
      supabase
        .from("chemical_posts")
        .select("id, user_id, nickname, content, content_text, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<ComboPostRow[]>(
      "admin.combo_posts",
      supabase
        .from("combo_posts")
        .select("id, user_id, nickname, content, content_text, resources, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<TransfigurePostRow[]>(
      "admin.transfigure_posts",
      supabase
        .from("transfigure_posts")
        .select("id, user_id, nickname, resource_type, resource_id, content, content_text, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<RunRow[]>(
      "admin.runs",
      supabase
        .from("runs")
        .select("id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, donor_user_id, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<LikeRow[]>(
      "admin.likes",
      supabase
        .from("likes")
        .select("story_id, user_id, env, created_at", { count: "exact" })
        .eq("env", ADMIN_DATA_ENV)
        .order("created_at", { ascending: false })
        .limit(STATS_SAMPLE_LIMIT),
      [],
    ),
    readCommentLikes(),
    readSupabase<EngagementCountRow[]>(
      "admin.engagement_counts",
      supabase.rpc("get_engagement_counts", { p_env: ADMIN_DATA_ENV }),
      [],
    ),
  ]);
  const thisOrThatVotes = await readSupabase<ThisOrThatVoteSummaryRow[]>(
    "admin.this_or_that_votes",
    supabase.rpc("get_this_or_that_vote_summaries", {
      p_post_ids: thisOrThatPosts.data.map((post) => post.id),
      p_env: ADMIN_DATA_ENV,
    }),
    [],
  );

  return {
    comments,
    communityStories,
    thisOrThatPosts,
    thisOrThatVotes,
    thisOrThatVoteTotals,
    chemicalPosts,
    comboPosts,
    transfigurePosts,
    runs,
    likes,
    commentLikes,
    engagementCounts,
  };
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
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

function hrefForStoryId(storyId: string): string | null {
  if (storyId.startsWith("sts2-patch:")) {
    return productionHref(`/patches/${storyId.slice("sts2-patch:".length)}`);
  }

  const match = /^sts2-codex:([^:]+):(.+)$/.exec(storyId);
  if (!match) return null;

  const [, type, id] = match;
  const normalizedId = encodeURIComponent(id.toLowerCase());

  const path = CODEX_PATHS[type];
  return path ? productionHref(`/compendium/${path}/${normalizedId}`) : null;
}

function productionHref(path: string): string {
  return `${PRODUCTION_SITE_ORIGIN}${path}`;
}

function countLabel(state: QueryState<unknown[]>): string {
  const total = state.count ?? state.data.length;
  if (state.count === undefined) return `${total.toLocaleString("ko-KR")}개`;
  return `${total.toLocaleString("ko-KR")}개`;
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function topLikedStories(rows: EngagementCountRow[]): EngagementCountRow[] {
  return rows
    .filter((row) => numberValue(row.like_count) > 0)
    .sort((a, b) => numberValue(b.like_count) - numberValue(a.like_count))
    .slice(0, 8);
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

function StoryLink({ storyId }: { storyId: string }) {
  const href = hrefForStoryId(storyId);
  if (!href) return <code className="text-[11px] text-muted-foreground">{storyId}</code>;
  return (
    <Link
      href={href}
      prefetch={false}
      className="text-[11px] text-cyan-300 underline-offset-4 hover:underline"
    >
      {storyId}
    </Link>
  );
}

export const metadata = {
  title: "Supabase Admin — DEV",
  description: "개발 전용 Supabase 컨텐츠 확인 페이지",
};

export default async function SupabaseAdminPage({
  contactSaveResult,
}: {
  contactSaveResult?: "saved" | "error";
}) {
  if (!devToolsEnabled()) {
    notFound();
  }

  const [snapshot, contactInquiries] = await Promise.all([
    loadAdminSnapshot(),
    readContactInquiries(),
  ]);
  const contactRows = contactInquiries?.data ?? [];
  const topStories = topLikedStories(snapshot?.engagementCounts.data ?? []);
  const uniqueLikeUsers = new Set(snapshot?.likes.data.map((row) => row.user_id) ?? []).size;
  const uniqueCommentLikeUsers = new Set(snapshot?.commentLikes.data.map((row) => row.user_id) ?? []).size;
  const thisOrThatVotesByPost = new Map(
    snapshot?.thisOrThatVotes.data.map((row) => [row.post_id, row]) ?? [],
  );
  const totalThisOrThatVotes = numberValue(snapshot?.thisOrThatVoteTotals.data[0]?.total_count);

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
            `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되면 이 페이지에서 dev 데이터를 조회합니다.
          </p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-primary">좋아요 통계</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="스토리 좋아요"
                value={(snapshot.likes.count ?? snapshot.likes.data.length).toLocaleString("ko-KR")}
                detail={`최근 샘플 사용자 ${uniqueLikeUsers.toLocaleString("ko-KR")}명`}
              />
              <StatTile
                label="좋아요가 있는 글"
                value={topStories.length.toLocaleString("ko-KR")}
                detail={snapshot.engagementCounts.note ?? "get_engagement_counts RPC 기준"}
              />
              <StatTile
                label="댓글 좋아요"
                value={(snapshot.commentLikes.count ?? snapshot.commentLikes.data.length).toLocaleString("ko-KR")}
                detail={snapshot.commentLikes.note ?? `env 미분리, 샘플 사용자 ${uniqueCommentLikeUsers.toLocaleString("ko-KR")}명`}
              />
              <StatTile
                label="최근 좋아요"
                value={snapshot.likes.data[0] ? formatDate(snapshot.likes.data[0].created_at) : "-"}
              />
            </div>
            <ErrorLine error={snapshot.likes.error ?? snapshot.engagementCounts.error} />
            {topStories.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">story_id</th>
                      <th className="px-3 py-2 text-right">좋아요</th>
                      <th className="px-3 py-2 text-right">댓글</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStories.map((row) => (
                      <tr key={row.story_id} className="border-t border-border/70">
                        <td className="px-3 py-2"><StoryLink storyId={row.story_id} /></td>
                        <td className="px-3 py-2 text-right">{numberValue(row.like_count).toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-2 text-right">{numberValue(row.comment_count).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-10 border-t border-border/70 pt-6">
            <h2 className="text-xl font-semibold text-primary">서비스별 최신 작성글</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              production 환경의 작성글을 서비스마다 최신 {ROW_LIMIT}개까지 표시합니다.
            </p>
          </div>

          <Section title="최신 댓글" count={countLabel(snapshot.comments)} error={snapshot.comments.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">위치</th>
                    <th className="px-3 py-2">내용</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.comments.data.map((comment) => (
                    <tr key={comment.id} className="border-t border-border/70 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(comment.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{comment.env}</code></td>
                      <td className="px-3 py-2 text-primary">{comment.nickname}</td>
                      <td className="px-3 py-2"><StoryLink storyId={comment.story_id} /></td>
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

          <Section title="슬서운 이야기" count={countLabel(snapshot.communityStories)} error={snapshot.communityStories.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">문장</th>
                    <th className="px-3 py-2">대상</th>
                    <th className="px-3 py-2">source</th>
                    <th className="px-3 py-2">story</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.communityStories.data.map((story) => (
                    <tr key={story.id} className="border-t border-border/70 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(story.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{story.env}</code></td>
                      <td className="px-3 py-2 text-primary">{story.nickname}</td>
                      <td className="px-3 py-2">{truncate(story.sentence)}</td>
                      <td className="px-3 py-2">
                        <code className="text-[11px] text-muted-foreground">
                          {story.entity_type && story.entity_id ? `${story.entity_type}:${story.entity_id}` : story.game}
                        </code>
                      </td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{story.source ?? "-"}</code></td>
                      <td className="px-3 py-2">
                        <Link href={productionHref(`/#community:${story.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {story.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{story.user_id ?? "-"}</code></td>
                    </tr>
                  ))}
                  {snapshot.communityStories.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={8}>작성된 이야기가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="이거 아님 저거?"
            count={`${countLabel(snapshot.thisOrThatPosts)} · ${totalThisOrThatVotes.toLocaleString("ko-KR")}표`}
            error={snapshot.thisOrThatPosts.error ?? snapshot.thisOrThatVotes.error ?? snapshot.thisOrThatVoteTotals.error}
          >
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">이거</th>
                    <th className="px-3 py-2">저거</th>
                    <th className="px-3 py-2 text-right">이거 표</th>
                    <th className="px-3 py-2 text-right">저거 표</th>
                    <th className="px-3 py-2 text-right">총 표</th>
                    <th className="px-3 py-2">이유</th>
                    <th className="px-3 py-2">post</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.thisOrThatPosts.data.map((post) => {
                    const votes = thisOrThatVotesByPost.get(post.id);
                    return (
                      <tr key={post.id} className="border-t border-border/70 align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(post.created_at)}</td>
                        <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.env}</code></td>
                        <td className="px-3 py-2 text-orange-200">{post.nickname}</td>
                        <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{post.left_type}:{post.left_id}</code></td>
                        <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{post.right_type}:{post.right_id}</code></td>
                        <td className="px-3 py-2 text-right tabular-nums spire-aqua">{numberValue(votes?.left_count).toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-2 text-right tabular-nums spire-pink">{numberValue(votes?.right_count).toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{numberValue(votes?.total_count).toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-2">{truncate(post.reason, 100)}</td>
                        <td className="px-3 py-2">
                          <Link href={productionHref(`/this-or-that/${post.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                            {post.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.user_id}</code></td>
                      </tr>
                    );
                  })}
                  {snapshot.thisOrThatPosts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={11}>이거저거 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="케미컬X" count={countLabel(snapshot.chemicalPosts)} error={snapshot.chemicalPosts.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">내용</th>
                    <th className="px-3 py-2">post</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.chemicalPosts.data.map((post) => (
                    <tr key={post.id} className="border-t border-border/70 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(post.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.env}</code></td>
                      <td className="px-3 py-2 text-lime-200">{post.nickname}</td>
                      <td className="px-3 py-2">{truncate(blockText(post.content) || post.content_text, 80)}</td>
                      <td className="px-3 py-2">
                        <Link href={productionHref(`/chemical-x/${post.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {post.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.chemicalPosts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>케미컬 X 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="코오오옴보" count={countLabel(snapshot.comboPosts)} error={snapshot.comboPosts.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">게임 요소</th>
                    <th className="px-3 py-2">내용</th>
                    <th className="px-3 py-2">post</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.comboPosts.data.map((post) => (
                    <tr key={post.id} className="border-t border-border/70 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(post.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.env}</code></td>
                      <td className="px-3 py-2 text-cyan-200">{post.nickname}</td>
                      <td className="px-3 py-2">
                        <code className="text-[11px] text-muted-foreground">
                          {truncate(post.resources.map((resource) => `${resource.type}:${resource.id}`).join(", "), 100)}
                        </code>
                      </td>
                      <td className="px-3 py-2">{truncate(blockText(post.content) || post.content_text, 100)}</td>
                      <td className="px-3 py-2">
                        <Link href={productionHref(`/c-c-c-combo/${post.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {post.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.comboPosts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={7}>코오오옴보 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="변형" count={countLabel(snapshot.transfigurePosts)} error={snapshot.transfigurePosts.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">닉네임</th>
                    <th className="px-3 py-2">대상</th>
                    <th className="px-3 py-2">내용</th>
                    <th className="px-3 py-2">post</th>
                    <th className="px-3 py-2">user_id</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.transfigurePosts.data.map((post) => (
                    <tr key={post.id} className="border-t border-border/70 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(post.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.env}</code></td>
                      <td className="px-3 py-2 text-fuchsia-200">{post.nickname}</td>
                      <td className="px-3 py-2">
                        <code className="text-[11px] text-muted-foreground">{post.resource_type}:{post.resource_id}</code>
                      </td>
                      <td className="px-3 py-2">{truncate(blockText(post.content) || post.content_text, 100)}</td>
                      <td className="px-3 py-2">
                        <Link href={productionHref(`/transfigure/${post.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {post.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.transfigurePosts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={7}>변형 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="공유 런" count={countLabel(snapshot.runs)} error={snapshot.runs.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">공유일</th>
                    <th className="px-3 py-2">env</th>
                    <th className="px-3 py-2">결과</th>
                    <th className="px-3 py-2">캐릭터</th>
                    <th className="px-3 py-2">승천</th>
                    <th className="px-3 py-2">층</th>
                    <th className="px-3 py-2">시간</th>
                    <th className="px-3 py-2">빌드</th>
                    <th className="px-3 py-2">seed</th>
                    <th className="px-3 py-2">run</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.runs.data.map((run) => (
                    <tr key={run.id} className="border-t border-border/70">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(run.created_at)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{run.env}</code></td>
                      <td className={run.win ? "px-3 py-2 text-emerald-300" : "px-3 py-2 text-red-300"}>{run.win ? "승리" : "패배"}</td>
                      <td className="px-3 py-2">{run.character}</td>
                      <td className="px-3 py-2">A{run.ascension}</td>
                      <td className="px-3 py-2">{run.total_floors}</td>
                      <td className="px-3 py-2">{formatDuration(run.run_time)}</td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{run.build}</code></td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{run.seed}</code></td>
                      <td className="px-3 py-2">
                        <Link href={productionHref(`/history-course/${run.id}`)} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {run.id}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {snapshot.runs.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={10}>공유 런 없음</td>
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
