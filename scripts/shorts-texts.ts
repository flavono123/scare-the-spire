/**
 * Export the game text of every captured shot in every game locale, for
 * subtitles. Reads the same batch file `shorts:capture` used, so the order is
 * the video order.
 *
 *   pnpm shorts:texts --batch ~/P/slseoun-shorts/kdenlive/stills/v0.111.0/shots.json
 *   pnpm shorts:texts --batch shots.json --locales eng,jpn --out texts.json
 *
 * Writes `texts.json` next to the batch unless `--out` is given.
 *
 * Older versions are rebuilt from patch diffs, and diffs store the old
 * description in Korean only. When only numbers changed, the locale's own
 * template is baked with the old numbers. When the wording itself changed, the
 * old text does not exist in that locale; the shot gets `description: null`
 * and `source: "unavailable"`.
 */

import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bakeDescription } from "../src/lib/codex-bake";
import { getCodexMeta } from "../src/lib/data";
import { varsForBake } from "../src/lib/entity-versioning";
import { GAME_LOCALES, type GameLocale } from "../src/lib/i18n";
import type { CodexCard } from "../src/lib/codex-types";
import {
  getCardDisplayKeywords,
  getCardKeywordDisplayText,
  splitCardDisplayKeywords,
} from "../src/lib/sts2-card-keywords";
import type { VersionedEntityType } from "../src/lib/types";
import { getVersionedEntity } from "../src/lib/versioned-entity-api";

/** Compendium route segment -> versioned entity type. */
const ENTITY_TYPES: Record<string, VersionedEntityType> = {
  cards: "card",
  relics: "relic",
  potions: "potion",
  enchantments: "enchantment",
  powers: "power",
  monsters: "monster",
  events: "event",
};

const HANGUL = /[가-힣]/;

type Source = "version" | "rebaked" | "unavailable";

interface LocaleText {
  name: string | null;
  description: string | null;
  source: Source;
}

type Entity = Record<string, unknown> & { id: string };

const invokedFrom = process.env.INIT_CWD ?? process.cwd();

function resolvePath(value: string, from = invokedFrom): string {
  const expanded = value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
  return path.resolve(from, expanded);
}

/** Subtitle text: BBCode removed, energy and stars as symbols. */
function plain(text: string): string {
  return text
    .replace(/\[energy:(\d+)\]/g, (_, n: string) => "⚡".repeat(Number(n) || 1))
    .replace(/\[star:(\d+)\]/g, (_, n: string) => "★".repeat(Number(n) || 1))
    .replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, "")
    .trim();
}

/** Card tiles print keywords as "Keyword." lines before and after the text. */
function withKeywords(type: VersionedEntityType, entity: Entity, description: string): string {
  if (type !== "card" || !Array.isArray(entity.keywords)) return description;
  const card = entity as unknown as CodexCard;
  const { preDescriptionKeywords, postDescriptionKeywords } = splitCardDisplayKeywords(getCardDisplayKeywords(card));
  const line = (keyword: string) => `${getCardKeywordDisplayText(card, keyword)}.`;
  return [...preDescriptionKeywords.map(line), description, ...postDescriptionKeywords.map(line)]
    .filter(Boolean)
    .join("\n");
}

async function textFor(
  type: VersionedEntityType,
  id: string,
  version: string,
  locale: GameLocale,
  currentVersion: string,
): Promise<LocaleText> {
  const load = (at: string) =>
    getVersionedEntity<Entity>({ entityType: type, entityId: id, version: at, locale }).then((r) => r.entity);
  const [entity, current] = await Promise.all([load(version), load(currentVersion)]);
  const name = typeof entity?.name === "string" ? entity.name : null;
  const description = typeof entity?.description === "string" ? entity.description : null;
  if (!entity || description === null) return { name, description: null, source: "unavailable" };

  // A Korean string in another locale came from a reverted Korean diff.
  if (locale === "kor" || !HANGUL.test(description)) {
    return { name, description: withKeywords(type, entity, plain(description)), source: "version" };
  }
  const raw = entity.descriptionRaw;
  if (typeof raw === "string" && raw === current?.descriptionRaw && !HANGUL.test(raw)) {
    const baked = plain(bakeDescription(raw, varsForBake(type, id, entity.vars)));
    return { name, description: withKeywords(type, entity, baked), source: "rebaked" };
  }
  return { name, description: null, source: "unavailable" };
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const value = (flag: string) => {
    const at = args.indexOf(flag);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const batchArg = value("--batch");
  if (!batchArg) {
    console.log("usage: pnpm shorts:texts --batch shots.json [--locales all|eng,jpn] [--out texts.json]");
    process.exit(1);
  }
  const batchFile = resolvePath(batchArg);
  const localesArg = value("--locales") ?? "all";
  const locales = (localesArg === "all" ? [...GAME_LOCALES] : localesArg.split(",")) as GameLocale[];
  for (const locale of locales) {
    if (!(GAME_LOCALES as readonly string[]).includes(locale)) throw new Error(`unknown game locale: ${locale}`);
  }
  const out = value("--out") ? resolvePath(value("--out")!) : path.join(path.dirname(batchFile), "texts.json");

  const batch = JSON.parse(await readFile(batchFile, "utf8")) as { shots: { target?: string; out: string; replace?: unknown[] }[] };
  const { version: currentVersion } = await getCodexMeta();

  const shots = [];
  const unavailable: string[] = [];
  for (const shot of batch.shots) {
    const match = shot.target?.match(/^([a-z-]+)\/([^@]+)(?:@v?(.+))?$/);
    const type = match ? ENTITY_TYPES[match[1]] : undefined;
    if (!match || !type) {
      shots.push({ out: shot.out, target: shot.target ?? null, texts: null });
      continue;
    }
    const [, , id, version = currentVersion] = match;
    const texts: Partial<Record<GameLocale, LocaleText>> = {};
    for (const locale of locales) {
      texts[locale] = await textFor(type, id, version, locale, currentVersion);
      if (texts[locale]!.source === "unavailable") unavailable.push(`${shot.out} ${locale}`);
    }
    // A rewritten plate no longer matches the game text in any locale.
    shots.push({ out: shot.out, target: shot.target, edited: Boolean(shot.replace?.length), texts });
  }

  await writeFile(out, `${JSON.stringify({ currentVersion, locales, shots }, null, 2)}\n`);
  console.log(out);
  const byShot = new Map<string, string[]>();
  for (const entry of unavailable) {
    const [shot, locale] = entry.split(" ");
    byShot.set(shot, [...(byShot.get(shot) ?? []), locale]);
  }
  for (const [shot, missing] of byShot) {
    console.log(`  no ${missing.length === locales.length - 1 ? "non-Korean" : missing.join(",")} text: ${shot}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
