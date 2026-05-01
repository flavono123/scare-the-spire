-- Add env column to runs table so dev and prod donations are
-- isolated, matching the convention already used by likes, comments,
-- and chemical_posts (.eq("env", supabaseEnv) on every read/write).
--
-- Apply via Supabase Dashboard > SQL Editor.

alter table runs add column env text not null default 'production';

create index idx_runs_env on runs(env);
