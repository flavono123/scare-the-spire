-- 짜증나는 퍼즐상자 scores and rankings: Connections puzzles and beta art quiz sets.
-- Rollout: db-first-additive. Order: before-push.
-- New tables and RPCs only. No deployed reader or writer touches them, so every
-- existing contract stays as it is.
--
-- Clients send what happened in a run, never a score. submit_puzzlebox_run replays
-- the run with the numbers in src/lib/vexing-puzzlebox-score.ts, so a change there
-- needs a migration here. Answers ship in the static pages, so the server only refuses
-- runs that could not have happened; the read RPCs also drop scores above the board's
-- maximum, which the page passes from its own data.
--
-- Rows belong to auth.uid(). Only the SECURITY DEFINER RPCs write; RLS lets a user
-- read their own rows directly and nobody else's. Rankings show the nickname and
-- profile token sent with the user's latest run, plus a short tag derived from the
-- user id because most players keep the default nickname.

select pg_catalog.set_config('lock_timeout', '3s', true);

create table if not exists public.puzzlebox_players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_id text,
  avatar_kind text,
  palette_id text,
  palette_swapped boolean not null default false,
  -- Set by an operator to keep a player out of every ranking.
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint puzzlebox_players_nickname_check check (char_length(nickname) between 1 and 24),
  constraint puzzlebox_players_avatar_kind_check check (avatar_kind is null or avatar_kind in ('character', 'boss'))
);

create table if not exists public.puzzlebox_runs (
  id bigint generated always as identity primary key,
  env text not null,
  game text not null,
  board text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt integer not null,
  score integer not null,
  perfect boolean not null,
  run jsonb not null,
  created_at timestamptz not null default now(),
  constraint puzzlebox_runs_env_check check (env in ('production', 'development')),
  constraint puzzlebox_runs_game_check check (game in ('connections', 'beta-quiz')),
  constraint puzzlebox_runs_board_check check (board ~ '^[1-9][0-9]{0,2}$')
);

create index if not exists puzzlebox_runs_user_board_idx
  on public.puzzlebox_runs (user_id, env, game, board, created_at desc);
create index if not exists puzzlebox_runs_user_created_idx
  on public.puzzlebox_runs (user_id, created_at desc);

-- One ranking row per player and board: the best run. A later run replaces it only
-- with a higher score, so reaching a score later ranks below reaching it first.
create table if not exists public.puzzlebox_best (
  env text not null,
  game text not null,
  board text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  score integer not null,
  perfect boolean not null,
  run_id bigint not null references public.puzzlebox_runs (id) on delete cascade,
  achieved_at timestamptz not null,
  attempts integer not null,
  primary key (env, game, board, user_id)
);

create index if not exists puzzlebox_best_rank_idx
  on public.puzzlebox_best (env, game, board, score desc, achieved_at);
create index if not exists puzzlebox_best_user_idx
  on public.puzzlebox_best (user_id, env, game);

-- Each player's first finished run of a board, summed when it arrives.
create table if not exists public.puzzlebox_board_stats (
  env text not null,
  game text not null,
  board text not null,
  players integer not null default 0,
  cleared integer not null default 0,
  perfect integer not null default 0,
  score_sum bigint not null default 0,
  mistakes_sum integer not null default 0,
  rocks_sum integer not null default 0,
  -- Connections: first group solved was purple; level_solved counts each level solved.
  purple_first integer not null default 0,
  level_solved integer[] not null default '{0,0,0,0}',
  -- Beta quiz: wrong answers per question, and picks per question and choice (question * 4 + choice).
  question_wrong integer[] not null default '{}',
  wrong_picks integer[] not null default '{}',
  speed_sum bigint not null default 0,
  primary key (env, game, board)
);

alter table public.puzzlebox_players enable row level security;
alter table public.puzzlebox_runs enable row level security;
alter table public.puzzlebox_best enable row level security;
alter table public.puzzlebox_board_stats enable row level security;

drop policy if exists puzzlebox_players_read_own on public.puzzlebox_players;
create policy puzzlebox_players_read_own on public.puzzlebox_players
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists puzzlebox_runs_read_own on public.puzzlebox_runs;
create policy puzzlebox_runs_read_own on public.puzzlebox_runs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists puzzlebox_best_read_own on public.puzzlebox_best;
create policy puzzlebox_best_read_own on public.puzzlebox_best
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists puzzlebox_board_stats_read on public.puzzlebox_board_stats;
create policy puzzlebox_board_stats_read on public.puzzlebox_board_stats
  for select using (true);

revoke all on table public.puzzlebox_players, public.puzzlebox_runs, public.puzzlebox_best,
  public.puzzlebox_board_stats from anon, authenticated;
grant select on table public.puzzlebox_players, public.puzzlebox_runs, public.puzzlebox_best
  to authenticated;
grant select on table public.puzzlebox_board_stats to anon, authenticated;

-- Replays a run record and scores it, or raises when the record could not have
-- happened. Mirrors scoreConnections and scoreBetaQuiz.
create or replace function public.puzzlebox_score_run(p_game text, p_run jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  level_points constant integer[] := array[10, 15, 20, 25];
  mistake_bonus constant integer[] := array[20, 10, 5];
  guesses jsonb;
  guess jsonb;
  item jsonb;
  levels integer[];
  lvl integer;
  solved integer[] := '{}';
  mistakes integer := 0;
  rocks integer;
  cleared boolean;
  reverse_rainbow boolean;
  purple_first boolean;
  score integer := 0;
  questions integer;
  answers jsonb;
  answer jsonb;
  picks integer[] := '{}';
  corrects boolean[] := '{}';
  ms integer;
  correct_count integer := 0;
  wrong integer := 0;
  streak integer := 0;
  streak_points integer := 0;
  speed integer := 0;
begin
  if jsonb_typeof(p_run) is distinct from 'object' then
    raise exception 'run must be an object' using errcode = '22023';
  end if;

  if p_game = 'connections' then
    guesses := p_run -> 'guesses';
    if jsonb_typeof(guesses) is distinct from 'array'
      or jsonb_array_length(guesses) not between 1 and 32 then
      raise exception 'guesses must be 1 to 32 groups' using errcode = '22023';
    end if;
    if jsonb_typeof(p_run -> 'rocks') is distinct from 'number' then
      raise exception 'rocks must be a number' using errcode = '22023';
    end if;
    rocks := (p_run ->> 'rocks')::numeric::integer;
    if rocks not between 0 and 3 then
      raise exception 'rocks must be 0 to 3' using errcode = '22023';
    end if;

    for guess in select value from jsonb_array_elements(guesses) loop
      if cardinality(solved) = 4 or mistakes >= 4 then
        raise exception 'guess after the end' using errcode = '22023';
      end if;
      if jsonb_typeof(guess) is distinct from 'array' or jsonb_array_length(guess) <> 4 then
        raise exception 'a guess is four levels' using errcode = '22023';
      end if;
      levels := '{}';
      for item in select value from jsonb_array_elements(guess) loop
        if jsonb_typeof(item) is distinct from 'number' or (item #>> '{}')::numeric not in (0, 1, 2, 3) then
          raise exception 'levels are 0 to 3' using errcode = '22023';
        end if;
        levels := levels || (item #>> '{}')::numeric::integer;
      end loop;
      lvl := levels[1];
      if levels[2] = lvl and levels[3] = lvl and levels[4] = lvl and not (lvl = any (solved)) then
        solved := solved || lvl;
      else
        mistakes := mistakes + 1;
      end if;
    end loop;

    if cardinality(solved) < 4 and mistakes < 4 then
      raise exception 'run is not finished' using errcode = '22023';
    end if;

    cleared := cardinality(solved) = 4;
    reverse_rainbow := cleared and solved = array[3, 2, 1, 0];
    purple_first := cleared and not reverse_rainbow and solved[1] = 3;
    for i in 1 .. cardinality(solved) loop
      score := score + level_points[solved[i] + 1];
    end loop;
    if cleared then
      score := score + coalesce(mistake_bonus[mistakes + 1], 0);
    end if;
    if purple_first then
      score := score + 5;
    end if;
    if reverse_rainbow then
      score := score + 10;
    end if;
    score := greatest(0, score - rocks * 10);

    return jsonb_build_object(
      'score', score,
      'perfect', cleared and mistakes = 0 and rocks = 0,
      'cleared', cleared,
      'mistakes', mistakes,
      'rocks', rocks,
      'solved', to_jsonb(solved),
      'run', jsonb_build_object('guesses', guesses, 'rocks', rocks)
    );
  end if;

  if p_game = 'beta-quiz' then
    if jsonb_typeof(p_run -> 'questions') is distinct from 'number' then
      raise exception 'questions must be a number' using errcode = '22023';
    end if;
    questions := (p_run ->> 'questions')::numeric::integer;
    if questions not between 1 and 30 then
      raise exception 'questions must be 1 to 30' using errcode = '22023';
    end if;
    answers := p_run -> 'answers';
    if jsonb_typeof(answers) is distinct from 'array'
      or jsonb_array_length(answers) not between 1 and questions then
      raise exception 'answers must be 1 to questions' using errcode = '22023';
    end if;

    for answer in select value from jsonb_array_elements(answers) loop
      if wrong >= 3 then
        raise exception 'answer after the end' using errcode = '22023';
      end if;
      if jsonb_typeof(answer -> 'pick') is distinct from 'number'
        or (answer ->> 'pick')::numeric not in (0, 1, 2, 3)
        or jsonb_typeof(answer -> 'correct') is distinct from 'boolean'
        or jsonb_typeof(answer -> 'ms') is distinct from 'number' then
        raise exception 'an answer is a pick, a result, and a time' using errcode = '22023';
      end if;
      ms := least(600000, greatest(0, round((answer ->> 'ms')::numeric)))::integer;
      picks := picks || (answer ->> 'pick')::numeric::integer;
      corrects := corrects || (answer ->> 'correct')::boolean;
      if (answer ->> 'correct')::boolean then
        correct_count := correct_count + 1;
        streak := streak + 1;
        speed := speed + case
          when ms >= 10000 then 0
          when ms <= 1000 then 10
          else round(10 * (10000 - ms)::numeric / 9000)::integer
        end;
        if streak >= 3 then
          streak_points := streak_points + 2;
        end if;
      else
        wrong := wrong + 1;
        streak := 0;
      end if;
    end loop;

    if jsonb_array_length(answers) < questions and wrong < 3 then
      raise exception 'run is not finished' using errcode = '22023';
    end if;

    score := correct_count * 10 + speed + streak_points + greatest(0, 3 - wrong) * 5;
    return jsonb_build_object(
      'score', score,
      'perfect', correct_count = questions,
      'cleared', wrong < 3,
      'mistakes', wrong,
      'rocks', 0,
      'questions', questions,
      'picks', to_jsonb(picks),
      'corrects', to_jsonb(corrects),
      'speed', speed,
      'run', jsonb_build_object('questions', questions, 'answers', answers)
    );
  end if;

  raise exception 'unknown game' using errcode = '22023';
end;
$$;

-- Records a finished run for the signed-in player and returns its score and standing.
create or replace function public.submit_puzzlebox_run(
  p_env text,
  p_game text,
  p_board text,
  p_run jsonb,
  p_player jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  scored jsonb;
  v_score integer;
  v_perfect boolean;
  v_attempt integer;
  v_run_id bigint;
  v_now timestamptz := now();
  best public.puzzlebox_best%rowtype;
  improved boolean := false;
  v_nickname text;
  v_avatar_id text;
  v_avatar_kind text;
  v_palette_id text;
  st public.puzzlebox_board_stats%rowtype;
  v_level_solved integer[];
  v_question_wrong integer[];
  v_wrong_picks integer[];
  pick_slot integer;
  solved integer[];
  picks integer[];
  corrects boolean[];
  questions integer;
  v_rank integer;
  v_players integer;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_env not in ('production', 'development') then
    raise exception 'unknown env' using errcode = '22023';
  end if;
  if p_board is null or p_board !~ '^[1-9][0-9]{0,2}$' then
    raise exception 'unknown board' using errcode = '22023';
  end if;

  -- One submit at a time per player, so the attempt count and best row stay consistent.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('puzzlebox:' || actor::text, 0));

  scored := public.puzzlebox_score_run(p_game, p_run);
  v_score := (scored ->> 'score')::integer;
  v_perfect := (scored ->> 'perfect')::boolean;

  -- A finished set takes longer than this; a burst of runs is a script.
  if exists (
    select 1 from public.puzzlebox_runs
    where user_id = actor and env = p_env and game = p_game and board = p_board
      and created_at > v_now - interval '3 seconds'
  ) or (
    select count(*) from public.puzzlebox_runs
    where user_id = actor and created_at > v_now - interval '1 day'
  ) >= 500 then
    raise exception 'too many runs' using errcode = '54000';
  end if;

  v_nickname := left(pg_catalog.btrim(coalesce(p_player ->> 'nickname', '')), 24);
  if v_nickname = '' then
    v_nickname := '?';
  end if;
  v_avatar_kind := p_player ->> 'avatar_kind';
  if v_avatar_kind is not null and v_avatar_kind not in ('character', 'boss') then
    v_avatar_kind := null;
  end if;
  v_avatar_id := p_player ->> 'avatar_id';
  if v_avatar_id is not null and v_avatar_id !~ '^[A-Z0-9_]{1,40}$' then
    v_avatar_id := null;
  end if;
  v_palette_id := p_player ->> 'palette_id';
  if v_palette_id is not null and v_palette_id !~ '^[a-z0-9_-]{1,40}$' then
    v_palette_id := null;
  end if;

  insert into public.puzzlebox_players as p
    (user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, updated_at)
  values (
    actor, v_nickname, v_avatar_id, v_avatar_kind, v_palette_id,
    coalesce((p_player ->> 'palette_swapped')::boolean, false) and v_palette_id is not null,
    v_now
  )
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    avatar_id = excluded.avatar_id,
    avatar_kind = excluded.avatar_kind,
    palette_id = excluded.palette_id,
    palette_swapped = excluded.palette_swapped,
    updated_at = excluded.updated_at;

  select * into best from public.puzzlebox_best b
  where b.env = p_env and b.game = p_game and b.board = p_board and b.user_id = actor
  for update;
  v_attempt := coalesce(best.attempts, 0) + 1;

  insert into public.puzzlebox_runs (env, game, board, user_id, attempt, score, perfect, run, created_at)
  values (p_env, p_game, p_board, actor, v_attempt, v_score, v_perfect, scored -> 'run', v_now)
  returning id into v_run_id;

  if best.user_id is null then
    insert into public.puzzlebox_best (env, game, board, user_id, score, perfect, run_id, achieved_at, attempts)
    values (p_env, p_game, p_board, actor, v_score, v_perfect, v_run_id, v_now, 1);
    improved := true;
  elsif v_score > best.score then
    update public.puzzlebox_best b
    set score = v_score, perfect = v_perfect, run_id = v_run_id, achieved_at = v_now, attempts = v_attempt
    where b.env = p_env and b.game = p_game and b.board = p_board and b.user_id = actor;
    improved := true;
  else
    update public.puzzlebox_best b
    set attempts = v_attempt
    where b.env = p_env and b.game = p_game and b.board = p_board and b.user_id = actor;
  end if;

  -- Board statistics count each player's first finished run only.
  if v_attempt = 1 then
    insert into public.puzzlebox_board_stats (env, game, board)
    values (p_env, p_game, p_board)
    on conflict (env, game, board) do nothing;
    select * into st from public.puzzlebox_board_stats s
    where s.env = p_env and s.game = p_game and s.board = p_board
    for update;

    st.players := st.players + 1;
    st.cleared := st.cleared + case when (scored ->> 'cleared')::boolean then 1 else 0 end;
    st.perfect := st.perfect + case when v_perfect then 1 else 0 end;
    st.score_sum := st.score_sum + v_score;
    st.mistakes_sum := st.mistakes_sum + (scored ->> 'mistakes')::integer;
    st.rocks_sum := st.rocks_sum + (scored ->> 'rocks')::integer;

    v_level_solved := st.level_solved;
    v_question_wrong := st.question_wrong;
    v_wrong_picks := st.wrong_picks;
    if p_game = 'connections' then
      solved := array(select value::integer from jsonb_array_elements_text(scored -> 'solved'));
      if solved[1] = 3 then
        st.purple_first := st.purple_first + 1;
      end if;
      for i in 1 .. 4 loop
        if (i - 1) = any (solved) then
          v_level_solved[i] := coalesce(v_level_solved[i], 0) + 1;
        end if;
      end loop;
    else
      questions := (scored ->> 'questions')::integer;
      picks := array(select value::integer from jsonb_array_elements_text(scored -> 'picks'));
      corrects := array(select value::boolean from jsonb_array_elements_text(scored -> 'corrects'));
      if cardinality(v_question_wrong) < questions then
        v_question_wrong := v_question_wrong || array_fill(0, array[questions - cardinality(v_question_wrong)]);
      end if;
      if cardinality(v_wrong_picks) < questions * 4 then
        v_wrong_picks := v_wrong_picks || array_fill(0, array[questions * 4 - cardinality(v_wrong_picks)]);
      end if;
      for i in 1 .. cardinality(picks) loop
        if not corrects[i] then
          v_question_wrong[i] := v_question_wrong[i] + 1;
          pick_slot := (i - 1) * 4 + picks[i] + 1;
          v_wrong_picks[pick_slot] := v_wrong_picks[pick_slot] + 1;
        end if;
      end loop;
      st.speed_sum := st.speed_sum + (scored ->> 'speed')::integer;
    end if;

    update public.puzzlebox_board_stats s set
      players = st.players,
      cleared = st.cleared,
      perfect = st.perfect,
      score_sum = st.score_sum,
      mistakes_sum = st.mistakes_sum,
      rocks_sum = st.rocks_sum,
      purple_first = st.purple_first,
      level_solved = v_level_solved,
      question_wrong = v_question_wrong,
      wrong_picks = v_wrong_picks,
      speed_sum = st.speed_sum
    where s.env = p_env and s.game = p_game and s.board = p_board;
  end if;

  select * into best from public.puzzlebox_best b
  where b.env = p_env and b.game = p_game and b.board = p_board and b.user_id = actor;

  select count(*) filter (
      where b.score > best.score or (b.score = best.score and b.achieved_at < best.achieved_at)
    ) + 1,
    count(*)
  into v_rank, v_players
  from public.puzzlebox_best b
  join public.puzzlebox_players p on p.user_id = b.user_id
  where b.env = p_env and b.game = p_game and b.board = p_board and not p.hidden;

  return jsonb_build_object(
    'score', v_score,
    'perfect', v_perfect,
    'attempt', v_attempt,
    'improved', improved,
    'best', best.score,
    'best_perfect', best.perfect,
    'rank', v_rank,
    'players', v_players
  );
end;
$$;

-- Ten ranking rows of one board, or of the totals over every board in p_boards
-- (p_board null), plus the caller's own row and the board's statistics.
-- p_boards maps each board the page knows to its maximum score; anything else, or
-- anything above it, is left out.
create or replace function public.get_puzzlebox_leaderboard(
  p_env text,
  p_game text,
  p_boards jsonb,
  p_board text default null,
  p_offset integer default 0,
  p_around_me boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with valid as (
    select key as board, value::integer as max_score
    from jsonb_each_text(case when jsonb_typeof(p_boards) = 'object' then p_boards else '{}'::jsonb end)
    where value ~ '^[0-9]{1,6}$'
      and (p_board is null or key = p_board)
  ),
  totals as (
    select
      b.user_id,
      sum(b.score)::integer as score,
      bool_and(b.perfect) as perfect,
      (count(*) filter (where b.perfect))::integer as perfect_count,
      count(*)::integer as boards,
      sum(b.attempts)::integer as attempts,
      max(b.achieved_at) as achieved_at
    from public.puzzlebox_best b
    join valid v on v.board = b.board and b.score <= v.max_score
    join public.puzzlebox_players p on p.user_id = b.user_id and not p.hidden
    where b.env = p_env and b.game = p_game
    group by b.user_id
  ),
  ranked as (
    select t.*, (row_number() over (order by t.score desc, t.achieved_at asc, t.user_id))::integer as rank
    from totals t
  ),
  rows_json as (
    select r.user_id, r.rank, jsonb_build_object(
      'rank', r.rank,
      'score', r.score,
      'perfect', r.perfect,
      'perfect_count', r.perfect_count,
      'boards', r.boards,
      'attempts', r.attempts,
      'achieved_at', r.achieved_at,
      'nickname', p.nickname,
      'tag', left(md5(r.user_id::text), 4),
      'avatar_id', p.avatar_id,
      'avatar_kind', p.avatar_kind,
      'palette_id', p.palette_id,
      'palette_swapped', p.palette_swapped,
      'is_me', coalesce(r.user_id = auth.uid(), false)
    ) as row_json
    from ranked r
    join public.puzzlebox_players p on p.user_id = r.user_id
  ),
  mine as (
    select x.rank, x.row_json from rows_json x where x.user_id = auth.uid()
  ),
  page as (
    select case
      when p_around_me and exists (select 1 from mine) then (((select rank from mine) - 1) / 10) * 10
      else greatest(0, least(coalesce(p_offset, 0), 100000))
    end as start
  )
  select jsonb_build_object(
    'players', (select count(*) from ranked),
    'offset', (select start from page),
    'rows', coalesce((
      select jsonb_agg(x.row_json order by x.rank)
      from rows_json x, page
      where x.rank > page.start and x.rank <= page.start + 10
    ), '[]'::jsonb),
    'me', (select row_json from mine),
    'stats', case when p_board is null then null else (
      select to_jsonb(s) - 'env' - 'game'
      from public.puzzlebox_board_stats s
      where s.env = p_env and s.game = p_game and s.board = p_board
    ) end
  );
$$;

-- The caller's best score, rank, and player count on every board they finished.
create or replace function public.get_my_puzzlebox_standings(
  p_env text,
  p_game text,
  p_boards jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with valid as (
    select key as board, value::integer as max_score
    from jsonb_each_text(case when jsonb_typeof(p_boards) = 'object' then p_boards else '{}'::jsonb end)
    where value ~ '^[0-9]{1,6}$'
  ),
  mine as (
    select b.board, b.score, b.perfect, b.achieved_at, v.max_score
    from public.puzzlebox_best b
    join valid v on v.board = b.board and b.score <= v.max_score
    where b.user_id = auth.uid() and b.env = p_env and b.game = p_game
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'board', m.board,
    'score', m.score,
    'perfect', m.perfect,
    'rank', ranks.better + 1,
    'players', ranks.players
  )), '[]'::jsonb)
  from mine m
  cross join lateral (
    select
      count(*) filter (
        where o.score > m.score or (o.score = m.score and o.achieved_at < m.achieved_at)
      )::integer as better,
      count(*)::integer as players
    from public.puzzlebox_best o
    join public.puzzlebox_players p on p.user_id = o.user_id and not p.hidden
    where o.env = p_env and o.game = p_game and o.board = m.board and o.score <= m.max_score
  ) ranks;
$$;

revoke all on function public.puzzlebox_score_run(text, jsonb) from public, anon, authenticated;
revoke all on function public.submit_puzzlebox_run(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_puzzlebox_run(text, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.get_puzzlebox_leaderboard(text, text, jsonb, text, integer, boolean) from public;
grant execute on function public.get_puzzlebox_leaderboard(text, text, jsonb, text, integer, boolean) to anon, authenticated;
revoke all on function public.get_my_puzzlebox_standings(text, text, jsonb) from public, anon;
grant execute on function public.get_my_puzzlebox_standings(text, text, jsonb) to authenticated;
