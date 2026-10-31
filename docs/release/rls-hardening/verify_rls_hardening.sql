-- Post-apply verification for 20261031044402_rls_hardening.sql.
-- It uses no psql variables, so it also runs through `supabase db query --linked -f`.
--
-- It writes fixture rows on development-env data, so it undoes itself by
-- construction: the DO block ALWAYS ends in an exception, which rolls the block
-- back even if a wrapper drops the surrounding BEGIN. The command therefore
-- always exits non-zero. Read the message:
--   "rls_hardening verify PASSED ..."   every assertion held
--   "verify: ..."                       that assertion failed
begin;

do $verify$
declare
  v_uid uuid;
  v_combo uuid;
  v_other_combo uuid;
  v_before record;
  v_after record;
  v_tournament uuid;
  v_pool jsonb;
  v_like integer;
  v_comment integer;
  v_inserted record;
  v_skipped text[] := '{}';
begin
  select user_id, id into v_uid, v_combo
  from public.combo_posts
  where env = 'development'
  order by created_at desc
  limit 1;
  if v_uid is null then
    raise exception 'verify: no development combo post to act as its author';
  end if;

  select id into v_other_combo
  from public.combo_posts
  where env = 'development' and user_id <> v_uid
  limit 1;

  select id, pool into v_tournament, v_pool
  from public.favorite_tournament_posts
  where env = 'development' and jsonb_array_length(pool) >= 2
  limit 1;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  if current_user <> 'authenticated' or auth.uid() is distinct from v_uid then
    raise exception 'verify: could not act as the post author';
  end if;

  -- 1a. Update: counters, created_at, and env stay.
  select like_count, comment_count, created_at, env into v_before
  from public.combo_posts where id = v_combo;
  update public.combo_posts
    set like_count = 999999,
        comment_count = 999999,
        created_at = now() + interval '10 years',
        env = 'production'
    where id = v_combo;
  select like_count, comment_count, created_at, env into v_after
  from public.combo_posts where id = v_combo;
  if v_after is distinct from v_before then
    raise exception 'verify: combo_posts update moved a server column: % -> %', v_before, v_after;
  end if;

  -- 1a. Insert: client counters and created_at are replaced.
  insert into public.chemical_posts (user_id, nickname, content, content_text, env, like_count, comment_count, created_at)
    values (v_uid, 'qa', '[]'::jsonb, 'qa', 'development', 5000, 5000, now() + interval '1 year')
    returning like_count, comment_count, created_at into v_inserted;
  if v_inserted.like_count <> 0 or v_inserted.comment_count <> 0 or v_inserted.created_at > now() + interval '1 minute' then
    raise exception 'verify: chemical_posts insert kept client values: %', v_inserted;
  end if;

  -- Counter triggers still work under the guard.
  select comment_count into v_comment from public.combo_posts where id = v_combo;
  insert into public.comments (story_id, user_id, nickname, content, env)
    values ('c-c-c-combo:' || v_combo, v_uid, 'qa', 'qa', 'development');
  select comment_count into v_like from public.combo_posts where id = v_combo;
  if v_like <> v_comment + 1 then
    raise exception 'verify: comment counter did not move: % -> %', v_comment, v_like;
  end if;

  -- 1b. A reaction cannot move to another resource.
  begin
    update public.resource_reactions set resource_id = 'verify' where user_id = v_uid;
    raise exception 'verify: resource_reactions key update was allowed';
  exception
    when insufficient_privilege then null;
  end;

  -- 1c. No overlay on someone else's post.
  if v_other_combo is null then
    v_skipped := array_append(v_skipped, 'overlay (no second development combo author)');
  else
    begin
      insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
        values ('development', 'combo', v_other_combo, v_uid, 'qa', '[]'::jsonb, 'qa');
      raise exception 'verify: overlay on another author''s post was allowed';
    exception
      when insufficient_privilege then null;
    end;
  end if;

  -- Overlay on the author's own post still works.
  insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
    values ('development', 'combo', v_combo, v_uid, 'qa', '[]'::jsonb, 'qa')
    on conflict (env, source_service, source_id) do nothing;

  -- 1d. RPC input.
  if v_tournament is null then
    v_skipped := array_append(v_skipped, 'tournament RPC (no development tournament)');
  else
    begin
      perform public.complete_favorite_tournament_play(
        v_tournament, 'development', 100000, 'card', 'verify', '[]'::jsonb
      );
      raise exception 'verify: RPC accepted a wrong match count';
    exception
      when raise_exception then
        if sqlerrm like 'verify:%' then raise; end if;
    end;
    begin
      perform public.complete_favorite_tournament_play(
        v_tournament, 'development', 2, 'card', 'verify-outside-pool',
        '[{"left_type":"card","left_id":"verify-outside-pool","right_type":"card","right_id":"x","winner":"left"}]'::jsonb
      );
      raise exception 'verify: RPC accepted a candidate outside the pool';
    exception
      when raise_exception then
        if sqlerrm like 'verify:%' then raise; end if;
    end;
  end if;

  -- 1f. env values.
  begin
    insert into public.likes (story_id, user_id, env) values ('verify:env', v_uid, 'staging');
    raise exception 'verify: likes accepted env staging';
  exception
    when check_violation then null;
  end;

  -- 1g. The view works for a signed-out reader.
  execute 'set local role anon';
  perform 1 from public.this_or_that_post_like_counts limit 1;
  execute 'reset role';

  raise exception 'rls_hardening verify PASSED, rolled back. Skipped: %', v_skipped
    using errcode = 'RH000';
end
$verify$;

rollback;
