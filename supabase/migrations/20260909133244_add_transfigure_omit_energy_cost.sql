-- Hide Transfigure energy cost orbs (curse/quest-style). Nullable/default
-- false so existing rows and old writers stay valid. Old app ignores the
-- unused column on read and does not write it.
--
-- Rollout: DB-first additive. Old app + new DB is safe. Apply before the
-- consumer that writes omit_energy_cost.

alter table public.transfigure_posts
  add column if not exists omit_energy_cost boolean default false;

comment on column public.transfigure_posts.omit_energy_cost is
  'When true, hide the energy cost orb even if the source card has one.';
