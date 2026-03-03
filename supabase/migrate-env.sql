-- Add env column to separate local/production data
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add env column
alter table likes add column env text not null default 'production';
alter table comments add column env text not null default 'production';

-- 2. Drop old unique constraint and recreate with env
alter table likes drop constraint likes_story_id_user_id_key;
alter table likes add constraint likes_story_env_user unique(story_id, user_id, env);

-- 3. Update indexes
drop index idx_likes_story;
create index idx_likes_story_env on likes(story_id, env);
drop index idx_comments_story;
create index idx_comments_story_env on comments(story_id, env, created_at);

-- 4. Replace RLS policies to scope by env
drop policy "likes_read" on likes;
drop policy "likes_insert" on likes;
drop policy "likes_delete" on likes;
drop policy "comments_read" on comments;
drop policy "comments_insert" on comments;
drop policy "comments_delete" on comments;

create policy "likes_read" on likes for select using (true);
create policy "likes_insert" on likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on likes for delete using (auth.uid() = user_id);
create policy "comments_read" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on comments for delete using (auth.uid() = user_id);
