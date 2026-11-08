/**
 * FakePostgrest plus the writes the step-1 API sends (POST with Prefer return= and resolution=,
 * PATCH, DELETE, HEAD count) and the two write RPCs, each writing d1_change_log like the trigger.
 * Column defaults stand in for the guard triggers (server ids, created_at, zeroed counters). No RLS:
 * the routes' own filters decide which rows a write touches.
 */
import { FakePostgrest, rowMatchesQuery, type Row } from "./fake-postgrest";

const COUNTER_DEFAULTS: Record<string, Row> = {
  chemical_posts: { like_count: 0, comment_count: 0 },
  combo_posts: { like_count: 0, comment_count: 0 },
  transfigure_posts: { like_count: 0, comment_count: 0 },
  decisions_decisions_posts: { like_count: 0, comment_count: 0 },
  pagestorm_posts: { like_count: 0, comment_count: 0 },
  this_or_that_posts: { like_count: 0, comment_count: 0, left_vote_count: 0, right_vote_count: 0, vote_rate_bps: 0 },
  favorite_tournament_posts: { like_count: 0, comment_count: 0, play_count: 0 },
  runs: { like_count: 0, comment_count: 0 },
};

/** Tables whose rows get a server uuid `id` when the write has none. */
const SERVER_ID = new Set([
  "comments", "comment_likes", "likes", "community_stories", "contact_inquiries", "pagestorm_drafts",
  "favorite_tournament_plays", "this_or_that_post_likes",
]);

/** Natural unique keys (a second insert is 23505, or merged with resolution=merge-duplicates). */
const UNIQUE: Record<string, string[]> = {
  comment_likes: ["comment_id", "user_id"],
  likes: ["story_id", "user_id", "env"],
  resource_reactions: ["resource_id", "resource_type", "game_version", "user_id", "env"],
  this_or_that_post_votes: ["post_id", "user_id", "env"],
  this_or_that_post_likes: ["post_id", "user_id", "env"],
  defragment_bodies: ["source_service", "source_id", "env"],
  runs: ["id", "env"],
  puzzlebox_players: ["user_id"],
  puzzlebox_best: ["game", "board", "user_id", "env"],
};

function project(rows: Row[], select: string | null): Row[] {
  if (!select || select === "*") return rows.map((row) => JSON.parse(JSON.stringify(row)));
  return rows.map((row) => Object.fromEntries(select.split(",").map((column) => [column, row[column] ?? null])));
}

export class FakeSupabase extends FakePostgrest {
  jwks: unknown = { keys: [] };
  private runId = 1000;

  now(): string {
    return this.changedAt();
  }

  private withDefaults(table: string, row: Row): Row {
    const out: Row = { ...(COUNTER_DEFAULTS[table] ?? {}), ...row };
    if (SERVER_ID.has(table) && out.id === undefined) out.id = crypto.randomUUID();
    if (out.created_at === undefined && table !== "puzzlebox_players" && table !== "resource_reactions") out.created_at = this.now();
    if (table === "comments") out.parent_id ??= null, out.meta ??= null, out.content_blocks ??= null;
    if (table === "contact_inquiries") {
      Object.assign(out, { status: out.status ?? "new", admin_response: out.admin_response ?? null, responded_at: out.responded_at ?? null, reply_seen_at: out.reply_seen_at ?? null });
    }
    return out;
  }

  private unique(table: string, row: Row): Row | undefined {
    const columns = UNIQUE[table] ?? ["id"];
    return this.table(table).find((other) => columns.every((column) => other[column] === row[column]));
  }

  private matching(table: string, url: URL): Row[] {
    return this.table(table).filter((row) => rowMatchesQuery(row, url.searchParams));
  }

  async write(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const prefer = request.headers.get("prefer") ?? "";
    const representation = prefer.includes("return=representation");
    const select = url.searchParams.get("select");
    if (request.method === "HEAD") {
      const total = this.matching(path, url).length;
      return new Response(null, { status: 200, headers: { "content-range": total ? `0-${total - 1}/${total}` : `*/${total}` } });
    }
    if (request.method === "GET") return null;
    if (path.startsWith("rpc/")) return this.rpc(path.slice(4), await request.json() as Row, request);
    if (request.method === "POST") {
      const body = await request.json() as Row | Row[];
      const rows = Array.isArray(body) ? body : [body];
      const out: Row[] = [];
      for (const input of rows) {
        const row = this.withDefaults(path, input);
        const existing = this.unique(path, row);
        if (existing) {
          if (prefer.includes("resolution=ignore-duplicates")) continue;
          if (prefer.includes("resolution=merge-duplicates")) {
            this.update(path, this.keyOf(path, existing), input);
            out.push(this.unique(path, row)!);
            continue;
          }
          return Response.json({ code: "23505" }, { status: 409 });
        }
        this.insert(path, row);
        out.push(row);
      }
      return representation ? Response.json(project(out, select), { status: 201 }) : new Response(null, { status: 201 });
    }
    if (request.method === "PATCH") {
      const patch = await request.json() as Row;
      const rows = this.matching(path, url);
      for (const row of rows) this.update(path, this.keyOf(path, row), patch);
      const after = rows.map((row) => this.table(path).find((other) => other === row) ?? row);
      return representation ? Response.json(project(after, select)) : new Response(null, { status: 204 });
    }
    if (request.method === "DELETE") {
      const rows = this.matching(path, url);
      const copies = project(rows, select);
      for (const row of rows) this.delete(path, this.keyOf(path, row));
      return representation ? Response.json(copies) : new Response(null, { status: 204 });
    }
    return null;
  }

  private rpc(name: string, args: Row, request: Request): Response {
    const sub = subjectOf(request);
    if (name === "complete_favorite_tournament_play") {
      this.insert("favorite_tournament_plays", this.withDefaults("favorite_tournament_plays", {
        tournament_id: args.p_tournament_id, user_id: sub, env: args.p_env, starting_size: args.p_starting_size,
        champion_type: args.p_champion_type, champion_id: args.p_champion_id, matches: args.p_matches,
      }));
      const post = this.table("favorite_tournament_posts").find((row) => row.id === args.p_tournament_id);
      if (post) this.update("favorite_tournament_posts", { id: post.id }, { play_count: Number(post.play_count) + 1 });
      return Response.json({ ok: true });
    }
    if (name === "submit_puzzlebox_run") {
      const player = args.p_player as Row;
      const playerRow = {
        user_id: sub, nickname: player.nickname, avatar_id: player.avatar_id ?? null, avatar_kind: player.avatar_kind ?? null,
        palette_id: null, palette_swapped: false, hidden: false, updated_at: this.now(),
      };
      if (this.table("puzzlebox_players").some((row) => row.user_id === sub)) {
        const { user_id: _user, hidden: _hidden, ...rest } = playerRow;
        this.update("puzzlebox_players", { user_id: sub }, rest);
      } else {
        this.insert("puzzlebox_players", playerRow);
      }
      const best = this.table("puzzlebox_best").find((row) => row.user_id === sub && row.game === args.p_game && row.board === args.p_board);
      const attempt = Number(best?.attempts ?? 0) + 1;
      const id = this.runId++;
      this.insert("puzzlebox_runs", {
        id, env: args.p_env, game: args.p_game, board: args.p_board, user_id: sub, attempt, score: 50 + attempt, perfect: false,
        run: args.p_run, created_at: this.now(),
      });
      if (!best) {
        this.insert("puzzlebox_best", {
          env: args.p_env, game: args.p_game, board: args.p_board, user_id: sub, score: 50 + attempt, perfect: false, run_id: id,
          achieved_at: this.now(), attempts: 1,
        });
      } else {
        this.update("puzzlebox_best", { game: args.p_game, board: args.p_board, user_id: sub, env: args.p_env }, {
          score: 50 + attempt, run_id: id, achieved_at: this.now(), attempts: attempt,
        });
      }
      return Response.json({ score: 50 + attempt, perfect: false, attempt, improved: true, best: 50 + attempt, best_perfect: false, rank: 1, players: 1 });
    }
    return Response.json({ code: "PGRST202" }, { status: 404 });
  }

  /** globalThis.fetch for the specs: JWKS, writes, then the read path. */
  handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url);
    if (url.pathname.endsWith("/.well-known/jwks.json")) return Response.json(this.jwks);
    const written = await this.write(request.clone());
    if (written) {
      this.calls.push({ method: request.method, table: url.pathname.replace(/^\/rest\/v1\//, ""), query: url.searchParams, accept: request.headers.get("accept") ?? "", apikey: request.headers.get("apikey") ?? "" });
      return written;
    }
    return this.fetcher(request);
  };
}

function subjectOf(request: Request): string {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const payload = token.split(".")[1] ?? "";
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub as string;
  } catch {
    return "";
  }
}
