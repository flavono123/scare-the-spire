import { BYRDISPATCH_ICON } from "@/lib/byrdispatch-static";
import {
  COMMENT_THREAD_SERVICE_PREFIX,
  COMMENT_THREAD_SERVICES,
  commentThreadService,
  type CommentThreadService,
} from "@/lib/comment-threads";
import {
  DEFRAGMENT_FEDERATED_SERVICES,
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_TOKEN_SRC,
  type DefragmentFederatedService,
} from "@/lib/defragment";

export const ADMIN_POST_SERVICES = [
  "stories",
  ...DEFRAGMENT_FEDERATED_SERVICES,
  "history_course",
] as const;

export type AdminPostService = (typeof ADMIN_POST_SERVICES)[number];

export const ADMIN_COMMENT_SERVICES = COMMENT_THREAD_SERVICES;

export const ADMIN_METRIC_SERVICES = [
  "site",
  ...ADMIN_POST_SERVICES,
  "patches",
  "compendium",
  "byrdispatch",
  "defragment",
  "contact",
  "other",
] as const;

export type AdminMetricService = (typeof ADMIN_METRIC_SERVICES)[number];

const STORIES_TOKEN_SRC = "/images/sts2/ui/topbar/submenu_history_icon.png";
const PATCHES_TOKEN_SRC = "/images/sts2/nav/patch_notes_icon.png";
const COMPENDIUM_TOKEN_SRC = "/images/sts2/nav/stats_cards.png";
const OTHER_TOKEN_SRC = "/images/sts2/nav/question_mark.png";

export const ADMIN_SERVICE_LABELS: Record<Exclude<AdminMetricService, "site">, string> = {
  stories: "슬서운 이야기",
  combo: "코오오옴보",
  transfigure: "변형",
  this_or_that: "이거 아님 저거?",
  chemical_x: "케미컬X",
  decisions_decisions: "어려운 결정",
  favorite_tournament: "이아저? 월드컵",
  history_course: "역사 강의서",
  patches: "슬서운변경",
  compendium: "백과사전",
  byrdispatch: "섀소식",
  defragment: "조각모음",
  contact: "문의",
  other: "기타",
};

export const ADMIN_SERVICE_TOKEN_SRC: Record<Exclude<AdminMetricService, "site">, string> = {
  stories: STORIES_TOKEN_SRC,
  combo: DEFRAGMENT_FEED_SERVICE_META.combo.tokenSrc,
  transfigure: DEFRAGMENT_FEED_SERVICE_META.transfigure.tokenSrc,
  this_or_that: DEFRAGMENT_FEED_SERVICE_META.this_or_that.tokenSrc,
  chemical_x: DEFRAGMENT_FEED_SERVICE_META.chemical_x.tokenSrc,
  decisions_decisions: DEFRAGMENT_FEED_SERVICE_META.decisions_decisions.tokenSrc,
  favorite_tournament: DEFRAGMENT_FEED_SERVICE_META.favorite_tournament.tokenSrc,
  history_course: "/images/sts2/relics/history_course.webp",
  patches: PATCHES_TOKEN_SRC,
  compendium: COMPENDIUM_TOKEN_SRC,
  byrdispatch: BYRDISPATCH_ICON,
  defragment: DEFRAGMENT_TOKEN_SRC,
  contact: OTHER_TOKEN_SRC,
  other: OTHER_TOKEN_SRC,
};

export function isAdminPostService(value: string | null | undefined): value is AdminPostService {
  return ADMIN_POST_SERVICES.includes(value as AdminPostService);
}

export function isAdminCommentService(
  value: string | null | undefined,
): value is CommentThreadService {
  return ADMIN_COMMENT_SERVICES.includes(value as CommentThreadService);
}

export function isDefragmentAdminPostService(
  value: string,
): value is DefragmentFederatedService {
  return DEFRAGMENT_FEDERATED_SERVICES.includes(value as DefragmentFederatedService);
}

export function adminServicePostHref(service: AdminPostService, id: string): string {
  if (service === "stories") return `/#community:${id}`;
  if (service === "history_course") return `/history-course/${id}`;
  if (isDefragmentAdminPostService(service)) {
    return `${DEFRAGMENT_FEED_SERVICE_META[service].hrefBase}/${id}`;
  }
  return `/${service}/${id}`;
}

export type AdminServicePostRow = {
  id: string;
  service: AdminPostService;
  createdAt: string;
  nickname: string;
  summary: string;
  href: string;
  userId: string;
};

export function mergeAdminServicePosts(
  rows: AdminServicePostRow[],
): AdminServicePostRow[] {
  return [...rows].sort((left, right) => {
    const byDate = right.createdAt.localeCompare(left.createdAt);
    if (byDate !== 0) return byDate;
    return right.id.localeCompare(left.id);
  });
}

export function adminFilterHref(options: {
  posts?: string | null;
  comments?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options.posts) params.set("posts", options.posts);
  if (options.comments) params.set("comments", options.comments);
  const query = params.toString();
  return query ? `/dev/admin?${query}` : "/dev/admin";
}

export type CommentStoryFilter =
  | { kind: "eq"; value: string }
  | { kind: "like"; value: string }
  | { kind: "other" };

export function commentStoryFilter(
  service: CommentThreadService | null,
): CommentStoryFilter | null {
  if (!service) return null;
  if (service === "byrdispatch") return { kind: "eq", value: "byrdispatch" };
  if (service === "other") return { kind: "other" };
  return { kind: "like", value: `${COMMENT_THREAD_SERVICE_PREFIX[service]}%` };
}

export const COMMENT_OTHER_PREFIXES = Object.values(COMMENT_THREAD_SERVICE_PREFIX);

export function matchesCommentStoryFilter(
  storyId: string,
  service: CommentThreadService | null,
): boolean {
  if (!service) return true;
  return commentThreadService(storyId) === service;
}

export type RlsActivitySiteMetrics = {
  identifiedUsers: number;
  users7d: number;
  users30d: number;
  users2plusDays: number;
  singleDayUsers: number;
  activityReturnRate: number | null;
  d1Cohort: number;
  d1Retained: number;
  d1Rate: number | null;
  d7Cohort: number;
  d7Retained: number;
  d7Rate: number | null;
  authUsers: number;
  authReturned: number;
  authReturnRate: number | null;
};

export type RlsActivityServiceMetrics = {
  service: Exclude<AdminMetricService, "site">;
  usersAll: number;
  users7d: number;
  users30d: number;
  share30d: number | null;
  users2plusDays: number;
  returnRate: number | null;
};

export type RlsActivityDailyPoint = {
  day: string;
  users: number;
  newUsers: number;
  writes: number;
};

/** Launch-week traffic spike the user compares against CF page views. */
export const ADMIN_CF_TRAFFIC_SPIKE_DAY = "2026-08-14";

export type AdminActivityChartLayout = {
  width: number;
  height: number;
  pad: { l: number; r: number; t: number; b: number };
  innerW: number;
  innerH: number;
  maxUsers: number;
  maxWrites: number;
  usersPath: string;
  writesPath: string;
  points: Array<{
    day: string;
    users: number;
    newUsers: number;
    writes: number;
    x: number;
    yUsers: number;
    yWrites: number;
  }>;
  xTicks: Array<{ day: string; x: number; label: string }>;
  spikeX: number | null;
};

function formatChartTick(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function polylinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  return coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

export function layoutAdminActivityChart(
  daily: RlsActivityDailyPoint[],
  width = 720,
  height = 240,
): AdminActivityChartLayout {
  const pad = { l: 36, r: 44, t: 18, b: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const maxUsers = Math.max(1, ...daily.map((point) => point.users));
  const maxWrites = Math.max(1, ...daily.map((point) => point.writes));
  const last = Math.max(daily.length - 1, 1);
  const xAt = (index: number) => pad.l + (daily.length <= 1 ? innerW / 2 : (index / last) * innerW);
  const yAt = (value: number, max: number) => pad.t + innerH - (value / max) * innerH;

  const points = daily.map((point, index) => ({
    ...point,
    x: xAt(index),
    yUsers: yAt(point.users, maxUsers),
    yWrites: yAt(point.writes, maxWrites),
  }));

  const tickEvery = Math.max(1, Math.ceil(daily.length / 8));
  const xTicks = points.flatMap((point, index) => {
    const isEdge = index === 0 || index === points.length - 1;
    if (!isEdge && index % tickEvery !== 0) return [];
    return [{ day: point.day, x: point.x, label: formatChartTick(point.day) }];
  });

  const spike = points.find((point) => point.day === ADMIN_CF_TRAFFIC_SPIKE_DAY);

  return {
    width,
    height,
    pad,
    innerW,
    innerH,
    maxUsers,
    maxWrites,
    usersPath: polylinePath(points.map((point) => ({ x: point.x, y: point.yUsers }))),
    writesPath: polylinePath(points.map((point) => ({ x: point.x, y: point.yWrites }))),
    points,
    xTicks,
    spikeX: spike?.x ?? null,
  };
}

export type RlsActivityMetrics = {
  site: RlsActivitySiteMetrics;
  services: RlsActivityServiceMetrics[];
  daily: RlsActivityDailyPoint[];
};

function asNonNegativeInt(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function asRate(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isMetricService(
  value: string,
): value is Exclude<AdminMetricService, "site"> {
  return ADMIN_METRIC_SERVICES.includes(value as AdminMetricService) && value !== "site";
}

export function isMissingRlsActivityMetricsRpc(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /get_rls_activity_metrics/i.test(error.message ?? "");
}

export function parseRlsActivityMetrics(value: unknown): RlsActivityMetrics | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const siteRaw = record.site;
  if (!siteRaw || typeof siteRaw !== "object") return null;
  const siteRow = siteRaw as Record<string, unknown>;
  const identifiedUsers = asNonNegativeInt(siteRow.identified_users);
  const users2plusDays = asNonNegativeInt(siteRow.users_2plus_days);
  const singleDayUsers = asNonNegativeInt(siteRow.single_day_users);
  const d1Cohort = asNonNegativeInt(siteRow.d1_cohort);
  const d1Retained = asNonNegativeInt(siteRow.d1_retained);
  const d7Cohort = asNonNegativeInt(siteRow.d7_cohort);
  const d7Retained = asNonNegativeInt(siteRow.d7_retained);
  const authUsers = asNonNegativeInt(siteRow.auth_users);
  const authReturned = asNonNegativeInt(siteRow.auth_returned);

  const site: RlsActivitySiteMetrics = {
    identifiedUsers,
    users7d: asNonNegativeInt(siteRow.users_7d),
    users30d: asNonNegativeInt(siteRow.users_30d),
    users2plusDays,
    singleDayUsers,
    activityReturnRate: asRate(siteRow.activity_return_rate)
      ?? (identifiedUsers > 0 ? users2plusDays / identifiedUsers : null),
    d1Cohort,
    d1Retained,
    d1Rate: asRate(siteRow.d1_rate) ?? (d1Cohort > 0 ? d1Retained / d1Cohort : null),
    d7Cohort,
    d7Retained,
    d7Rate: asRate(siteRow.d7_rate) ?? (d7Cohort > 0 ? d7Retained / d7Cohort : null),
    authUsers,
    authReturned,
    authReturnRate: asRate(siteRow.auth_return_rate)
      ?? (authUsers > 0 ? authReturned / authUsers : null),
  };

  const servicesRaw = Array.isArray(record.services) ? record.services : [];
  const services = servicesRaw.flatMap((row): RlsActivityServiceMetrics[] => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const service = typeof item.service === "string" ? item.service : "";
    if (!isMetricService(service)) return [];
    const usersAll = asNonNegativeInt(item.users_all);
    const users2plus = asNonNegativeInt(item.users_2plus_days);
    return [{
      service,
      usersAll,
      users7d: asNonNegativeInt(item.users_7d),
      users30d: asNonNegativeInt(item.users_30d),
      share30d: asRate(item.share_30d),
      users2plusDays: users2plus,
      returnRate: asRate(item.return_rate) ?? (usersAll > 0 ? users2plus / usersAll : null),
    }];
  });

  const dailyRaw = Array.isArray(record.daily) ? record.daily : [];
  const daily = dailyRaw.flatMap((row): RlsActivityDailyPoint[] => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const day = typeof item.day === "string" ? item.day : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
    return [{
      day,
      users: asNonNegativeInt(item.users),
      newUsers: asNonNegativeInt(item.new_users),
      writes: asNonNegativeInt(item.writes),
    }];
  });

  return { site, services, daily };
}

export function formatRate(value: number | null): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}
