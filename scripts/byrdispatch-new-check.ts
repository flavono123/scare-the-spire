/**
 * Release helper: suggests which places should carry NEW in this release's byrdispatch.
 * A place added to src/data/place-registry.json since the last production deploy should have a
 * `byrdispatchSectionTitle` and a matching `### <title> (new)` section; a `(new)` section that no
 * place points at lights nothing. Prints suggestions only; never edits files.
 *
 *   pnpm byrdispatch:new-check [--base <sha>]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getLatestByrdispatchEntry } from "../src/lib/byrdispatch";

type RegistryPlace = { id: string; label?: { ko?: string }; byrdispatchSectionTitle?: string; menuHidden?: boolean };

const REGISTRY = "src/data/place-registry.json";

function lastDeployedSha(): string {
  const argIndex = process.argv.indexOf("--base");
  if (argIndex !== -1 && process.argv[argIndex + 1]) return process.argv[argIndex + 1];
  const out = execFileSync("gh", [
    "run", "list", "--workflow", "cloudflare-workers.yml", "--status", "success", "-L", "1", "--json", "headSha",
  ], { encoding: "utf8" });
  const sha = (JSON.parse(out) as { headSha?: string }[])[0]?.headSha;
  if (!sha) throw new Error("No successful production deploy found; pass --base <sha>.");
  return sha;
}

function placesAt(raw: string): RegistryPlace[] {
  return (JSON.parse(raw) as { places: RegistryPlace[] }).places;
}

async function main() {
  const base = lastDeployedSha();
  let before: RegistryPlace[] | null = null;
  try {
    before = placesAt(execFileSync("git", ["show", `${base}:${REGISTRY}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    // The registry did not exist at base (added 2026-11-22), so there is nothing to diff against.
  }
  const now = placesAt(readFileSync(REGISTRY, "utf8"));
  const beforeIds = new Set(before?.map((place) => place.id));
  const added = before ? now.filter((place) => !beforeIds.has(place.id)) : [];

  const latest = await getLatestByrdispatchEntry();
  const newTitles = new Set(latest?.regularSections.filter((s) => s.statuses.includes("new")).map((s) => s.title) ?? []);
  const baseDate = execFileSync("git", ["show", "-s", "--format=%cs", base], { encoding: "utf8" }).trim();

  console.log(`base ${base.slice(0, 8)} (${baseDate}), latest byrdispatch ${latest?.date ?? "none"}`);
  if (!before) console.log(`${REGISTRY} is newer than the base, so added places cannot be listed this time.`);
  const suggestions: string[] = [];
  if (!latest || latest.date < baseDate) suggestions.push("Write this release's byrdispatch first: the latest one predates the last deploy.");
  for (const place of added) {
    const name = place.label?.ko ?? place.id;
    if (!place.byrdispatchSectionTitle) {
      suggestions.push(`NEW? ${place.id} (${name}) is new since the last deploy: set byrdispatchSectionTitle and add "### ${name} (new)".`);
    } else if (!newTitles.has(place.byrdispatchSectionTitle)) {
      suggestions.push(`NEW? ${place.id}: add "### ${place.byrdispatchSectionTitle} (new)" to the byrdispatch.`);
    }
  }
  const pointed = new Set(now.map((place) => place.byrdispatchSectionTitle).filter(Boolean));
  for (const title of newTitles) {
    if (!pointed.has(title)) suggestions.push(`"${title} (new)" matches no place's byrdispatchSectionTitle, so no NEW marker shows for it.`);
  }

  console.log(suggestions.length ? suggestions.map((line) => `- ${line}`).join("\n") : "NEW markers match the places added since the last deploy.");
}

void main();
