import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  buildCompendiumResourceHref,
  type CompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";

export type ThisOrThatResourceType = Exclude<EntityType, "monsterMove">;

export type ThisOrThatResourceRef = {
  type: ThisOrThatResourceType;
  id: string;
};

export interface ThisOrThatPost {
  id: string;
  user_id: string;
  nickname: string;
  left_type: ThisOrThatResourceType;
  left_id: string;
  right_type: ThisOrThatResourceType;
  right_id: string;
  reason: string;
  env: string;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  left_vote_count?: number;
  right_vote_count?: number;
  vote_rate_bps?: number;
}

export interface ThisOrThatResolvedPost {
  post: ThisOrThatPost;
  leftEntity: EntityInfo;
  rightEntity: EntityInfo;
}

const RESOURCE_LINK_TYPES: Record<ThisOrThatResourceType, CompendiumResourceLinkType> = {
  affliction: "affliction",
  ancient: "ancient",
  card: "card",
  character: "character",
  enchantment: "enchantment",
  encounter: "encounter",
  epoch: "epoch",
  event: "event",
  keyword: "keyword",
  monster: "monster",
  potion: "potion",
  power: "power",
  relic: "relic",
  modifier: "modifier",
  ascension: "ascension",
};

export const THIS_OR_THAT_RESOURCE_TYPES = Object.keys(
  RESOURCE_LINK_TYPES,
) as ThisOrThatResourceType[];

export function thisOrThatResourceKey(
  type: ThisOrThatResourceType,
  id: string,
): string {
  return `${type}:${id.toLowerCase()}`;
}

export function entityToThisOrThatRef(entity: EntityInfo): ThisOrThatResourceRef | null {
  if (!isThisOrThatResourceType(entity.type)) return null;
  return { type: entity.type, id: entity.id };
}

export function isThisOrThatResourceType(type: EntityType): type is ThisOrThatResourceType {
  return type in RESOURCE_LINK_TYPES;
}

export function isSameThisOrThatResource(
  left: ThisOrThatResourceRef | null,
  right: ThisOrThatResourceRef | null,
): boolean {
  return Boolean(left && right && left.type === right.type && left.id === right.id);
}

export function getThisOrThatEntityHref(entity: EntityInfo): string | null {
  if (!isThisOrThatResourceType(entity.type)) return null;
  if (entity.availability === "pending-compendium" || entity.href === null) return null;
  if (entity.href) return entity.href;

  const routeId = (entity.compendiumResourceId ?? entity.id).toLowerCase();
  return buildCompendiumResourceHref(RESOURCE_LINK_TYPES[entity.type], routeId);
}

export function buildThisOrThatEntityMap(
  entities: EntityInfo[],
): Map<string, EntityInfo> {
  const map = new Map<string, EntityInfo>();
  for (const entity of entities) {
    if (!isThisOrThatResourceType(entity.type)) continue;
    map.set(thisOrThatResourceKey(entity.type, entity.id), entity);
  }
  return map;
}

export function createMissingThisOrThatEntity(
  type: ThisOrThatResourceType,
  id: string,
): EntityInfo {
  return {
    id,
    nameEn: id,
    nameKo: id,
    imageUrl: null,
    href: null,
    availability: "pending-compendium",
    color: "",
    type,
    keywordData: {
      description: id,
    } as EntityInfo["keywordData"],
  };
}

export function resolveThisOrThatPost(
  post: ThisOrThatPost,
  entityMap: Map<string, EntityInfo>,
): ThisOrThatResolvedPost {
  return {
    post,
    leftEntity:
      entityMap.get(thisOrThatResourceKey(post.left_type, post.left_id))
      ?? createMissingThisOrThatEntity(post.left_type, post.left_id),
    rightEntity:
      entityMap.get(thisOrThatResourceKey(post.right_type, post.right_id))
      ?? createMissingThisOrThatEntity(post.right_type, post.right_id),
  };
}
