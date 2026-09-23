import {
  TOYBOX_FEED_CORE_SORTS,
  type ToyboxFeedCoreSort,
} from "@/lib/toybox-feed";

/** Same order as other indexes: 최신 / 추천 / 댓글. Latest is share time. */
export const HISTORY_COURSE_INDEX_SORTS = TOYBOX_FEED_CORE_SORTS;

export type HistoryCourseIndexSort = ToyboxFeedCoreSort;

export interface HistoryCourseIndexSortKey {
  runId: string;
  /** Donation time, or local save time when the run is not shared. */
  createdAtMs: number;
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
  return compareCreatedAtThenId(a, b);
}

export function sortHistoryCourseIndexRuns<T extends HistoryCourseIndexSortKey>(
  runs: readonly T[],
  sort: HistoryCourseIndexSort,
): T[] {
  return [...runs].sort((a, b) => compareHistoryCourseIndexRuns(sort, a, b));
}
