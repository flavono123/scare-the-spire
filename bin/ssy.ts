// ssy: one CLI for the lookups agents used to do by hand (names, changes, patch lines, /api reads, deploy timing).
// Run `bin/ssy help`. Read-only: it never writes files or calls write routes.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  find <text> --at <version>               Names as that version's archived build had them, with renames
  changes <ENTITY_ID>                      Balance changes and field diffs per patch
  lines <version> [text]                   Patch line ids of one patch, filtered by text
  tags [version|/page ...] [--dir .patch-worker/assets] [--all]   Gold text rendered without a hover tip, vs the game (prod by default)
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

// Names as each archived build had them (~/sts2-builds/<version>/canonical/loc, see AGENTS.md).
const BUILDS = process.env.STS2_BUILDS_DIR ?? path.join(process.env.HOME ?? "", "sts2-builds");
const cmpVersion = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.replace(/^v/, "").split(".").map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};
const namesCache = new Map<string, { build: string; names: Map<string, string[]> } | null>();
/** title -> ["table:KEY", ...] for the newest archived build at or before `version`; null when no archive covers it. */
function namesAt(version: string, loc: "kor" | "eng") {
  const cacheKey = `${version}:${loc}`;
  if (namesCache.has(cacheKey)) return namesCache.get(cacheKey)!;
  const builds = existsSync(BUILDS) ? readdirSync(BUILDS).filter((d) => /^\d+\.\d+(\.\d+)?$/.test(d) && existsSync(path.join(BUILDS, d, "canonical/loc", loc))) : [];
  const build = builds.filter((d) => cmpVersion(d, version) <= 0).sort(cmpVersion).pop();
  let result: { build: string; names: Map<string, string[]> } | null = null;
  if (build) {
    const names = new Map<string, string[]>();
    const dir = path.join(BUILDS, build, "canonical/loc", loc);
    for (const file of readdirSync(dir)) {
      for (const [k, v] of Object.entries(JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<string, unknown>)) {
        if (typeof v !== "string" || !/\.(title|name)$/.test(k)) continue;
        const ref = `${file.replace(/\.json$/, "")}:${k.replace(/\.(title|name)$/, "")}`;
        names.set(v.trim(), [...(names.get(v.trim()) ?? []), ref]);
      }
    }
    result = { build, names };
  }
  namesCache.set(cacheKey, result);
  return result;
}
const currentName = (loc: "kor" | "eng", ref: string) => {
  const [table, key] = ref.split(":");
  const file = path.join(root, "data/sts2/localization", loc, `${table}.json`);
  if (!existsSync(file)) return undefined;
  const t = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  return t[`${key}.title`] ?? t[`${key}.name`];
};

type SearchItem = { id: string; type: string; title: string; titleEn?: string; href?: string };
function find({ args, opts }: Flags) {
  const q = args.join(" ").toLowerCase();
  if (!q) throw new Error("find <text>");
  if (opts.at) {
    let hits = 0;
    for (const loc of ["kor", "eng"] as const) {
      const at = namesAt(opts.at, loc);
      if (!at) throw new Error(`no archived build at or before ${opts.at} in ${BUILDS}`);
      for (const [name, refs] of at.names) {
        if (!name.toLowerCase().includes(q)) continue;
        for (const ref of refs) {
          const now = currentName(loc, ref);
          console.log(`${loc}\t${ref}\t${name}\tat ${at.build}\tnow ${now ?? "(gone)"}${now === name ? "" : "  <- renamed"}`);
          if (++hits >= Number(opts.limit ?? 10)) return;
        }
      }
    }
    if (!hits) process.exitCode = 1;
    return;
  }
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

// StaticHoverTip values the game attaches to card/relic/power text (HoverTipFactory.Static/ForEnergy/ForArrow in the DLL).
// Every other static_hover_tips entry (piles, deck, gold, HP, rooms, map) only shows on UI widgets.
const GAMEPLAY_STATIC_TIPS = ["ARROW", "BLOCK", "CHANNELING", "EVOKE", "TRANSFORM", "FATAL", "ENERGY", "STUN", "FORGE", "SUMMON_STATIC", "SUMMON_DYNAMIC", "REPLAY_STATIC", "REPLAY_DYNAMIC", "COOK", "WAH_MELODY", "CHO_MELODY", "KI_MELODY", "TAROT"];
function gameTerms(loc: "kor" | "eng") {
  const dir = path.join(root, "data/sts2/localization", loc);
  const strings = (file: string) => Object.entries(JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<string, string>);
  const title = (v: string) => v.replace(/\{Hotkey[^}]*\}\}?|\{[A-Za-z]+\}/g, "").trim();
  const gameplay = new Set<string>(strings("card_keywords.json").filter(([k]) => k.endsWith(".title")).map(([, v]) => title(v)));
  const ui = new Set<string>();
  for (const [k, v] of strings("static_hover_tips.json")) {
    if (!k.endsWith(".title")) continue;
    (GAMEPLAY_STATIC_TIPS.includes(k.slice(0, -6)) ? gameplay : ui).add(title(v));
  }
  // Cards, powers, relics, potions, enchantments, afflictions and orbs get their own tip wherever game text names them.
  const entities = new Map<string, string>();
  for (const kind of ["cards", "powers", "relics", "potions", "enchantments", "afflictions"]) {
    const file = path.join(root, "data/sts2", loc, `${kind}.json`);
    for (const e of JSON.parse(readFileSync(file, "utf8")) as { name?: string }[]) if (e.name) entities.set(e.name.trim(), kind.replace(/s$/, ""));
  }
  for (const [k, v] of strings("orbs.json")) if (k.endsWith(".title")) entities.set(title(v), "orb");
  const gold = new Set<string>();
  const values = new Set<string>();
  for (const file of readdirSync(dir)) {
    for (const [, v] of strings(file)) {
      if (typeof v !== "string") continue;
      values.add(v.trim());
      for (const [, g] of v.matchAll(/\[gold\]([^[]+)\[\/gold\]/g)) gold.add(g.trim());
    }
  }
  return { gameplay, ui, gold, values, entities };
}

type Verdict = { mismatch: boolean; text: string };
function verdict(game: ReturnType<typeof gameTerms>, loc: "kor" | "eng", term: string): Verdict {
  const base = term.replace(/\+$/, "");
  const lower = base.toLowerCase();
  if (game.gameplay.has(base)) return { mismatch: true, text: "MISMATCH the game shows a hover tip for this in card text" };
  // English inflections (Exhausted, replays, Arrows) still get the keyword's tip in game.
  const inflected = [...game.gameplay].find((t) => loc === "eng" && t.length > 3 && lower !== t.toLowerCase() && (lower.startsWith(t.toLowerCase()) || t.toLowerCase().startsWith(lower)));
  if (inflected) return { mismatch: true, text: `MISMATCH inflected ${inflected}: the game shows its tip` };
  const kind = game.entities.get(base);
  if (kind) return { mismatch: true, text: `MISMATCH a game ${kind}: the game shows its tip` };
  if (game.ui.has(base)) return { mismatch: false, text: "ok game tip only on UI widgets; card text is gold only" };
  if (game.gold.has(base)) return { mismatch: false, text: "ok game text colors it gold without a tip" };
  if (game.values.has(base)) return { mismatch: false, text: "name a game name with no Compendium page here" };
  return { mismatch: true, text: "WORDING not a game term: check the official wording" };
}

const PLAIN_GOLD_RE = /<span class="font-game-text spire-gold font-semibold">([^<]+)<\/span>/g;
const decode = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function pagePaths(args: string[]): string[] {
  if (args.some((a) => a.startsWith("/"))) return args;
  const patches = json<{ version: string }[]>("data/sts2-patches.json").map((p) => `/patches/${p.version}`);
  const letters = json<{ id: string }[]>("data/sts2-neowsletters.json").map((n) => `/patches/neowsletters/${n.id}`);
  const ko = args.length ? args.map((v) => `/patches/${v.replace(/^v/, "")}`) : [...patches, ...letters];
  return ko.flatMap((p) => [p, `/en${p}`]);
}

// Gold text that rendered without a hover/link on the real pages, checked against how the game renders the term.
// Reads production by default, or a local build with --dir .patch-worker/assets (after pnpm patch:build).
async function tags({ args, opts }: Flags) {
  const game = { kor: gameTerms("kor"), eng: gameTerms("eng") };
  const rows = new Map<string, { loc: "kor" | "eng"; term: string; v: Verdict; pages: Set<string> }>();
  let missing = 0;
  for (const page of pagePaths(args)) {
    let html = "";
    if (opts.dir) {
      const file = path.join(root, opts.dir, page, "index.html");
      if (!existsSync(file)) { missing++; continue; }
      html = readFileSync(file, "utf8");
    } else {
      const res = await fetch(new URL(page, HOSTS[opts.host ?? "prod"] ?? opts.host));
      if (!res.ok) { missing++; continue; }
      html = await res.text();
    }
    const loc = page.startsWith("/en/") ? "eng" : "kor";
    const version = page.match(/\/patches\/(\d+\.\d+(?:\.\d+)?)$/)?.[1];
    for (const [, raw] of html.matchAll(PLAIN_GOLD_RE)) {
      const term = decode(raw).trim();
      let v = verdict(game[loc], loc, term);
      // A name the game used at this patch's build but renamed since: right for the page, the site only knows the new name.
      const ref = version && v.text.startsWith("WORDING") ? namesAt(version, loc)?.names.get(term)?.[0] : undefined;
      if (ref) v = { mismatch: true, text: `MISMATCH ${ref} was named this at ${namesAt(version!, loc)!.build} (now ${currentName(loc, ref) ?? "gone"}); site matches only the current name` };
      const key = `${loc}\t${term}\t${v.text}`;
      const row = rows.get(key) ?? { loc, term, v, pages: new Set<string>() };
      row.pages.add(page.replace(/^\/en/, ""));
      rows.set(key, row);
    }
  }
  const out = [...rows.values()];
  out.sort((a, b) => a.v.text.localeCompare(b.v.text) || b.pages.size - a.pages.size);
  const all = opts.all !== undefined;
  for (const r of out) if (all || r.v.mismatch) console.log(`${r.v.text}\t${r.loc}\t${r.term}\t${r.pages.size}p\t${[...r.pages].slice(0, 4).join(" ")}${r.pages.size > 4 ? " ..." : ""}`);
  if (missing) console.error(`${missing} page(s) not found`);
  if (out.some((r) => r.v.mismatch)) process.exitCode = 1;
}

type SteamItem ={ gid: string; title: string; date: number; contents: string };
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
