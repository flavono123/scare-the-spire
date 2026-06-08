import Link from "next/link";
import { notFound } from "next/navigation";
import type { PostBlock } from "@/lib/chemical-types";
import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexCards,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROW_LIMIT = 50;
const STATS_SAMPLE_LIMIT = 1000;
const COMMENT_ANALYSIS_LIMIT = 2000;
const ADMIN_DATA_ENV = "production";
const PRODUCTION_SITE_ORIGIN = "https://scare-the-spire.vercel.app";

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
  commentAnalysisRows: QueryState<CommentRow[]>;
  chemicalPosts: QueryState<ChemicalPostRow[]>;
  runs: QueryState<RunRow[]>;
  likes: QueryState<LikeRow[]>;
  commentLikes: QueryState<CommentLikeRow[]>;
  engagementCounts: QueryState<EngagementCountRow[]>;
}

const CODEX_QUERY_TARGETS: Record<string, { path: string; param: string }> = {
  ancient: { path: "ancients", param: "ancient" },
  affliction: { path: "enchantments", param: "affliction" },
  card: { path: "cards", param: "card" },
  enchantment: { path: "enchantments", param: "enchantment" },
  epoch: { path: "epochs", param: "epoch" },
  event: { path: "events", param: "event" },
  potion: { path: "potions", param: "potion" },
  power: { path: "powers", param: "power" },
  relic: { path: "relics", param: "relic" },
};

const CODEX_TYPE_LABELS: Record<string, string> = {
  ancient: "고대의 존재",
  affliction: "고난",
  card: "카드",
  encounter: "전투",
  enchantment: "강화",
  epoch: "연대기",
  event: "이벤트",
  monster: "몬스터",
  potion: "포션",
  power: "파워",
  relic: "유물",
};

const COMMENT_INTENT_RULES = [
  {
    key: "correction",
    label: "오류/정정",
    terms: ["오류", "버그", "잘못", "틀림", "아님", "수정", "누락", "없어야", "있어야", "오타", "표기", "번역", "안됨", "깨짐", "이상", "피드백"],
  },
  {
    key: "question",
    label: "질문",
    terms: ["?", "왜", "어떻게", "무슨", "뭐", "인가", "궁금", "알려", "확인"],
  },
  {
    key: "balance",
    label: "밸런스/평가",
    terms: ["사기", "구림", "좋", "나쁨", "강함", "약함", "너프", "버프", "밸런스", "op", "쓸만", "별로"],
  },
  {
    key: "strategy",
    label: "공략/시너지",
    terms: ["덱", "빌드", "콤보", "시너지", "전략", "운영", "픽", "집으면", "승천", "런", "연계"],
  },
  {
    key: "reaction",
    label: "감상/농담",
    terms: ["ㅋㅋ", "ㅎㅎ", "웃", "재밌", "무섭", "슬서운", "미친", "대박", "귀엽", "멋"],
  },
] as const;

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

function isMissingSchemaItem(error: string | undefined, name: string): boolean {
  return !!error && error.toLowerCase().includes(name.toLowerCase());
}

async function readComments(): Promise<QueryState<CommentRow[]>> {
  const richResult = await readSupabase<CommentRow[]>(
    "admin.comments",
    supabase
      .from("comments")
      .select("id, story_id, user_id, nickname, content, content_blocks, env, created_at", { count: "exact" })
      .eq("env", ADMIN_DATA_ENV)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    [],
  );

  if (!isMissingSchemaItem(richResult.error, "content_blocks")) {
    return richResult;
  }

  const legacyResult = await readSupabase<Omit<CommentRow, "content_blocks">[]>(
    "admin.comments.legacy",
    supabase
      .from("comments")
      .select("id, story_id, user_id, nickname, content, env, created_at", { count: "exact" })
      .eq("env", ADMIN_DATA_ENV)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    [],
  );

  return {
    data: legacyResult.data.map((row) => ({ ...row, content_blocks: null })),
    count: legacyResult.count,
    error: legacyResult.error,
    note: legacyResult.error ? undefined : "`content_blocks` 컬럼 없이 조회했습니다.",
  };
}

async function readCommentsForAnalysis(): Promise<QueryState<CommentRow[]>> {
  const richResult = await readSupabase<CommentRow[]>(
    "admin.comments.analysis",
    supabase
      .from("comments")
      .select("id, story_id, user_id, nickname, content, content_blocks, env, created_at", { count: "exact" })
      .eq("env", ADMIN_DATA_ENV)
      .order("created_at", { ascending: false })
      .limit(COMMENT_ANALYSIS_LIMIT),
    [],
  );

  if (!isMissingSchemaItem(richResult.error, "content_blocks")) {
    return {
      ...richResult,
      note: (richResult.count ?? 0) > richResult.data.length
        ? `최근 ${richResult.data.length.toLocaleString("ko-KR")}개 기준입니다.`
        : "전체 댓글 기준입니다.",
    };
  }

  const legacyResult = await readSupabase<Omit<CommentRow, "content_blocks">[]>(
    "admin.comments.analysis.legacy",
    supabase
      .from("comments")
      .select("id, story_id, user_id, nickname, content, env, created_at", { count: "exact" })
      .eq("env", ADMIN_DATA_ENV)
      .order("created_at", { ascending: false })
      .limit(COMMENT_ANALYSIS_LIMIT),
    [],
  );

  return {
    data: legacyResult.data.map((row) => ({ ...row, content_blocks: null })),
    count: legacyResult.count,
    error: legacyResult.error,
    note: legacyResult.error
      ? undefined
      : (legacyResult.count ?? 0) > legacyResult.data.length
        ? `최근 ${legacyResult.data.length.toLocaleString("ko-KR")}개 기준입니다.`
        : "`content_blocks` 컬럼 없이 전체 댓글 기준입니다.",
  };
}

async function readCommentLikes(): Promise<QueryState<CommentLikeRow[]>> {
  const result = await readSupabase<CommentLikeRow[]>(
    "admin.comment_likes",
    supabase
      .from("comment_likes")
      .select("comment_id, user_id", { count: "exact" })
      .limit(STATS_SAMPLE_LIMIT),
    [],
  );

  if (!isMissingSchemaItem(result.error, "comment_likes")) {
    return result;
  }

  return {
    data: [],
    count: 0,
    note: "`comment_likes` 테이블이 현재 Supabase 스키마에 없습니다.",
  };
}

async function loadAdminSnapshot(): Promise<AdminSnapshot | null> {
  if (!supabaseEnabled) return null;

  const [
    comments,
    commentAnalysisRows,
    chemicalPosts,
    runs,
    likes,
    commentLikes,
    engagementCounts,
  ] = await Promise.all([
    readComments(),
    readCommentsForAnalysis(),
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

  return {
    comments,
    commentAnalysisRows,
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

function commentText(comment: CommentRow): string {
  return (blockText(comment.content_blocks) || comment.content).replace(/\s+/g, " ").trim();
}

function parseStoryTarget(storyId: string): { type: string; id: string; isCodex: boolean } {
  if (storyId.startsWith("sts2-patch:")) {
    return {
      type: "patch",
      id: storyId.slice("sts2-patch:".length),
      isCodex: false,
    };
  }

  const match = /^sts2-codex:([^:]+):(.+)$/.exec(storyId);
  if (!match) {
    return { type: "other", id: storyId, isCodex: false };
  }

  return { type: match[1], id: match[2], isCodex: true };
}

function classifyComment(text: string): string[] {
  const lower = text.toLowerCase();
  const labels = COMMENT_INTENT_RULES
    .filter((rule) => rule.terms.some((term) => lower.includes(term.toLowerCase())))
    .map((rule) => rule.label);
  return labels.length > 0 ? labels : ["기타"];
}

interface AdminEntityLabel {
  name: string;
  nameEn?: string;
}

type AdminEntityLookup = Map<string, AdminEntityLabel>;

function entityLookupKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function addEntitiesToLookup(
  lookup: AdminEntityLookup,
  type: string,
  rows: { id: string; name: string; nameEn?: string }[],
) {
  for (const row of rows) {
    lookup.set(entityLookupKey(type, row.id), {
      name: row.name,
      nameEn: row.nameEn,
    });
  }
}

async function buildAdminEntityLookup(): Promise<AdminEntityLookup> {
  const [
    cards,
    relics,
    potions,
    powers,
    enchantments,
    afflictions,
    events,
    ancients,
    epochs,
    monsters,
    encounters,
  ] = await Promise.all([
    getCodexCards(),
    getCodexRelics(),
    getCodexPotions(),
    getCodexPowers(),
    getCodexEnchantments(),
    getCodexAfflictions(),
    getCodexEvents(),
    getCodexAncients(),
    getCodexEpochs(),
    getCodexMonsters(),
    getCodexEncounters(),
  ]);

  const lookup: AdminEntityLookup = new Map();
  addEntitiesToLookup(lookup, "card", cards);
  addEntitiesToLookup(lookup, "relic", relics);
  addEntitiesToLookup(lookup, "potion", potions);
  addEntitiesToLookup(lookup, "power", powers);
  addEntitiesToLookup(lookup, "enchantment", enchantments);
  addEntitiesToLookup(lookup, "affliction", afflictions);
  addEntitiesToLookup(lookup, "event", events.map((event) => ({
    id: event.id,
    name: event.name,
    nameEn: event.nameEn,
  })));
  addEntitiesToLookup(lookup, "ancient", ancients);
  addEntitiesToLookup(lookup, "epoch", epochs);
  addEntitiesToLookup(lookup, "monster", monsters);
  addEntitiesToLookup(lookup, "encounter", encounters);
  return lookup;
}

function typeLabel(type: string): string {
  if (type === "patch") return "패치";
  if (type === "other") return "기타";
  return CODEX_TYPE_LABELS[type] ?? type;
}

function displayTargetName(type: string, id: string, lookup: AdminEntityLookup): string {
  const label = lookup.get(entityLookupKey(type, id));
  if (!label) return id;
  return label.nameEn && label.nameEn !== label.name ? `${label.name} / ${label.nameEn}` : label.name;
}

interface AnalyzedComment {
  row: CommentRow;
  targetType: string;
  targetId: string;
  targetName: string;
  text: string;
  tags: string[];
  likeCount: number;
}

interface TypeAnalysis {
  type: string;
  label: string;
  count: number;
  targetCount: number;
}

interface TargetAnalysis {
  storyId: string;
  type: string;
  label: string;
  id: string;
  name: string;
  count: number;
  likeCount: number;
  latestAt: string;
  tags: string[];
  samples: string[];
}

interface IntentAnalysis {
  label: string;
  count: number;
}

interface CommentAnalysis {
  total: number;
  sampled: number;
  note?: string;
  byType: TypeAnalysis[];
  topTargets: TargetAnalysis[];
  byIntent: IntentAnalysis[];
  topLikedComments: AnalyzedComment[];
}

function analyzeComments(
  comments: QueryState<CommentRow[]>,
  commentLikes: QueryState<CommentLikeRow[]>,
  lookup: AdminEntityLookup,
): CommentAnalysis {
  const likeCounts = new Map<string, number>();
  for (const row of commentLikes.data) {
    likeCounts.set(row.comment_id, (likeCounts.get(row.comment_id) ?? 0) + 1);
  }

  const analyzed: AnalyzedComment[] = comments.data.map((row) => {
    const target = parseStoryTarget(row.story_id);
    const text = commentText(row);
    return {
      row,
      targetType: target.type,
      targetId: target.id,
      targetName: displayTargetName(target.type, target.id, lookup),
      text,
      tags: classifyComment(text),
      likeCount: likeCounts.get(row.id) ?? 0,
    };
  });

  const byTypeMap = new Map<string, { count: number; targets: Set<string> }>();
  const targetMap = new Map<string, TargetAnalysis>();
  const intentMap = new Map<string, number>();

  for (const item of analyzed) {
    const typeStat = byTypeMap.get(item.targetType) ?? { count: 0, targets: new Set<string>() };
    typeStat.count += 1;
    typeStat.targets.add(item.row.story_id);
    byTypeMap.set(item.targetType, typeStat);

    const targetStat = targetMap.get(item.row.story_id) ?? {
      storyId: item.row.story_id,
      type: item.targetType,
      label: typeLabel(item.targetType),
      id: item.targetId,
      name: item.targetName,
      count: 0,
      likeCount: 0,
      latestAt: item.row.created_at,
      tags: [],
      samples: [],
    };
    targetStat.count += 1;
    targetStat.likeCount += item.likeCount;
    if (new Date(item.row.created_at) > new Date(targetStat.latestAt)) {
      targetStat.latestAt = item.row.created_at;
    }
    targetStat.tags = Array.from(new Set([...targetStat.tags, ...item.tags]));
    if (targetStat.samples.length < 2 && item.text) {
      targetStat.samples.push(truncate(item.text, 88));
    }
    targetMap.set(item.row.story_id, targetStat);

    for (const tag of item.tags) {
      intentMap.set(tag, (intentMap.get(tag) ?? 0) + 1);
    }
  }

  return {
    total: comments.count ?? comments.data.length,
    sampled: comments.data.length,
    note: comments.note,
    byType: Array.from(byTypeMap.entries())
      .map(([type, stat]) => ({
        type,
        label: typeLabel(type),
        count: stat.count,
        targetCount: stat.targets.size,
      }))
      .sort((a, b) => b.count - a.count),
    topTargets: Array.from(targetMap.values())
      .sort((a, b) => b.count - a.count || b.likeCount - a.likeCount)
      .slice(0, 12),
    byIntent: Array.from(intentMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    topLikedComments: analyzed
      .filter((item) => item.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 8),
  };
}

function hrefForStoryId(storyId: string): string | null {
  if (storyId.startsWith("sts2-patch:")) {
    return productionHref(`/patches/${storyId.slice("sts2-patch:".length)}`);
  }

  const match = /^sts2-codex:([^:]+):(.+)$/.exec(storyId);
  if (!match) return null;

  const [, type, id] = match;
  const normalizedId = encodeURIComponent(id.toLowerCase());

  if (type === "monster") {
    return productionHref(`/compendium/bestiary?monster=${normalizedId}`);
  }

  if (type === "encounter") {
    return productionHref(`/compendium/bestiary?view=encounters&encounter=${normalizedId}`);
  }

  const target = CODEX_QUERY_TARGETS[type];
  return target
    ? productionHref(`/compendium/${target.path}?${target.param}=${normalizedId}`)
    : null;
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

function RatioBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className="h-1.5 rounded-full bg-yellow-400/80"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {tag}
        </span>
      ))}
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
  const entityLookup = snapshot ? await buildAdminEntityLookup() : new Map<string, AdminEntityLabel>();
  const commentAnalysis = snapshot
    ? analyzeComments(snapshot.commentAnalysisRows, snapshot.commentLikes, entityLookup)
    : null;
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
            <div>data: <code className="text-yellow-300">{ADMIN_DATA_ENV}</code></div>
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

          <Section title="댓글" count={countLabel(snapshot.comments)} error={snapshot.comments.error}>
            {commentAnalysis && (
              <div className="mb-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="분석 댓글"
                    value={commentAnalysis.sampled.toLocaleString("ko-KR")}
                    detail={`전체 ${commentAnalysis.total.toLocaleString("ko-KR")}개 중 ${commentAnalysis.note ?? "샘플 기준"}`}
                  />
                  <StatTile
                    label="댓글 달린 위치"
                    value={commentAnalysis.topTargets.length.toLocaleString("ko-KR")}
                    detail="상위 12개 표시"
                  />
                  <StatTile
                    label="가장 많은 유형"
                    value={commentAnalysis.byType[0]?.label ?? "-"}
                    detail={commentAnalysis.byType[0] ? `${commentAnalysis.byType[0].count.toLocaleString("ko-KR")}개 댓글` : undefined}
                  />
                  <StatTile
                    label="주요 성격"
                    value={commentAnalysis.byIntent[0]?.label ?? "-"}
                    detail={commentAnalysis.byIntent[0] ? `${commentAnalysis.byIntent[0].count.toLocaleString("ko-KR")}개 매칭` : undefined}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
                  <div className="rounded-md border border-border bg-card/30 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-yellow-300">유형별 댓글 분포</h3>
                    <div className="space-y-3">
                      {commentAnalysis.byType.map((row) => (
                        <div key={row.type} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span>{row.label}</span>
                            <span className="text-muted-foreground">
                              {row.count.toLocaleString("ko-KR")}개 · {row.targetCount.toLocaleString("ko-KR")}곳
                            </span>
                          </div>
                          <RatioBar value={row.count} max={commentAnalysis.byType[0]?.count ?? row.count} />
                        </div>
                      ))}
                      {commentAnalysis.byType.length === 0 && (
                        <p className="text-xs text-muted-foreground">분석할 댓글이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card/30 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-yellow-300">내용 성격 태그</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {commentAnalysis.byIntent.map((row) => (
                        <div key={row.label} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span>{row.label}</span>
                            <span className="text-muted-foreground">{row.count.toLocaleString("ko-KR")}</span>
                          </div>
                          <div className="mt-2">
                            <RatioBar value={row.count} max={commentAnalysis.byIntent[0]?.count ?? row.count} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">위치</th>
                        <th className="px-3 py-2">이름</th>
                        <th className="px-3 py-2 text-right">댓글</th>
                        <th className="px-3 py-2 text-right">댓글 좋아요</th>
                        <th className="px-3 py-2">성격</th>
                        <th className="px-3 py-2">대표 내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commentAnalysis.topTargets.map((target) => (
                        <tr key={target.storyId} className="border-t border-border/70 align-top">
                          <td className="px-3 py-2">
                            <div className="text-xs text-muted-foreground">{target.label}</div>
                            <StoryLink storyId={target.storyId} />
                          </td>
                          <td className="px-3 py-2">{target.name}</td>
                          <td className="px-3 py-2 text-right">{target.count.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 text-right">{target.likeCount.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2"><TagList tags={target.tags} /></td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {target.samples.map((sample) => (
                              <div key={sample} className="mb-1 last:mb-0">{sample}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {commentAnalysis.topLikedComments.length > 0 && (
                  <div className="rounded-md border border-border bg-card/30 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-yellow-300">댓글 좋아요가 있는 댓글</h3>
                    <div className="space-y-2">
                      {commentAnalysis.topLikedComments.map((item) => (
                        <div key={item.row.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="text-muted-foreground">
                              {typeLabel(item.targetType)} · {item.targetName}
                            </div>
                            <div className="text-yellow-300">좋아요 {item.likeCount.toLocaleString("ko-KR")}</div>
                          </div>
                          <div className="text-sm">{truncate(item.text, 180)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                      <td className="px-3 py-2 text-yellow-200">{comment.nickname}</td>
                      <td className="px-3 py-2"><StoryLink storyId={comment.story_id} /></td>
                      <td className="px-3 py-2">{truncate(blockText(comment.content_blocks) || comment.content)}</td>
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

          <Section title="케미컬 X" count={countLabel(snapshot.chemicalPosts)} error={snapshot.chemicalPosts.error}>
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
