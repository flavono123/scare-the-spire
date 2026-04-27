// History course (역사 강의서) is still being polished — keep it off in
// production unless `NEXT_PUBLIC_HISTORY_COURSE_ENABLED` is explicitly set
// to "true". Dev/preview builds always see it.
export const HISTORY_COURSE_ENABLED =
  process.env.NEXT_PUBLIC_HISTORY_COURSE_ENABLED === "true" ||
  process.env.NODE_ENV !== "production";
