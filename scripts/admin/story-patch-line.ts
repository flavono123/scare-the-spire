/**
 * The patch-note-revision skill's Step 4 (community stories that point at a drifted patch line id),
 * through scripts/admin/admin-writes.ts: each env's rows in its write source. While source.stories is
 * supabase it runs the skill's own SQL on the linked project; while it is d1 it changes D1 and writes
 * one outbox update per story, which the mirror sends to Supabase.
 *
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/admin/story-patch-line.ts find --old <old-id>
 *   pnpm exec tsx scripts/admin/story-patch-line.ts relink --old <old-id> --new <new-id> --entity-type <type> --entity-id <id>
 *   options: --dry-run (relink: read the gates, print, write nothing); --local (the wrangler dev D1)
 *
 * The Supabase path needs the Supabase CLI linked to the project (as the skill's commands did).
 * Exit 0 done, 1 refused or failed, 2 bad arguments.
 */
import { adminDeps } from "./admin-deps";
import { findStoriesByPatchLine, relinkStoryPatchLine } from "./admin-writes";
import { cliArgs, d1Mode, flag, option, runCli } from "./cli";

function usage(message: string): never {
  console.error(message);
  console.error([
    "Usage:",
    "  tsx scripts/admin/story-patch-line.ts find --old <old-id> [--local]",
    "  tsx scripts/admin/story-patch-line.ts relink --old <old-id> --new <new-id> --entity-type <type> --entity-id <id> [--dry-run] [--local]",
  ].join("\n"));
  process.exit(2);
}

runCli(async () => {
  const argv = cliArgs();
  const [command] = argv;
  const oldId = option(argv, "--old") ?? usage("--old is required");
  const deps = adminDeps({ mode: d1Mode(argv, usage), dryRun: flag(argv, "--dry-run"), cli: true, log: (line) => console.log(line) });
  if (command === "find") {
    const rows = await findStoriesByPatchLine(deps, oldId);
    if (rows.length) console.table(rows);
    else console.log("no D1 story points at it (Supabase rows, if any source is supabase, are printed above)");
    return;
  }
  if (command === "relink") {
    const result = await relinkStoryPatchLine(deps, {
      oldId,
      newId: option(argv, "--new") ?? usage("--new is required"),
      entityType: option(argv, "--entity-type") ?? usage("--entity-type is required"),
      entityId: option(argv, "--entity-id") ?? usage("--entity-id is required"),
    });
    if (result.dryRun) {
      console.log("dry run: nothing written");
      return;
    }
    if (result.relinked.length) console.table(result.relinked);
    console.log("done");
    return;
  }
  usage("command must be find or relink");
});
