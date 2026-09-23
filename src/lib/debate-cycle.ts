import sts2Meta from "../../data/sts2/meta.json";
import { buildCompendiumResourceDetailHref, isCompendiumResourceLinkType } from "@/lib/compendium-resource-links";

export const DEBATE_CYCLES_TABLE = "debate_cycles";

export const DEBATE_GAME_VERSION = sts2Meta.version;

export const DEBATE_RESOURCE_TYPES = [
  "affliction",
  "ancient",
  "card",
  "character",
  "enchantment",
  "encounter",
  "epoch",
  "event",
  "monster",
  "potion",
  "power",
  "relic",
] as const;

export type DebateResourceType = (typeof DEBATE_RESOURCE_TYPES)[number];

export interface DebateSubject {
  id: string;
  resourceType: DebateResourceType;
  resourceId: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
  href: string;
  gameVersion: string;
  openedAt: string;
}

export function isDebateResourceType(value: string): value is DebateResourceType {
  return (DEBATE_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function debateSubjectHref(resourceType: string, resourceId: string): string | null {
  if (!isDebateResourceType(resourceType) || !isCompendiumResourceLinkType(resourceType)) return null;
  const id = resourceId.trim();
  if (!id) return null;
  return buildCompendiumResourceDetailHref(resourceType, id);
}

export function debateSubjectFromRow(row: {
  id?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  name_ko?: unknown;
  name_en?: unknown;
  image_url?: unknown;
  href?: unknown;
  game_version?: unknown;
  opened_at?: unknown;
}): DebateSubject | null {
  if (typeof row.resource_type !== "string" || !isDebateResourceType(row.resource_type)) return null;
  if (typeof row.resource_id !== "string" || !row.resource_id.trim()) return null;
  if (typeof row.name_ko !== "string" || !row.name_ko.trim()) return null;
  if (typeof row.name_en !== "string" || !row.name_en.trim()) return null;
  if (typeof row.href !== "string" || !row.href.startsWith("/compendium/")) return null;
  if (typeof row.game_version !== "string" || !row.game_version.trim()) return null;
  if (typeof row.opened_at !== "string" || !row.opened_at) return null;
  if (typeof row.id !== "string" || !row.id) return null;

  return {
    id: row.id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    imageUrl: typeof row.image_url === "string" && row.image_url ? row.image_url : null,
    href: row.href,
    gameVersion: row.game_version,
    openedAt: row.opened_at,
  };
}

export function isMissingDebateCyclesTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /debate_cycles/i.test(error.message ?? "");
}
