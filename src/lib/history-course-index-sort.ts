import {
  TOYBOX_FEED_CORE_SORTS,
  type ToyboxFeedSort,
} from "@/lib/toybox-feed";

/** YouTube grid sorts: shared 최신 / 추천 / 댓글, then in-game run start. */
export const HISTORY_COURSE_INDEX_SORTS = [
  ...TOYBOX_FEED_CORE_SORTS,
  "run_start",
] as const satisfies readonly ToyboxFeedSort[];

export type HistoryCourseIndexSort = (typeof HISTORY_COURSE_INDEX_SORTS)[number];

export interface HistoryCourseIndexSortKey {
  runId: string;
  /** Donation time, or local save time when the run is not shared. */
  createdAtMs: number;
  /** In-game run start, unix seconds. Missing values sort last. */
  startTime: number;
  likeCount: number;
  commentCount: number;
}

function compareIdDesc(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

function compareCreatedAtThenId(
  a: HistoryCourseIndexSortKey,
  b: HistoryCourseIndexSortKey,
): number {
  if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
  return compareIdDesc(a.runId, b.runId);
}

function comparePresentDesc(a: number, b: number): number {
  const aMissing = !Number.isFinite(a) || a <= 0;
  const bMissing = !Number.isFinite(b) || b <= 0;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return b - a;
}

export function compareHistoryCourseIndexRuns(
  sort: HistoryCourseIndexSort,
  a: HistoryCourseIndexSortKey,
  b: HistoryCourseIndexSortKey,
): number {
  if (sort === "recommended" && a.likeCount !== b.likeCount) {
    return b.likeCount - a.likeCount;
  }
  if (sort === "comments" && a.commentCount !== b.commentCount) {
    return b.commentCount - a.commentCount;
  }
  if (sort === "run_start") {
    const byStart = comparePresentDesc(a.startTime, b.startTime);
    if (byStart !== 0) return byStart;
  }
  return compareCreatedAtThenId(a, b);
}

export function sortHistoryCourseIndexRuns<T extends HistoryCourseIndexSortKey>(
  runs: readonly T[],
  sort: HistoryCourseIndexSort,
): T[] {
  return [...runs].sort((a, b) => compareHistoryCourseIndexRuns(sort, a, b));
}
