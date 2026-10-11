import { GAME_LOCALE_PATH_SEGMENTS } from "@/lib/i18n";

export const COURIER_HOLD_EVENT = "sts-courier-hold";

const HISTORY_COURSE_DETAIL_PATH = new RegExp(
  `^(?:/(?:${GAME_LOCALE_PATH_SEGMENTS
    .slice()
    .sort((left, right) => right.length - left.length)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")}))?/history-course/[^/]+/?$`,
);

export function isHistoryCourseDetailPath(pathname: string): boolean {
  return HISTORY_COURSE_DETAIL_PATH.test(pathname);
}

export function readCourierPlaybackHold(): "" | "0" | "1" {
  if (typeof document === "undefined") return "";
  const value = document.documentElement.dataset.courierHold;
  return value === "0" || value === "1" ? value : "";
}

export function writeCourierPlaybackHold(held: boolean) {
  const next = held ? "1" : "0";
  if (document.documentElement.dataset.courierHold === next) return;
  document.documentElement.dataset.courierHold = next;
  window.dispatchEvent(new Event(COURIER_HOLD_EVENT));
}

export function clearCourierPlaybackHold() {
  if (!document.documentElement.dataset.courierHold) return;
  delete document.documentElement.dataset.courierHold;
  window.dispatchEvent(new Event(COURIER_HOLD_EVENT));
}
