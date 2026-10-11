import type { EntityInfo } from "@/components/patch-note-renderer";
import type { Sts1ResourceType, Sts1UiLabels } from "@/lib/sts1/types";

export type Sts1MentionEntry = {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  resource: Sts1ResourceType;
  entityType: "card" | "relic" | "potion" | "power" | "character";
  imageUrl: string;
  href: string;
  description: string;
  color?: string;
  cardType?: string;
  rarity?: string;
  cost?: number;
  pool?: string;
  tier?: string;
  powerType?: string;
};

export type Sts1MentionIndex = {
  labels: { kor: Sts1UiLabels; eng: Sts1UiLabels };
  entries: Sts1MentionEntry[];
};

export type Sts1MentionEntity = EntityInfo & { mentionDescription?: string };

export function sts1MentionEntity(entry: Sts1MentionEntry): Sts1MentionEntity {
  return {
    id: entry.id,
    nameKo: entry.nameKo,
    nameEn: entry.nameEn,
    imageUrl: entry.imageUrl,
    href: entry.href,
    color: entry.color ?? entry.pool ?? "",
    type: entry.entityType,
    mentionDescription: entry.description,
  };
}
