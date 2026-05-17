import { notFound } from "next/navigation";
import {
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
import ProfilePage, {
  type AncientChoice,
  type CharacterChoice,
  type PetChoice,
  type ProfileNicknameLocale,
} from "./profile-page";

export const metadata = {
  title: "프로필 — DEV",
  description: "개발 전용 프로필 선택 화면",
  robots: {
    index: false,
    follow: false,
  },
};

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

const PET_CHOICES = [
  { id: "OSTY", monsterId: "OSTY", selectedSkins: null, skinOptions: [] },
  {
    id: "BYRDPIP",
    monsterId: "BYRDPIP",
    selectedSkins: ["version1"],
    skinOptions: [
      { id: "version1", label: "형태 1", selectedSkins: ["version1"] },
      { id: "version2", label: "형태 2", selectedSkins: ["version2"] },
      { id: "version3", label: "형태 3", selectedSkins: ["version3"] },
      { id: "version4", label: "형태 4", selectedSkins: ["version4"] },
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

export default async function ProfileDevRoute() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [characters, characterSpines, monsters, ancients, vfxAssets] = await Promise.all([
    getCodexCharacters({ gameLocale: "kor" }),
    getCodexCharacterSpineAssets(),
    getCodexMonsters({ gameLocale: "kor" }),
    getCodexAncients({ gameLocale: "kor" }),
    getCodexSpineVfxAssets(),
  ]);

  const characterSpineById = new Map(characterSpines.map((asset) => [asset.id, asset]));
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const vfxById = new Map(vfxAssets.filter((asset) => asset.usable !== false).map((asset) => [asset.id, asset]));

  return (
    <ProfilePage
      characters={orderCharacters(characters).map((character) => mapCharacter(character, characterSpineById.get(character.id) ?? null))}
      pets={PET_CHOICES.map((choice) => mapPet(choice, monsterById.get(choice.monsterId) ?? null, vfxById))}
      ancients={ancients.map(mapAncient)}
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
      en: [character.nameEn],
    },
    spineAsset,
  };
}

function orderCharacters(characters: CodexCharacter[]): CodexCharacter[] {
  const order = new Map(CHARACTER_ORDER.map((id, index) => [id, index]));
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
    skinOptions: choice.skinOptions,
    spineAsset: monster?.spineAsset ? withProfileActions(monster.spineAsset, attackVfx) : null,
  };
}

function mapAncient(ancient: CodexAncient): AncientChoice {
  return {
    id: ancient.id,
    label: ancient.name,
    subtitle: ancient.epithet,
    iconUrl: ancient.imageUrl ?? "/images/sts2/nav/stats_ancients.png",
  };
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
