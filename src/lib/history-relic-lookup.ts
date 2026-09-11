import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexRelic } from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";

function relicIdVariants(id: string): string[] {
  const withoutPrefix = id.replace(/^RELIC\./i, "");
  const stripped = withoutPrefix.replace(/\.(eventDescription|title|description)$/i, "");
  return [...new Set([id, withoutPrefix, stripped, `RELIC.${stripped}`])];
}

export function lookupHistoryRelicByTitle(
  relicsById: Record<string, CodexRelic> | undefined,
  title: string,
): CodexRelic | undefined {
  if (!relicsById || !title) return undefined;
  const wanted = title.trim().toLowerCase();
  if (!wanted) return undefined;
  for (const relic of Object.values(relicsById)) {
    if (relic.name.trim().toLowerCase() === wanted) return relic;
    if (relic.nameEn.trim().toLowerCase() === wanted) return relic;
  }
  return undefined;
}

export function lookupHistoryRelic(
  relicsById: Record<string, CodexRelic> | undefined,
  id: string,
): CodexRelic | undefined {
  if (!relicsById) return undefined;
  const variants = relicIdVariants(id);
  for (const key of variants) {
    const hit = relicsById[key];
    if (hit) return hit;
  }
  const wanted = variants[variants.length - 1]?.replace(/^RELIC\./i, "").toUpperCase();
  if (!wanted) return undefined;
  for (const [key, relic] of Object.entries(relicsById)) {
    if (key.replace(/^RELIC\./i, "").toUpperCase() === wanted) return relic;
  }
  return undefined;
}

export function indexCodexRelics(relics: CodexRelic[]): Record<string, CodexRelic> {
  const out: Record<string, CodexRelic> = {};
  for (const relic of relics) {
    out[relic.id] = relic;
    out[`RELIC.${relic.id}`] = relic;
  }
  return out;
}

export function buildRelicEntityInfo(relic: CodexRelic | undefined): EntityInfo | null {
  if (!relic) return null;
  return {
    id: relic.id,
    nameEn: relic.nameEn,
    nameKo: relic.name,
    imageUrl: relic.imageUrl,
    href: buildCompendiumResourceHref("relic", relic.id),
    color: relic.pool,
    type: "relic",
    relicData: relic,
  };
}
