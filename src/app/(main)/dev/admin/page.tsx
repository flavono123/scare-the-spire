import Link from "next/link";
import { notFound } from "next/navigation";
import type { PostBlock } from "@/lib/chemical-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROW_LIMIT = 50;
const STATS_SAMPLE_LIMIT = 1000;

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
}

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

interface AdminSnapshot {
  comments: QueryState<CommentRow[]>;
  chemicalPosts: QueryState<ChemicalPostRow[]>;
  runs: QueryState<RunRow[]>;
  likes: QueryState<LikeRow[]>;
  commentLikes: QueryState<CommentLikeRow[]>;
  engagementCounts: QueryState<EngagementCountRow[]>;
}

const CODEX_PATHS: Record<string, string> = {
  ancient: "ancients",
  card: "cards",
  encounter: "encounters",
  enchantment: "enchantments",
  event: "events",
  monster: "monsters",
  potion: "potions",
  power: "powers",
  relic: "relics",
};

const MANAGED_SUPABASE_CONTENT = [
  { name: "댓글", table: "comments", scope: "env 분리", admin: "최신순 목록" },
  { name: "케미컬 X", table: "chemical_posts", scope: "env 분리", admin: "최신순 목록" },
  { name: "공유 런", table: "runs", scope: "env 분리", admin: "최신순 목록" },
  { name: "좋아요", table: "likes", scope: "env 분리", admin: "통계" },
  { name: "댓글 좋아요", table: "comment_likes", scope: "env 컬럼 없음", admin: "통계" },
] as const;

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

async function loadAdminSnapshot(): Promise<AdminSnapshot | null> {
  if (!supabaseEnabled) return null;

  const [
    comments,
    chemicalPosts,
    runs,
    likes,
    commentLikes,
    engagementCounts,
  ] = await Promise.all([
    readSupabase<CommentRow[]>(
      "admin.comments",
      supabase
        .from("comments")
        .select("id, story_id, user_id, nickname, content, content_blocks, env, created_at", { count: "exact" })
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<ChemicalPostRow[]>(
      "admin.chemical_posts",
      supabase
        .from("chemical_posts")
        .select("id, user_id, nickname, content, content_text, env, created_at", { count: "exact" })
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<RunRow[]>(
      "admin.runs",
      supabase
        .from("runs")
        .select("id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, donor_user_id, env, created_at", { count: "exact" })
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      [],
    ),
    readSupabase<LikeRow[]>(
      "admin.likes",
      supabase
        .from("likes")
        .select("story_id, user_id, created_at", { count: "exact" })
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(STATS_SAMPLE_LIMIT),
      [],
    ),
    readSupabase<CommentLikeRow[]>(
      "admin.comment_likes",
      supabase
        .from("comment_likes")
        .select("comment_id, user_id", { count: "exact" })
        .limit(STATS_SAMPLE_LIMIT),
      [],
    ),
    readSupabase<EngagementCountRow[]>(
      "admin.engagement_counts",
      supabase.rpc("get_engagement_counts", { p_env: supabaseEnv }),
      [],
    ),
  ]);

  return {
    comments,
    chemicalPosts,
    runs,
    likes,
    commentLikes,
    engagementCounts,
  };
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
    return block.text;
  }).join("");
}

function hrefForStoryId(storyId: string): string | null {
  if (storyId.startsWith("sts2-patch:")) {
    return `/patches/${storyId.slice("sts2-patch:".length)}`;
  }

  const match = /^sts2-codex:([^:]+):(.+)$/.exec(storyId);
  if (!match) return null;

  const [, type, id] = match;
  const path = CODEX_PATHS[type];
  return path ? `/codex/${path}/${id}` : null;
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
        <h2 className="text-lg font-semibold text-yellow-400">{title}</h2>
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

export default async function SupabaseAdminPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const snapshot = await loadAdminSnapshot();
  const topStories = topLikedStories(snapshot?.engagementCounts.data ?? []);
  const uniqueLikeUsers = new Set(snapshot?.likes.data.map((row) => row.user_id) ?? []).size;
  const uniqueCommentLikeUsers = new Set(snapshot?.commentLikes.data.map((row) => row.user_id) ?? []).size;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-yellow-400">DEV ONLY</span>
            <h1 className="mt-1 text-2xl font-bold">Supabase Admin</h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>env: <code className="text-yellow-300">{supabaseEnv}</code></div>
            <div>limit: latest {ROW_LIMIT}</div>
          </div>
        </div>
      </div>

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
            <h2 className="mb-3 text-lg font-semibold text-yellow-400">좋아요 통계</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="스토리 좋아요"
                value={(snapshot.likes.count ?? snapshot.likes.data.length).toLocaleString("ko-KR")}
                detail={`최근 샘플 사용자 ${uniqueLikeUsers.toLocaleString("ko-KR")}명`}
              />
              <StatTile
                label="좋아요가 있는 글"
                value={topStories.length.toLocaleString("ko-KR")}
                detail="get_engagement_counts RPC 기준"
              />
              <StatTile
                label="댓글 좋아요"
                value={(snapshot.commentLikes.count ?? snapshot.commentLikes.data.length).toLocaleString("ko-KR")}
                detail={`env 미분리, 샘플 사용자 ${uniqueCommentLikeUsers.toLocaleString("ko-KR")}명`}
              />
              <StatTile
                label="최근 좋아요"
                value={snapshot.likes.data[0] ? formatDate(snapshot.likes.data[0].created_at) : "-"}
              />
            </div>
            <ErrorLine error={snapshot.likes.error ?? snapshot.commentLikes.error ?? snapshot.engagementCounts.error} />
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

          <Section title="댓글" count={countLabel(snapshot.comments)} error={snapshot.comments.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
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
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(comment.created_at)}</td>
                      <td className="px-3 py-2 text-yellow-200">{comment.nickname}</td>
                      <td className="px-3 py-2"><StoryLink storyId={comment.story_id} /></td>
                      <td className="px-3 py-2">{truncate(blockText(comment.content_blocks) || comment.content)}</td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{comment.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.comments.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={5}>댓글 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="케미컬 X" count={countLabel(snapshot.chemicalPosts)} error={snapshot.chemicalPosts.error}>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">작성일</th>
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
                      <td className="px-3 py-2 text-lime-200">{post.nickname}</td>
                      <td className="px-3 py-2">{truncate(blockText(post.content) || post.content_text, 80)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/chemical-x/${post.id}`} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {post.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><code className="text-[10px] text-muted-foreground">{post.user_id}</code></td>
                    </tr>
                  ))}
                  {snapshot.chemicalPosts.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={5}>케미컬 X 없음</td>
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
                      <td className={run.win ? "px-3 py-2 text-emerald-300" : "px-3 py-2 text-red-300"}>{run.win ? "승리" : "패배"}</td>
                      <td className="px-3 py-2">{run.character}</td>
                      <td className="px-3 py-2">A{run.ascension}</td>
                      <td className="px-3 py-2">{run.total_floors}</td>
                      <td className="px-3 py-2">{formatDuration(run.run_time)}</td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{run.build}</code></td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{run.seed}</code></td>
                      <td className="px-3 py-2">
                        <Link href={`/history-course/${run.id}`} prefetch={false} className="text-cyan-300 underline-offset-4 hover:underline">
                          {run.id}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {snapshot.runs.data.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={9}>공유 런 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Supabase 관리 컨텐츠 확인">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">컨텐츠</th>
                    <th className="px-3 py-2">테이블</th>
                    <th className="px-3 py-2">스코프</th>
                    <th className="px-3 py-2">admin 처리</th>
                  </tr>
                </thead>
                <tbody>
                  {MANAGED_SUPABASE_CONTENT.map((item) => (
                    <tr key={item.table} className="border-t border-border/70">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2"><code className="text-[11px] text-muted-foreground">{item.table}</code></td>
                      <td className="px-3 py-2 text-muted-foreground">{item.scope}</td>
                      <td className="px-3 py-2">{item.admin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              코드와 마이그레이션 기준으로 추가 확인된 Supabase 컨텐츠는 댓글 좋아요(`comment_likes`)입니다. `auth.users`는 각 row의 user_id/donor_user_id 참조용 인프라로만 쓰입니다.
            </p>
          </Section>
        </>
      )}
    </main>
  );
}
