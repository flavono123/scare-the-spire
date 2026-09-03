import assert from "node:assert/strict";
import {
  adminFilterHref,
  commentStoryFilter,
  COMMENT_OTHER_PREFIXES,
  formatRate,
  isAdminCommentService,
  isAdminPostService,
  layoutAdminActivityChart,
  mergeAdminServicePosts,
  parseRlsActivityMetrics,
  polylinePath,
  type AdminServicePostRow,
} from "../src/lib/admin-rls-activity";
import { commentThreadService } from "../src/lib/comment-threads";

assert.equal(isAdminPostService("combo"), true);
assert.equal(isAdminPostService("patches"), false);
assert.equal(isAdminCommentService("compendium"), true);
assert.equal(isAdminCommentService("history_course"), false);

assert.equal(adminFilterHref({}), "/dev/admin");
assert.equal(
  adminFilterHref({ posts: "combo", comments: "patches" }),
  "/dev/admin?posts=combo&comments=patches",
);

assert.deepEqual(commentStoryFilter(null), null);
assert.deepEqual(commentStoryFilter("byrdispatch"), { kind: "eq", value: "byrdispatch" });
assert.deepEqual(commentStoryFilter("combo"), { kind: "like", value: "c-c-c-combo:%" });
assert.deepEqual(commentStoryFilter("other"), { kind: "other" });
assert.ok(COMMENT_OTHER_PREFIXES.includes("community:"));
assert.equal(commentThreadService("chemical-x:abc"), "chemical_x");

const merged = mergeAdminServicePosts([
  {
    id: "a",
    service: "combo",
    createdAt: "2026-08-01T00:00:00.000Z",
    nickname: "a",
    summary: "older",
    href: "/c-c-c-combo/a",
    userId: "u1",
  },
  {
    id: "b",
    service: "stories",
    createdAt: "2026-09-01T00:00:00.000Z",
    nickname: "b",
    summary: "newer",
    href: "/#community:b",
    userId: "u2",
  },
] satisfies AdminServicePostRow[]);
assert.equal(merged[0]?.id, "b");
assert.equal(merged[1]?.id, "a");

const parsed = parseRlsActivityMetrics({
  site: {
    identified_users: 10,
    users_7d: 4,
    users_30d: 8,
    users_2plus_days: 3,
    single_day_users: 7,
    d1_cohort: 5,
    d1_retained: 1,
    d7_cohort: 4,
    d7_retained: 0,
    auth_users: 12,
    auth_returned: 2,
  },
  services: [
    {
      service: "combo",
      users_all: 6,
      users_7d: 2,
      users_30d: 4,
      share_30d: 0.5,
      users_2plus_days: 1,
    },
    { service: "not-a-service", users_all: 99 },
  ],
  daily: [
    { day: "2026-09-01", users: 3, new_users: 1 },
    { day: "bad", users: 9 },
  ],
});

assert.ok(parsed);
assert.equal(parsed.site.identifiedUsers, 10);
assert.equal(parsed.site.activityReturnRate, 0.3);
assert.equal(parsed.site.d1Rate, 0.2);
assert.equal(parsed.site.authReturnRate, 2 / 12);
assert.equal(parsed.services.length, 1);
assert.equal(parsed.services[0]?.service, "combo");
assert.equal(parsed.services[0]?.returnRate, 1 / 6);
assert.deepEqual(parsed.daily, [{ day: "2026-09-01", users: 3, newUsers: 1, writes: 0 }]);
assert.equal(formatRate(0.1234), "12.3%");
assert.equal(formatRate(null), "-");

assert.equal(polylinePath([]), "");
assert.equal(polylinePath([{ x: 0, y: 10 }, { x: 4, y: 2 }]), "M0.0 10.0 L4.0 2.0");

const chart = layoutAdminActivityChart([
  { day: "2026-08-13", users: 1, newUsers: 1, writes: 2 },
  { day: "2026-08-14", users: 2, newUsers: 1, writes: 4 },
  { day: "2026-08-15", users: 1, newUsers: 0, writes: 1 },
]);
assert.ok(chart.spikeX != null);
assert.ok(chart.usersPath.startsWith("M"));
assert.ok(chart.writesPath.startsWith("M"));

console.log("admin-rls-activity.spec.ts ok");
