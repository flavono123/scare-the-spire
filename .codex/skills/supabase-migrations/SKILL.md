---
name: supabase-migrations
description: Plan and apply production-safe scare-the-spire Supabase schema changes with the Supabase CLI, including cross-deployment compatibility and expand/contract rollouts. Use when creating, reviewing, applying, auditing, or repairing database migrations, Supabase SQL files, RLS policies, RPCs, tables, columns, indexes, or any feature that changes the remote Supabase schema or database response contract.
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

## Production Compatibility Gate

Treat the remote database and frontend as independent deployments. A migration
can reach production before or after its consumer code.

Before creating or applying a migration:

1. Inventory every affected reader and writer with `rg`, including RPC callers,
   generated clients, runtime validators, discriminated unions, icon/label maps,
   and route builders.
2. Describe the old and new database contracts: columns, nullability, RPC/view
   result fields, allowed discriminator values, write constraints, and behavior.
3. Check all four rollout states:
   - old app + old DB
   - old app + new DB
   - new app + old DB
   - new app + new DB
4. Identify the actual production consumer version. A local commit, a commit
   only on local `main`, or a successful local build does not count as deployed.
5. Stop before `supabase db push` unless old app + new DB is proven safe, or the
   compatible consumer has already been deployed and verified.

Treat these as breaking contract changes even when the SQL looks additive:

- Adding a new value to an existing RPC/view discriminator such as `category`,
  `type`, or `status`.
- Changing an existing RPC/view row shape, nullability, ordering semantics, or
  meaning.
- Returning rows that make an old consumer index an exhaustive map with an
  unchecked server string. TypeScript casts do not provide runtime validation;
  `MAP[row.category]` needs a deployed allowlist, fallback, or unknown-value
  branch before the database can return a new category.
- Tightening write constraints or RLS in a way the old app does not satisfy.
- Renaming or removing anything still read or written by a deployed client.

An empty-account or empty-table smoke test is not compatibility evidence. Test
representative rows that exercise every newly returned discriminator and
nullability path, and fail on browser console errors or render exceptions.

Choose one safe rollout:

- **App-first expand:** make the consumer accept both contracts, add runtime
  unknown-value handling, test the new values with fixtures, deploy the app,
  verify production, then apply the migration.
- **Versioned contract:** add a new table/view/RPC version without changing the
  old contract, apply it, deploy the new consumer, then retire the old contract
  in a later migration.
- **DB-first additive:** use only when the migration adds unused schema and
  leaves every existing read/write contract unchanged.
- **Contract cleanup:** remove compatibility code or old schema only after all
  deployed consumers have migrated and the rollback window has passed.

If safe ordering requires an app deployment that is not yet on production,
stop and report the required sequence. Never push the migration merely because
the migration file and matching frontend change are committed together.

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
   - Prefer expand/contract migrations over replacing a live contract in place.

## Applying A Migration

1. Re-run the Production Compatibility Gate against the currently deployed app
   and record the selected rollout strategy and evidence.

2. Preview what the CLI will apply:

   ```bash
   supabase db push --linked --dry-run
   ```

3. Apply only after reviewing the dry run and confirming it contains no
   unrelated pending migrations:

   ```bash
   supabase db push --linked
   ```

4. Verify the remote state:

   ```bash
   supabase migration list --linked
   supabase db dump --linked --schema public --file /tmp/scare-the-spire-public-schema.sql
   ```

5. Check the dumped schema for the expected tables, columns, constraints,
   indexes, functions, grants, and policies.

6. Smoke the production app with non-empty representative data for every new
   result variant. Also check the empty state, but never use it as the only
   verification. Confirm there are no browser console errors, storage outage
   fallbacks, or error boundaries.

7. If the migration changes a public contract, keep the rollback path safe:
   prefer rolling the app back while the expanded DB remains compatible. Do not
   rely on immediately reversing a data or contract migration.

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
  --linked` was run, how the remote schema was verified, which rollout strategy
  was used, and what proved compatibility with the production consumer.
