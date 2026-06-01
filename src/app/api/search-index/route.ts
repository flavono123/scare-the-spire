import { NextResponse } from "next/server";
import { loadAllEntities } from "@/lib/load-all-entities";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";

export const dynamic = "force-static";

type SearchIndexItem = {
  id: string;
  type: EntityType;
  title: string;
  titleEn: string;
  imageUrl: string | null;
  href: string;
};

const TYPE_TO_COMPENDIUM_PATH: Partial<Record<EntityType, string>> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
  power: "powers",
  enchantment: "enchantments",
  affliction: "enchantments",
  event: "events",
  monster: "monsters",
  encounter: "encounters",
  ancient: "ancients",
  epoch: "epochs",
};

function entityHref(entity: EntityInfo): string | null {
  if (entity.href) return entity.href;

  if (entity.type === "affliction") {
    return `/compendium/enchantments?affliction=${entity.id.toLowerCase()}`;
  }

  const path = TYPE_TO_COMPENDIUM_PATH[entity.type];
  if (!path) return null;
  return `/compendium/${path}/${entity.id.toLowerCase()}`;
}

export async function GET() {
  const entities = await loadAllEntities({ gameLocale: "kor" });
  const items: SearchIndexItem[] = entities
    .map((entity) => {
      const href = entityHref(entity);
      if (!href) return null;

      return {
        id: entity.id,
        type: entity.type,
        title: entity.nameKo,
        titleEn: entity.nameEn,
        imageUrl: entity.imageUrl,
        href,
      };
    })
    .filter((item): item is SearchIndexItem => Boolean(item));

  return NextResponse.json({ items });
}
