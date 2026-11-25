// ssy: one CLI for the lookups agents used to do by hand (names, changes, patch lines, /api reads, deploy timing).
// Run `bin/ssy help`. Read-only: it never writes files or calls write routes.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const json = <T>(rel: string): T => JSON.parse(readFileSync(path.join(root, rel), "utf8")) as T;
const HOSTS: Record<string, string> = {
  prod: "https://scare-the-spire.flavono123.workers.dev",
  testbed: "https://scare-the-spire-testbed.flavono123.workers.dev",
  local: "http://localhost:3000",
};

const HELP = `ssy <command>

  find <text> [--type card] [--limit 10]   Official ko/en name, id, type and URL (search index)
  changes <ENTITY_ID>                      Balance changes and field diffs per patch
  lines <version> [text]                   Patch line ids of one patch, filtered by text
  tags <version>                           Check [gold:type]Name tags in both patch note files against official names
  steam [version]                          Steam announcements; with a version, its title, publishedAt and raw contents
  api                                      Public GET routes and their query keys
  api <path> [key=value ...] [--host prod|testbed|local]   Call a public GET route (default prod)
  ci [--limit 3]                           Deploy runs: queue wait, run time, steps over 60s
`;

type Flags = { args: string[]; opts: Record<string, string> };
function parse(argv: string[]): Flags {
  const args: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) opts[argv[i].slice(2)] = argv[++i] ?? "";
    else args.push(argv[i]);
  }
  return { args, opts };
}

type SearchItem = { id: string; type: string; title: string; titleEn?: string; href?: string };
function find({ args, opts }: Flags) {
  const q = args.join(" ").toLowerCase();
  if (!q) throw new Error("find <text>");
  const index = "public/generated/search-index.json";
  if (!existsSync(path.join(root, index))) execFileSync("node", ["scripts/ensure-search-index.mjs"], { cwd: root, stdio: "inherit" });
  const items = json<{ items: SearchItem[] }>(index).items.filter((i) => !opts.type || i.type === opts.type);
  const score = (i: SearchItem) => {
    const fields = [i.id, i.title, i.titleEn ?? ""].map((s) => s.toLowerCase());
    if (fields.includes(q)) return 0;
    if (fields.some((s) => s.startsWith(q))) return 1;
    return fields.some((s) => s.includes(q)) ? 2 : -1;
  };
  const hits = items.map((i) => [score(i), i] as const).filter(([s]) => s >= 0).sort((a, b) => a[0] - b[0]);
  for (const [, i] of hits.slice(0, Number(opts.limit ?? 10))) console.log([i.type, i.id, i.title, i.titleEn ?? "", i.href ?? ""].join("\t"));
  if (!hits.length) process.exitCode = 1;
}

type Diff = { field: string; before: unknown; after: unknown };
type Change = { entityType: string; entityId: string; patch: string; summaryKo?: string; summary?: string; fieldDiffs?: Diff[]; diffs?: Diff[] };
const diffText = (diffs: Diff[] = []) => diffs.map((d) => `${d.field}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`).join(", ");
function changes({ args }: Flags) {
  const id = args[0]?.toUpperCase();
  if (!id) throw new Error("changes <ENTITY_ID>");
  // sts2-changes.json holds summary rows and fieldDiffs rows; the app derives version diffs from it (src/lib/data.ts),
  // so the legacy sts2-entity-versions.json is not read.
  const rows = json<Change[]>("data/sts2-changes.json").filter((c) => c.entityId === id);
  for (const c of rows) console.log(`${c.patch}\t${c.entityType}\t${c.summaryKo || c.summary || diffText(c.fieldDiffs ?? c.diffs)}`);
  if (!rows.length) process.exitCode = 1;
}

type Line = { id: string; version: string; textKo?: string; markdownEn?: string };
function lines({ args }: Flags) {
  const [version, ...text] = args;
  if (!version) throw new Error("lines <version> [text]");
  const v = version.replace(/^v/, "");
  const needle = text.join(" ").toLowerCase();
  for (const l of json<Line[]>("data/sts2-patch-lines.json")) {
    if (l.version !== v) continue;
    const body = `${l.textKo ?? ""} ${l.markdownEn ?? ""}`;
    if (!needle || body.toLowerCase().includes(needle)) console.log(`${l.id}\t${(l.textKo ?? "").slice(0, 100)}`);
  }
}

async function api({ args, opts }: Flags) {
  const { API_ROUTES } = await import("../workers/api/routes/index");
  const publicGets = API_ROUTES.filter((r) => r.method === "GET" && r.access === "public");
  const [route, ...pairs] = args;
  if (!route) {
    for (const r of publicGets) console.log(`${r.path}\t${Object.keys(r.query ?? {}).join(",")}`);
    return;
  }
  const pathname = route.startsWith("/") ? route : `/api/read/${route}`;
  // Only public reads: this CLI must never write production rows.
  if (!publicGets.some((r) => r.path === pathname)) throw new Error(`not a public GET route: ${pathname} (run \`ssy api\`)`);
  const url = new URL(pathname, HOSTS[opts.host ?? "prod"] ?? opts.host);
  for (const pair of pairs) url.searchParams.set(...(pair.split("=", 2) as [string, string]));
  const res = await fetch(url);
  console.error(`${res.status} ${url}`);
  const body = await res.text();
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }
  if (!res.ok) process.exitCode = 1;
}

// Uses the patch renderer's own lookup, so a flagged tag is exactly one that renders without hover/link.
async function tags({ args }: Flags) {
  const version = args[0]?.replace(/^v?/, "v");
  if (!version) throw new Error("tags <version>");
  const { loadAllEntities } = await import("../src/lib/load-all-entities");
  const { buildEntityLookup, findEntity } = await import("../src/components/patch-note-renderer");
  const lookup = buildEntityLookup(await loadAllEntities({ gameLocale: "kor" }));
  let problems = 0;
  for (const file of [`${version}.ko.md`, `${version}.md`]) {
    const rel = `data/sts2-patch-notes/${file}`;
    if (!existsSync(path.join(root, rel))) continue;
    for (const [, type, text] of readFileSync(path.join(root, rel), "utf8").matchAll(/\[gold(?::([a-zA-Z]+))?\]([^[]+)\[\/gold\]/g)) {
      // shortcut: monster moves are added by the patch build with line context, not by loadAllEntities; not checked here.
      if (type === "monsterMove") continue;
      const hit = findEntity(text, lookup, type);
      let issue = "";
      if (type && !hit) issue = `no ${type} named this: no hover/link`;
      // Untyped names resolve by name, so only a name shared by two types needs a hint.
      else if (!type && hit) {
        const types = new Set([...(lookup.allByKo?.get(text.trim().toLowerCase()) ?? []), ...(lookup.allByEn?.get(text.trim().toLowerCase()) ?? [])].map((e) => e.type));
        if (types.size > 1) issue = `ambiguous (${[...types].join("/")}), resolves to ${hit.type}: add a type hint`;
      }
      if (issue) {
        problems++;
        console.log(`${file}\t[gold${type ? `:${type}` : ""}]${text}\t${issue}`);
      }
    }
  }
  if (problems) process.exitCode = 1;
}

type SteamItem = { gid: string; title: string; date: number; contents: string };
async function steam({ args }: Flags) {
  const res = await fetch("https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=15&maxlength=300000&format=json&feeds=steam_community_announcements");
  const items: SteamItem[] = (await res.json()).appnews.newsitems;
  const version = args[0]?.replace(/^v/, "");
  if (!version) {
    for (const i of items) console.log(`${new Date(i.date * 1000).toISOString()}\t${i.title}`);
    return;
  }
  const item = items.find((i) => i.title.includes(version));
  if (!item) throw new Error(`no Steam announcement titled with ${version} yet`);
  // gid is not a store news id: steamUrl must be a real store.steampowered.com/news/app/2868840/view/... URL.
  console.log(`title: ${item.title}\npublishedAt: ${new Date(item.date * 1000).toISOString()}\n\n${item.contents}`);
}

type Step = { name: string; startedAt: string | null; completedAt: string | null };
type Job = { name: string; startedAt: string; completedAt: string | null; steps: Step[] };
function ci({ opts }: Flags) {
  const gh = (...a: string[]) => JSON.parse(execFileSync("gh", a, { cwd: root, encoding: "utf8" }));
  const secs = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : NaN);
  const runs = gh("run", "list", "--workflow", "cloudflare-workers.yml", "--limit", opts.limit ?? "3", "--json", "databaseId,createdAt,updatedAt,conclusion,status,headSha");
  for (const run of runs) {
    const job: Job | undefined = gh("run", "view", String(run.databaseId), "--json", "jobs").jobs[0];
    const queued = job ? secs(run.createdAt, job.startedAt) : NaN;
    console.log(`${run.databaseId} ${run.headSha.slice(0, 8)} ${run.status}/${run.conclusion ?? "-"} pushed ${run.createdAt} queued ${queued}s total ${secs(run.createdAt, run.updatedAt)}s`);
    for (const s of job?.steps ?? []) {
      const d = secs(s.startedAt, s.completedAt);
      if (d > 60) console.log(`  ${d}s\t${s.name}`);
    }
  }
}

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error; // `| head` closing the pipe is fine
});
const commands: Record<string, (f: Flags) => unknown> = { find, changes, lines, tags, steam, api, ci };
const [cmd, ...rest] = process.argv.slice(2);
const run = commands[cmd ?? ""];
if (!run) {
  console.log(HELP);
} else {
  Promise.resolve(run(parse(rest))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
