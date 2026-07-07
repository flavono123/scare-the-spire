---
name: supabase-migrations
description: Apply scare-the-spire Supabase schema changes with the Supabase CLI. Use when creating, reviewing, applying, auditing, or repairing database migrations, Supabase SQL files, RLS policies, RPCs, tables, columns, indexes, or any feature that changes the remote Supabase schema.
---

# supabase-migrations

Use this skill for every Supabase schema change in this repository.

## Baseline

- Historical SQL through `supabase/migration-014-community-stories.sql` has
  already been applied manually to the linked Supabase project.
- The old top-level files `supabase/setup.sql`, `supabase/migrate-env.sql`, and
  `supabase/migration-002-*.sql` through `supabase/migration-014-*.sql` are
  baseline history, not pending CLI migrations.
- Do not re-run, move, or convert those historical files into CLI-managed
  migrations unless the user explicitly asks for a migration-history repair plan.
- New schema changes after 014 must be created as Supabase CLI migrations under
  `supabase/migrations/`.

## Creating A Migration

1. Confirm the CLI is available and the repo is linked:

   ```bash
   supabase --version
   supabase migration list --linked
   ```

2. Create a new CLI migration:

   ```bash
   supabase migration new <short_descriptive_name>
   ```

3. Put the SQL in the generated
   `supabase/migrations/<timestamp>_<short_descriptive_name>.sql` file.

4. Make migrations idempotent where practical for live-safe rollout:
   - Use `create table if not exists`, `create index if not exists`, and
     guarded `alter table` blocks when repeating the statement would otherwise
     fail.
   - Keep RLS policies explicit and named.
   - Avoid data rewrites or large table scans unless the user has accepted the
     operational cost.

## Applying A Migration

1. Preview what the CLI will apply:

   ```bash
   supabase db push --linked --dry-run
   ```

2. Apply only after reviewing the dry run:

   ```bash
   supabase db push --linked
   ```

3. Verify the remote state:

   ```bash
   supabase migration list --linked
   supabase db dump --linked --schema public --file /tmp/scare-the-spire-public-schema.sql
   ```

4. Check the dumped schema for the expected tables, columns, constraints,
   indexes, functions, grants, and policies.

## Repairing History

- `supabase migration list --linked` may not show migrations 001-014 because
  they predate CLI migration management in this repo.
- Do not use `supabase migration repair` as a routine step.
- If the user asks to reconcile historical migration history, first propose a
  plan that marks only already-applied historical versions as applied, then wait
  for explicit approval before running repair commands.

## Commit Discipline

- Commit the migration file separately from application code when practical.
- In the final report, state which migration file was created, whether
  `supabase db push --linked --dry-run` was run, whether `supabase db push
  --linked` was run, and how the remote schema was verified.
