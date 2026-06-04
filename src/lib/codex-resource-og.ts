import type { Metadata } from "next";
import { getCodexMetadata } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import {
  MONSTER_TYPE_CONFIG,
  type CodexEncounter,
  type CodexMonster,
} from "@/lib/codex-types";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";

export type RouteSearchParamValue = string | string[] | undefined;

export type CodexOgResource = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export function firstRouteSearchParam(value: RouteSearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function findCodexResourceByRouteId<T extends { id: string }>(
  resources: T[],
  id: string | undefined,
): T | undefined {
  if (!id) return undefined;
  return resources.find((item) => item.id.toLowerCase() === id.toLowerCase());
}

export function plainCodexOgDescription(description: string | null | undefined): string {
  return stripCodexMarkup(description ?? "").replace(/\s+/g, " ").trim();
}

export function firstCodexImageUrl(
  ...urls: Array<string | null | undefined>
): string | null {
  return urls.find((url): url is string => Boolean(url)) ?? null;
}

export function getCodexMonsterOgResource(
  monster: CodexMonster,
  serviceLocale: ServiceLocale,
): CodexOgResource {
  const typeLabel = serviceLocale === "ko"
    ? MONSTER_TYPE_CONFIG[monster.type].label
    : monster.type;
  const hpRange = monster.minHp == null
    ? null
    : monster.maxHp == null || monster.minHp === monster.maxHp
    ? String(monster.minHp)
    : `${monster.minHp}-${monster.maxHp}`;

  return {
    name: monster.name,
    description: serviceLocale === "ko"
      ? hpRange ? `${typeLabel} 몬스터 · 체력 ${hpRange}` : `${typeLabel} 몬스터`
      : hpRange ? `${typeLabel} monster · HP ${hpRange}` : `${typeLabel} monster`,
    imageUrl: firstCodexImageUrl(monster.imageUrl, monster.bossImageUrl),
  };
}

export function getCodexEncounterOgResource(
  encounter: CodexEncounter,
  monsters: CodexMonster[],
  serviceLocale: ServiceLocale,
): CodexOgResource {
  const encounterMonsterAssets = encounter.monsters
    .map((monsterRef) => monsters.find((monster) => monster.id === monsterRef.id))
    .flatMap((monster) => monster ? [monster.imageUrl, monster.bossImageUrl] : []);
  const characterLabel = serviceLocale === "ko" ? "도전자" : "the character";
  const lossText = plainCodexOgDescription(
    encounter.lossText
      .replaceAll("{encounter}", encounter.name)
      .replaceAll("{character}", characterLabel),
  );

  return {
    name: encounter.name,
    description: lossText || encounter.monsters.map((monster) => monster.name).join(", "),
    imageUrl: firstCodexImageUrl(encounter.imageUrl, ...encounterMonsterAssets),
  };
}

export function getCodexResourceOgMetadata(
  serviceLocale: ServiceLocale,
  collectionTitle: string,
  resource: CodexOgResource,
): Metadata {
  const metadata = getCodexMetadata(serviceLocale, `${resource.name} — ${collectionTitle}`);
  const description = plainCodexOgDescription(resource.description) || metadata.description;
  const imageUrl = resource.imageUrl ?? DEFAULT_PAGE_OG_IMAGE.url;
  const image = {
    url: imageUrl,
    alt: resource.name,
  };

  return {
    ...metadata,
    description,
    openGraph: {
      title: resource.name,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.name,
      description,
      images: [imageUrl],
    },
  };
}
