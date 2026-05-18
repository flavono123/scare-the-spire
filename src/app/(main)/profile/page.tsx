import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCodexAncientSpineAssets,
  getCodexAncients,
  getCodexCharacters,
  getCodexCharacterSpineAssets,
  getCodexMonsters,
  getCodexSpineVfxAssets,
} from "@/lib/codex-data";
import type {
  CodexAncient,
  CodexCharacter,
  CodexMonster,
  MonsterSpineAsset,
  MonsterSpineEffectAsset,
} from "@/lib/codex-types";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleForGameLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import ProfilePage, {
  type AncientChoice,
  type CharacterChoice,
  type PetChoice,
  type ProfilePageCopy,
  type ProfileNicknameLocale,
} from "./profile-page";

type ProfileSearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ProfileSearchParams>;
}): Promise<Metadata> {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].profile;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

const CHARACTER_SLUGS: Record<string, string> = {
  IRONCLAD: "ironclad",
  SILENT: "silent",
  DEFECT: "defect",
  NECROBINDER: "necrobinder",
  REGENT: "regent",
};

const CHARACTER_ORDER = ["IRONCLAD", "SILENT", "REGENT", "NECROBINDER", "DEFECT"] as const;

const CHARACTER_NICKNAMES: Record<string, Record<ProfileNicknameLocale, readonly string[]>> = {
  IRONCLAD: {
    ko: ["아클단", "아평", "아이언클래스", "아이언클레임", "아이돌클라스", "아장연"],
    en: ["Clad", "The Clad", "Ironclad"],
  },
  SILENT: {
    ko: ["사일단", "사평", "사장연"],
    en: ["Silent", "The Silent", "Shiv Silent"],
  },
  REGENT: {
    ko: ["리황", "리평"],
    en: ["Regent", "Reggie", "King Reggie"],
  },
  NECROBINDER: {
    ko: ["네바", "네크로맨서", "네평", "골골맘", "네크단"],
    en: ["Necro", "Necrobinder", "Necro Binder"],
  },
  DEFECT: {
    ko: ["디평", "디펙터", "디황"],
    en: ["Defect", "The Defect", "Orb Defect"],
  },
};

const ANCIENT_BACKGROUND_IDS = new Set(["DARV", "NEOW", "OROBAS", "PAEL", "TANX", "TEZCATARA"]);
const ANCIENT_PROFILE_IMAGE_IDS = new Set(["NONUPEIPE", "VAKUU"]);

const PET_CHOICES = [
  { id: "OSTY", monsterId: "OSTY", selectedSkins: null, skinOptions: [] },
  {
    id: "BYRDPIP",
    monsterId: "BYRDPIP",
    selectedSkins: ["version1"],
    skinOptions: [
      { id: "version1", selectedSkins: ["version1"] },
      { id: "version2", selectedSkins: ["version2"] },
      { id: "version3", selectedSkins: ["version3"] },
      { id: "version4", selectedSkins: ["version4"] },
    ],
  },
  { id: "PAELS_LEGION", monsterId: "PAELS_LEGION", selectedSkins: [], skinOptions: [] },
] as const;

type PetMonsterId = (typeof PET_CHOICES)[number]["monsterId"];

const PET_TOKENS: Record<PetMonsterId, string> = {
  OSTY: "/images/sts2/powers/calcify_power.webp",
  BYRDPIP: "/images/sts2/relics/byrdpip.webp",
  PAELS_LEGION: "/images/sts2/relics/paels_legion.webp",
};

const PET_ATTACK_VFX: Partial<Record<PetMonsterId, string>> = {
  OSTY: "VFX_SCRATCH",
  BYRDPIP: "VFX_FLYING_SLASH",
  PAELS_LEGION: "VFX_MECHA_KNIGHT_SHIELD",
};

export default async function ProfileDevRoute({
  searchParams,
}: {
  searchParams: Promise<ProfileSearchParams>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].profile;

  const [characters, characterSpines, ancientSpines, monsters, ancients, vfxAssets] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexCharacterSpineAssets(),
    getCodexAncientSpineAssets(),
    getCodexMonsters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexSpineVfxAssets(),
  ]);

  const characterSpineById = new Map(characterSpines.map((asset) => [asset.id, asset]));
  const ancientSpineById = new Map(ancientSpines.map((asset) => [asset.id, asset]));
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const vfxById = new Map(vfxAssets.filter((asset) => asset.usable !== false).map((asset) => [asset.id, asset]));

  return (
    <ProfilePage
      key={serviceLocale}
      characters={orderCharacters(characters).map((character) => mapCharacter(character, characterSpineById.get(character.id) ?? null))}
      pets={PET_CHOICES.map((choice) => mapPet(choice, monsterById.get(choice.monsterId) ?? null, vfxById, copy))}
      ancients={ancients.map((ancient) => mapAncient(ancient, ancientSpineById.get(ancient.id) ?? null))}
      copy={copy}
      nicknameLocale={serviceLocale}
    />
  );
}

function mapCharacter(character: CodexCharacter, spineAsset: MonsterSpineAsset | null): CharacterChoice {
  const slug = CHARACTER_SLUGS[character.id] ?? character.id.toLowerCase();

  return {
    id: character.id,
    label: character.name,
    iconUrl: `/images/sts2/characters/character_icon_${slug}.webp`,
    fallbackImageUrl: `/images/sts2/characters/combat_${slug}.webp`,
    nicknameOptions: CHARACTER_NICKNAMES[character.id] ?? {
      ko: [character.name],
      en: [character.id],
    },
    spineAsset,
  };
}

function orderCharacters(characters: CodexCharacter[]): CodexCharacter[] {
  const order: ReadonlyMap<string, number> = new Map(CHARACTER_ORDER.map((id, index) => [id, index]));
  return [...characters].sort((a, b) => {
    const orderA = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.name.localeCompare(b.name, "ko");
  });
}

function mapPet(
  choice: (typeof PET_CHOICES)[number],
  monster: CodexMonster | null,
  vfxById: Map<string, MonsterSpineEffectAsset>,
  copy: ProfilePageCopy,
): PetChoice {
  const attackVfxId = PET_ATTACK_VFX[choice.monsterId];
  const attackVfx = attackVfxId ? vfxById.get(attackVfxId) ?? null : null;
  return {
    id: choice.id,
    monsterId: choice.monsterId,
    label: monster?.name ?? choice.monsterId,
    iconUrl: PET_TOKENS[choice.monsterId],
    fallbackImageUrl: monster?.imageUrl ?? PET_TOKENS[choice.monsterId],
    selectedSkin: null,
    selectedSkins: choice.selectedSkins,
    skinOptions: choice.skinOptions.map((option, index) => ({
      ...option,
      label: formatTemplate(copy.petSkin.label, { number: String(index + 1) }),
    })),
    spineAsset: monster?.spineAsset ? withProfileActions(monster.spineAsset, attackVfx) : null,
  };
}

function mapAncient(ancient: CodexAncient, spineAsset: MonsterSpineAsset | null): AncientChoice {
  const key = ancient.id.toLowerCase();
  const iconUrl = ancient.imageUrl ?? "/images/sts2/nav/stats_ancients.png";
  return {
    id: ancient.id,
    label: ancient.name,
    subtitle: ancient.epithet,
    iconUrl,
    backgroundImageUrl: ANCIENT_BACKGROUND_IDS.has(ancient.id)
      ? `/images/sts2/ancients-bg/${key}_bg.webp`
      : null,
    profileImageUrl: ANCIENT_PROFILE_IMAGE_IDS.has(ancient.id)
      ? `/images/sts2/ancients-profile/${key}.webp`
      : null,
    spineAsset,
  };
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function withProfileActions(
  asset: MonsterSpineAsset,
  attackVfx: MonsterSpineEffectAsset | null,
): MonsterSpineAsset {
  const idle = asset.idleAnimation;
  const attackAnimations = asset.animations.filter((animation) => /attack|block|wake|dive|poke/i.test(animation));
  const hurtAnimations = asset.animations.filter((animation) => /hurt|die|dead/i.test(animation));

  return {
    ...asset,
    moveAnimations: {
      ...asset.moveAnimations,
      IDLE: [idle],
      ATTACK: [...attackAnimations, idle, asset.animations[0]].filter(Boolean),
      HURT: [...hurtAnimations, idle, asset.animations[0]].filter(Boolean),
    },
    moveEffects: {
      ...asset.moveEffects,
      ...(attackVfx ? { ATTACK: [attackVfx] } : {}),
    },
  };
}
