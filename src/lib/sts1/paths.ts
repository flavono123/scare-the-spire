import type { Sts1Card, Sts1Potion, Sts1Relic, Sts1ResourceType } from "./types";

export const STS1_IMAGE_ROOT = "/images/sts1";

export function sts1CardPortraitUrl(card: Sts1Card, showBeta = false): string {
  const folder = showBeta && card.hasBetaArt ? "cards-beta" : "cards";
  return `${STS1_IMAGE_ROOT}/${folder}/${card.slug}.webp`;
}

export function sts1RelicImageUrl(relic: Sts1Relic, large = false): string {
  const folder = large ? "relics-large" : "relics";
  return `${STS1_IMAGE_ROOT}/${folder}/${relic.slug}.webp`;
}

export function sts1PotionImageUrl(potion: Sts1Potion): string {
  return `${STS1_IMAGE_ROOT}/potions/${potion.slug}.webp`;
}

export function sts1CardUiUrl(region: string): string {
  return `${STS1_IMAGE_ROOT}/card-ui/${region}.webp`;
}

export function sts1CharacterIconUrl(
  id: "ironclad" | "silent" | "defect" | "watcher",
): string {
  return `${STS1_IMAGE_ROOT}/characters/${id}.webp`;
}

export function sts1IndexPath(type: Sts1ResourceType): string {
  return `/compendium/sts1/${type}`;
}

export function sts1DetailPath(type: Sts1ResourceType, slug: string): string {
  return `/compendium/sts1/${type}/${slug}`;
}
