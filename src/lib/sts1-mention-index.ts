import type { EntityInfo } from "@/components/patch-note-renderer";
import type { Sts1Card, Sts1Keyword, Sts1ResourceType, Sts1UiLabels } from "@/lib/sts1/types";

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
  flavor?: string;
  largeImageUrl?: string;
  card?: Sts1Card;
};

export type Sts1MentionIndex = {
  labels: { kor: Sts1UiLabels; eng: Sts1UiLabels };
  keywords: Sts1Keyword[];
  /** SingleViewRelicPopup TEXT[10], appended to the tier name. */
  relicPopupSuffix: { kor: string; eng: string };
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
