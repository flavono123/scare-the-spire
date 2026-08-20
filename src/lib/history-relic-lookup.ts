import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexRelic } from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";

export function lookupHistoryRelic(
  relicsById: Record<string, CodexRelic> | undefined,
  id: string,
): CodexRelic | undefined {
  if (!relicsById) return undefined;
  const stripped = id.replace(/^RELIC\./i, "");
  return relicsById[id] ?? relicsById[stripped] ?? relicsById[`RELIC.${stripped}`];
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
