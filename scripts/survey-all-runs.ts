import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeReplayRun, parseReplayRun } from "../src/lib/sts2-run-replay";

const RUN_DIR =
  "/Users/hansuk.hong/Library/Application Support/SlayTheSpire2/steam/76561199168753671/profile1/saves/history";

function parseBuild(b: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(b);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? "0")];
}
function buildAtLeast(a: string, b: string) {
  const pa = parseBuild(a),
    pb = parseBuild(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return true;
}

type Row = {
  fn: string;
  build: string;
  seed: string;
  asc: number;
  win: boolean;
  char: string;
  multi: boolean;
  acts: { id: string; status: string; matched: number; variant: string }[];
  spoilsCard: boolean;
  compass: boolean;
  furcoat: boolean;
  boots: boolean;
  bigGameHunter: boolean;
};

const rows: Row[] = [];

type RunJson = Record<string, unknown> & {
  build_id?: string;
  seed?: string;
  ascension?: number;
  win?: boolean;
  players?: Array<Record<string, unknown>>;
  modifiers?: Array<unknown>;
};

for (const fn of readdirSync(RUN_DIR)) {
  if (!fn.endsWith(".run")) continue;
  let d: RunJson;
  try {
    d = JSON.parse(readFileSync(join(RUN_DIR, fn), "utf8")) as RunJson;
  } catch {
    continue;
  }
  if (!buildAtLeast(d.build_id ?? "", "v0.103.0")) continue;
  let analysis;
  try {
    const run = parseReplayRun(JSON.stringify(d));
    analysis = analyzeReplayRun(run);
  } catch {
    const p0err = d.players?.[0] as { character?: string } | undefined;
    rows.push({
      fn,
      build: d.build_id ?? "",
      seed: d.seed ?? "",
      asc: d.ascension ?? 0,
      win: !!d.win,
      char: (p0err?.character ?? "").split(".").pop() ?? "?",
      multi: (d.players ?? []).length > 1,
      acts: [{ id: "ERR", status: "PARSE_ERR", matched: 0, variant: "-" }],
      spoilsCard: false,
      compass: false,
      furcoat: false,
      boots: false,
      bigGameHunter: false,
    });
    continue;
  }

  const p0 = d.players?.[0] as
    | {
        character?: string;
        relics?: Array<{ id?: string }>;
        deck?: Array<{ id?: string }>;
      }
    | undefined;
  const relicIds = new Set<string>(
    (p0?.relics ?? []).map((r) => String(r?.id ?? "").toUpperCase()),
  );
  const deckIds = new Set<string>(
    (p0?.deck ?? []).map((c) => String(c?.id ?? "").toUpperCase()),
  );
  const modIds = new Set<string>(
    (d.modifiers ?? []).map((m) => {
      if (typeof m === "string") return m.toUpperCase();
      const obj = m as { id?: string; name?: string } | null;
      return String(obj?.id ?? obj?.name ?? "").toUpperCase();
    }),
  );

  rows.push({
    fn,
    build: d.build_id ?? "",
    seed: d.seed ?? "",
    asc: d.ascension ?? 0,
    win: !!d.win,
    char: (p0?.character ?? "").split(".").pop() ?? "?",
    multi: (d.players ?? []).length > 1,
    acts: analysis.acts.map((a) => ({
      id: a.actId,
      status:
        a.matchedPathCount === 0
          ? "ZERO"
          : a.exactReplay
            ? "EXACT"
            : `${a.matchedPathCount}+`,
      matched: a.matchedPathCount,
      variant: a.mapVariant,
    })),
    spoilsCard: Array.from(deckIds).some((id) => id.includes("SPOILS_MAP")),
    compass: Array.from(relicIds).some((id) => id.includes("GOLDEN_COMPASS")),
    furcoat: Array.from(relicIds).some((id) => id.includes("FUR_COAT")),
    boots: Array.from(relicIds).some((id) => id.includes("WINGED_BOOTS")),
    bigGameHunter: Array.from(modIds).some((id) => id.includes("BIG_GAME")),
  });
}

const totalActs = rows.reduce((sum, r) => sum + r.acts.length, 0);
const exact = rows.reduce(
  (sum, r) => sum + r.acts.filter((a) => a.status === "EXACT").length,
  0,
);
const zero = rows.reduce(
  (sum, r) => sum + r.acts.filter((a) => a.status === "ZERO").length,
  0,
);
const amb = rows.reduce(
  (sum, r) => sum + r.acts.filter((a) => a.status !== "EXACT" && a.status !== "ZERO").length,
  0,
);

console.log(
  `\nTotal: ${rows.length} runs · ${totalActs} acts · EXACT ${exact} · ambiguous ${amb} · ZERO ${zero}\n`,
);

// Group by build version
const byBuild = new Map<string, { runs: number; exact: number; zero: number }>();
for (const r of rows) {
  const k = r.build;
  const cur = byBuild.get(k) ?? { runs: 0, exact: 0, zero: 0 };
  cur.runs++;
  for (const a of r.acts) {
    if (a.status === "EXACT") cur.exact++;
    if (a.status === "ZERO") cur.zero++;
  }
  byBuild.set(k, cur);
}
console.log("Build 분포:");
for (const [k, v] of byBuild) {
  console.log(`  ${k}: ${v.runs} runs, exact ${v.exact}, zero ${v.zero}`);
}

console.log("\n=== ZERO 보유 런만 출력 ===");
for (const r of rows) {
  const zeros = r.acts.filter((a) => a.status === "ZERO");
  if (zeros.length === 0) continue;
  const flags = [
    r.multi ? "MP" : "",
    r.boots ? "boots" : "",
    r.compass ? "compass" : "",
    r.furcoat ? "furcoat" : "",
    r.spoilsCard ? "spoils" : "",
    r.bigGameHunter ? "BGH" : "",
  ].filter(Boolean);
  const actSummary = r.acts
    .map((a) => `${a.id.split(".").pop()}:${a.status}${a.variant !== "standard" ? "/" + a.variant.slice(0, 2) : ""}`)
    .join(" ");
  console.log(
    `  ${r.fn} ${r.build} ${r.seed} A${r.asc} ${r.win ? "W" : "L"} ${r.char} [${flags.join(",")}] | ${actSummary}`,
  );
}
