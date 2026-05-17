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

const PET_IDS = ["OSTY", "BYRDPIP", "PAELS_LEGION"] as const;

const PET_TOKENS: Record<(typeof PET_IDS)[number], string> = {
  OSTY: "/images/sts2/powers/calcify_power.webp",
  BYRDPIP: "/images/sts2/relics/byrdpip.webp",
  PAELS_LEGION: "/images/sts2/relics/paels_legion.webp",
};

const PET_SKINS: Partial<Record<(typeof PET_IDS)[number], string>> = {
  BYRDPIP: "version4",
};

const PET_ATTACK_VFX: Partial<Record<(typeof PET_IDS)[number], string>> = {
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
      characters={characters.map((character) => mapCharacter(character, characterSpineById.get(character.id) ?? null))}
      pets={PET_IDS.map((id) => mapPet(id, monsterById.get(id) ?? null, vfxById))}
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
    spineAsset,
  };
}

function mapPet(
  id: (typeof PET_IDS)[number],
  monster: CodexMonster | null,
  vfxById: Map<string, MonsterSpineEffectAsset>,
): PetChoice {
  const attackVfxId = PET_ATTACK_VFX[id];
  const attackVfx = attackVfxId ? vfxById.get(attackVfxId) ?? null : null;

  return {
    id,
    label: monster?.name ?? id,
    iconUrl: PET_TOKENS[id],
    fallbackImageUrl: monster?.imageUrl ?? PET_TOKENS[id],
    selectedSkin: PET_SKINS[id] ?? null,
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
