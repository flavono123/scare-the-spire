import { NextResponse } from "next/server";
import { getStories, getSTS2Patches, getSTS2Stories } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";

export const dynamic = "force-static";

type SearchItemType = EntityType | "patch" | "story";

type SearchIndexItem = {
  id: string;
  type: SearchItemType;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
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
        description: "",
        descriptionEn: "",
        imageUrl: entity.imageUrl,
        href,
      };
    })
    .filter((item): item is SearchIndexItem => Boolean(item));

  const [patches, stories, sts2Stories] = await Promise.all([
    getSTS2Patches(),
    getStories(),
    getSTS2Stories(),
  ]);

  const patchItems: SearchIndexItem[] = patches.map((patch) => ({
    id: patch.id,
    type: "patch",
    title: `${patch.versionLabelKo ?? patch.id} ${patch.titleKo}`,
    titleEn: `${patch.versionLabel ?? patch.id} ${patch.title}`,
    description: [patch.summaryKo, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
    descriptionEn: [patch.summary, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
    imageUrl: "/images/sts2/nav/patch_notes_icon.png",
    href: `/patches/${patch.version}`,
  }));

  const storyItems: SearchIndexItem[] = [...stories, ...sts2Stories].map((story) => ({
    id: story.id,
    type: "story",
    title: story.sentence,
    titleEn: story.sentence,
    description: [
      story.game,
      story.entityType,
      story.entityId,
      story.changeId,
      story.source,
      ...(story.tags ?? []),
      ...(story.linkedEntities?.map((entity) => `${entity.entityType} ${entity.entityId} ${entity.label ?? ""}`) ?? []),
    ].filter(Boolean).join(" "),
    descriptionEn: "",
    imageUrl: "/images/bone_tea.png",
    href: `/#${story.id}`,
  }));

  return NextResponse.json({ items: [...patchItems, ...storyItems, ...items] });
}
