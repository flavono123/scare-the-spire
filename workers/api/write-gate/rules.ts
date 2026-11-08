/**
 * What Supabase checks today for an authenticated user's write, table by table,
 * as data (docs/supabase-exit/STEP4_WRITE_GATE.md 3). Every rule names its
 * source in the 2026-11-05 public schema dump; scripts/write-gate-equivalence.spec.ts
 * runs each against the real policies, triggers and grants on PGlite.
 *
 * Only what the service role skips is here: RLS policies, role-guarded BEFORE
 * triggers (`WHEN (CURRENT_USER = ANY ('anon','authenticated'))`) and grants.
 * Column CHECKs, NOT NULL, unique keys, foreign keys and the counter triggers
 * (SECURITY DEFINER, no WHEN) still run for service-role writes, so Supabase
 * keeps enforcing them and the Worker does not copy them.
 */

export type OwnerColumn = "user_id" | "donor_user_id";

export type InsertCheck = "not_builtin_preset" | "vote_post_same_env" | "defragment_source_owned";

export type TableRule = {
  /** The column every write policy compares with auth.uid(). */
  owner: OwnerColumn;
  /** Which write policies exist for authenticated (PUBLIC or TO authenticated). */
  policies: { insert: boolean; update: boolean; delete: boolean };
  /** SELECT policy for authenticated: `true` or the owner's rows only. */
  select: "public" | "owner";
  /** Column grants of authenticated where narrower than GRANT ALL; `delete: false` = no DELETE grant. */
  grants?: { insert?: readonly string[]; update?: readonly string[]; select?: readonly string[]; delete?: false };
  /**
   * Role-guarded BEFORE triggers: on insert the listed columns are set by the
   * trigger (the column defaults give the same values: 0, now(), null); on
   * update they keep their old values. Dropping them from the payload has the
   * same effect for the service role.
   */
  guard?: { insert: readonly string[]; update: readonly string[] };
  /** Extra WITH CHECK terms of the insert policy (and of the update policy for upserts). */
  insertCheck?: InsertCheck;
  /** contact_inquiries_rate_limit, role-guarded by the step 4 migration: the Worker does its work. */
  contactTrigger?: true;
  /** Column defaults the Worker needs to read a row the way Postgres fills it. */
  defaults?: Record<string, string>;
};

// guard_post_server_columns (schema:2042-2073).
const POST_GUARD_INSERT = ["like_count", "comment_count", "created_at"] as const;
const POST_GUARD_UPDATE = ["id", "env", "like_count", "comment_count", "created_at"] as const;

function postRule(update: boolean, extra: readonly string[] = [], insertCheck?: InsertCheck): TableRule {
  return {
    owner: "user_id",
    policies: { insert: true, update, delete: true },
    select: "public",
    guard: { insert: [...POST_GUARD_INSERT, ...extra], update: [...POST_GUARD_UPDATE, ...extra] },
    ...(insertCheck ? { insertCheck } : {}),
    defaults: { env: "production" },
  };
}

const OWNED_PUBLIC = {
  owner: "user_id",
  policies: { insert: true, update: false, delete: true },
  select: "public",
} as const satisfies TableRule;

export const TABLE_RULES: Readonly<Record<string, TableRule>> = {
  // comments_insert/delete (4847, 4840), no update policy; guard_insert_server_columns (2022-2033, trigger 4331).
  comments: { ...OWNED_PUBLIC, guard: { insert: ["created_at"], update: [] } },
  // comment_likes_insert/delete (4820, 4813).
  comment_likes: { ...OWNED_PUBLIC },
  // likes_insert/delete (5096, 5089).
  likes: { ...OWNED_PUBLIC },
  // resource_reactions insert/delete PUBLIC (5282, 5275), update TO authenticated (5296), GRANT UPDATE(kind) (6064).
  resource_reactions: {
    owner: "user_id",
    policies: { insert: true, update: true, delete: true },
    select: "public",
    grants: { update: ["kind"] },
  },
  // community_stories insert/delete (4874, 4867); guard_insert_server_columns also clears static_story_id (4345).
  community_stories: { ...OWNED_PUBLIC, guard: { insert: ["created_at", "static_story_id"], update: [] } },
  // Toybox posts: insert/delete everywhere, update on five (SURFACE_MAP 4.1); guard_post_server_columns.
  combo_posts: postRule(true),
  transfigure_posts: postRule(true),
  decisions_decisions_posts: postRule(true),
  pagestorm_posts: postRule(true),
  defragment_posts: postRule(true),
  chemical_posts: postRule(false),
  this_or_that_posts: postRule(false, ["left_vote_count", "right_vote_count"]),
  // favorite_tournament_posts_insert also needs preset_key NOT LIKE 'builtin:%' (5062).
  favorite_tournament_posts: postRule(false, ["play_count"], "not_builtin_preset"),
  // pagestorm_drafts: all four policies on the owner (5129-5150), no trigger.
  pagestorm_drafts: {
    owner: "user_id",
    policies: { insert: true, update: true, delete: true },
    select: "owner",
    defaults: { env: "production" },
  },
  // defragment_bodies insert/update TO authenticated with defragment_source_owned (4975, 4989), delete (4968), no trigger.
  defragment_bodies: {
    owner: "user_id",
    policies: { insert: true, update: true, delete: true },
    select: "public",
    insertCheck: "defragment_source_owned",
  },
  // this_or_that_post_likes insert/delete (5350, 5343).
  this_or_that_post_likes: { ...OWNED_PUBLIC },
  // this_or_that_post_votes insert needs a post of the same env (5377-5379); reads are the owner's (5386).
  this_or_that_post_votes: {
    owner: "user_id",
    policies: { insert: true, update: false, delete: true },
    select: "owner",
    insertCheck: "vote_post_same_env",
    defaults: { env: "production" },
  },
  // runs: donor_user_id policies (5316, 5330, 5309); guard_post_server_columns (4408).
  runs: { ...postRule(true), owner: "donor_user_id" },
  // contact_inquiries: TO authenticated insert (owner, status 'new'), select and update (4894-4908);
  // column grants (5784-5889), no DELETE grant; contact_inquiries_rate_limit (589-617).
  contact_inquiries: {
    owner: "user_id",
    policies: { insert: true, update: true, delete: false },
    select: "owner",
    grants: {
      insert: ["user_id", "category", "message", "reply_email", "page_path", "service_locale", "game_locale", "viewport_width", "viewport_height", "env"],
      update: ["reply_seen_at"],
      select: ["id", "category", "message", "page_path", "service_locale", "game_locale", "env", "status", "created_at", "admin_response", "responded_at", "reply_seen_at"],
      delete: false,
    },
    contactTrigger: true,
    defaults: { env: "production" },
  },
};

/** Source tables of defragment_source_owned (schema:552-580); other services are false. */
export const DEFRAGMENT_SOURCE_TABLES: Readonly<Record<string, string>> = {
  combo: "combo_posts",
  transfigure: "transfigure_posts",
  this_or_that: "this_or_that_posts",
  chemical_x: "chemical_posts",
  decisions_decisions: "decisions_decisions_posts",
  favorite_tournament: "favorite_tournament_posts",
  pagestorm: "pagestorm_posts",
};

/**
 * RPCs that read auth.uid(): in worker mode they go to service-only wrappers
 * that take the actor (supabase/migrations/20261108160000_worker_write_actor.sql).
 */
export const ACTOR_RPCS: Readonly<Record<string, string>> = {
  complete_favorite_tournament_play: "worker_complete_favorite_tournament_play",
  submit_puzzlebox_run: "worker_submit_puzzlebox_run",
};

/** contact_inquiries_rate_limit: three an hour per user and env. */
export const CONTACT_RATE_LIMIT = { count: 3, windowMs: 60 * 60 * 1000 } as const;
