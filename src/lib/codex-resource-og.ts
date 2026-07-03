import type { Metadata } from "next";
import { getCodexMetadata } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  type CodexEncounter,
  type CodexMonster,
} from "@/lib/codex-types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";

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
  gameUi: CodexGameUiLabels,
): CodexOgResource {
  const typeLabel = gameUi.monsterTypes[monster.type].label || monster.type;
  const hpRange = monster.minHp == null
    ? null
    : monster.maxHp == null || monster.minHp === monster.maxHp
    ? String(monster.minHp)
    : `${monster.minHp}-${monster.maxHp}`;

  return {
    name: monster.name,
    description: hpRange ? `${typeLabel} · ${hpRange}` : typeLabel,
    imageUrl: firstCodexImageUrl(monster.imageUrl, monster.bossImageUrl),
  };
}

const ENCOUNTER_CHARACTER_LABELS: Record<GameLocale, { subject: string; object: string }> = {
  kor: { subject: "도전자", object: "도전자" },
  eng: { subject: "the character", object: "the character" },
  zhs: { subject: "角色", object: "角色" },
  jpn: { subject: "キャラクター", object: "キャラクター" },
  deu: { subject: "der Charakter", object: "den Charakter" },
  fra: { subject: "le personnage", object: "le personnage" },
  ita: { subject: "il personaggio", object: "il personaggio" },
  spa: { subject: "el personaje", object: "el personaje" },
  esp: { subject: "el personaje", object: "el personaje" },
  ptb: { subject: "o personagem", object: "o personagem" },
  rus: { subject: "персонаж", object: "персонажа" },
  pol: { subject: "postać", object: "postać" },
  tha: { subject: "ตัวละคร", object: "ตัวละคร" },
  tur: { subject: "karakter", object: "karakter" },
};

function replaceEncounterPlaceholders(
  text: string,
  encounterName: string,
  gameLocale: GameLocale,
): string {
  const character = ENCOUNTER_CHARACTER_LABELS[gameLocale] ?? ENCOUNTER_CHARACTER_LABELS.eng;
  return text
    .replaceAll("{encounter}", encounterName)
    .replaceAll("{characterObject}", character.object)
    .replaceAll("{character}", character.subject)
    .replace(/\{characterGender:choose\([^)]*\):([^}|]*)(?:\|[^}]*)*\}/g, "$1");
}

export function getCodexEncounterOgResource(
  encounter: CodexEncounter,
  monsters: CodexMonster[],
  gameLocale: GameLocale,
): CodexOgResource {
  const encounterMonsterAssets = encounter.monsters
    .map((monsterRef) => monsters.find((monster) => monster.id === monsterRef.id))
    .flatMap((monster) => monster ? [monster.imageUrl, monster.bossImageUrl] : []);
  const lossText = plainCodexOgDescription(
    replaceEncounterPlaceholders(encounter.lossText, encounter.name, gameLocale),
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
  const imageUrl = absoluteSiteUrl(resource.imageUrl ?? DEFAULT_PAGE_OG_IMAGE.url);
  const image = {
    url: imageUrl,
    alt: resource.name,
  };

  return {
    ...metadata,
    metadataBase: SITE_METADATA_BASE,
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
