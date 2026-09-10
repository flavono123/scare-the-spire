import { STS1_IMAGE_CACHE_BUSTER } from "./image-cache";
import type { Sts1Card, Sts1Potion, Sts1Relic, Sts1ResourceType } from "./types";

export const STS1_IMAGE_ROOT = "/images/sts1";

function sts1Asset(path: string): string {
  const hashIndex = path.indexOf("#");
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const params = new URLSearchParams(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "");
  if (!params.has("v")) params.set("v", STS1_IMAGE_CACHE_BUSTER);
  return `${pathname}?${params.toString()}${hash}`;
}

export function sts1CardPortraitUrl(card: Sts1Card, showBeta = false): string {
  const folder = showBeta && card.hasBetaArt ? "cards-beta" : "cards";
  return sts1Asset(`${STS1_IMAGE_ROOT}/${folder}/${card.slug}.webp`);
}

export function sts1RelicImageUrl(relic: Sts1Relic, large = false): string {
  const folder = large ? "relics-large" : "relics";
  return sts1Asset(`${STS1_IMAGE_ROOT}/${folder}/${relic.slug}.webp`);
}

export function sts1PotionImageUrl(potion: Sts1Potion): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/potions/${potion.slug}.webp`);
}

export function sts1CardUiUrl(region: string): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/card-ui/${region}.webp`);
}

export function sts1CardUi512Url(region: string): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/card-ui-512/${region}.webp`);
}

export function sts1CharacterIconUrl(
  id: "ironclad" | "silent" | "defect" | "watcher",
): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/characters/${id}.webp`);
}

export function sts1CardLibraryTabUrl(
  tab: "redTab" | "greenTab" | "blueTab" | "purpleTab" | "colorlessTab" | "curseTab",
): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/card-library/${tab}.webp`);
}

export function sts1CardLibraryUiUrl(name: string): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/card-library/${name}.webp`);
}

export function sts1RunModUrl(name: string): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/run-mods/${name}.webp`);
}

export function sts1TipUrl(part: "tipTop" | "tipMid" | "tipBot" | string): string {
  return sts1Asset(`${STS1_IMAGE_ROOT}/tips/${part}.webp`);
}

export function sts1IndexPath(type: Sts1ResourceType): string {
  return `/compendium/sts1/${type}`;
}

export function sts1DetailPath(type: Sts1ResourceType, slug: string): string {
  return `/compendium/sts1/${type}/${slug}`;
}
