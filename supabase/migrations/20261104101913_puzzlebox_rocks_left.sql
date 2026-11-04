-- 짜증나는 퍼즐상자: Connections scores the rocks left on the belt instead of taking
-- points off for rocks thrown.
-- Rollout: db-first-additive. Order: before-push.
-- Replaces puzzlebox_score_run only. Run records gain rocksLeft (0 to 3 less the rocks
-- thrown); a full solve earns 10 for each, and thrown rocks no longer cost points.
-- No deployed app calls submit_puzzlebox_run yet (the puzzlebox has not shipped), so
-- the stricter record breaks no caller. Mirrors src/lib/vexing-puzzlebox-score.ts.
-- Runs already stored keep their scores.

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
  rocks_left integer;
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
  shown boolean[];
  display_points integer := 0;
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
    if jsonb_typeof(p_run -> 'rocksLeft') is distinct from 'number' then
      raise exception 'rocksLeft must be a number' using errcode = '22023';
    end if;
    rocks_left := (p_run ->> 'rocksLeft')::numeric::integer;
    if rocks_left not between 0 and 3 - rocks then
      raise exception 'rocksLeft must be 0 to 3 less the rocks thrown' using errcode = '22023';
    end if;
    shown := public.puzzlebox_run_display(p_run -> 'shown');

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
      -- Hidden for the whole run: pictures 10, game-language names 5, English names 5.
      score := score
        + case when shown[1] then 0 else 10 end
        + case when shown[2] then 0 else 5 end
        + case when shown[3] then 0 else 5 end;
      -- Each rock still on the belt: 10.
      score := score + rocks_left * 10;
    end if;
    if purple_first then
      score := score + 5;
    end if;
    if reverse_rainbow then
      score := score + 10;
    end if;

    return jsonb_build_object(
      'score', score,
      'perfect', cleared and mistakes = 0 and rocks = 0,
      'cleared', cleared,
      'mistakes', mistakes,
      'rocks', rocks,
      'solved', to_jsonb(solved),
      'run', jsonb_build_object('guesses', guesses, 'rocks', rocks, 'rocksLeft', rocks_left, 'shown', p_run -> 'shown')
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
      shown := public.puzzlebox_run_display(answer -> 'shown');
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
        -- Hidden while this question was asked: pictures 5, each name 2.
        display_points := display_points
          + case when shown[1] then 0 else 5 end
          + case when shown[2] then 0 else 2 end
          + case when shown[3] then 0 else 2 end;
      else
        wrong := wrong + 1;
        streak := 0;
      end if;
    end loop;

    if jsonb_array_length(answers) < questions and wrong < 3 then
      raise exception 'run is not finished' using errcode = '22023';
    end if;

    score := correct_count * 10 + speed + display_points + streak_points + greatest(0, 3 - wrong) * 5;
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

revoke all on function public.puzzlebox_score_run(text, jsonb) from public, anon, authenticated;
