import { notFound } from "next/navigation";
import {
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexMonsters,
  getCodexPotions,
  getCodexRelics,
} from "@/lib/codex-data";
import type {
  CodexCard,
  CodexCharacter,
  CodexMonster,
  CodexPotion,
  CodexRelic,
  MonsterSpineAsset,
} from "@/lib/codex-types";
import ProfileDevPage, {
  type AncientProfileOption,
  type CharacterProfileOption,
  type MiniEntityProfileOption,
  type PetProfileOption,
  type ProfileAssetAuditItem,
} from "./profile-dev-page";

export const metadata = {
  title: "프로필 Mock — DEV",
  description: "개발 전용 RLS 식별 프로필 mock",
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

const CHARACTER_LABELS: Record<string, string> = {
  IRONCLAD: "red",
  SILENT: "green",
  DEFECT: "aqua",
  NECROBINDER: "pink",
  REGENT: "orange",
};

const ANCIENT_BACKGROUND_NOTES: Record<string, { status: AncientProfileOption["backgroundStatus"]; note: string }> = {
  NEOW: { status: "missing", note: "배경 추출 필요" },
  TEZCATARA: { status: "incomplete", note: "현재 배경에 고대신 본체 없음" },
  VAKUU: { status: "beta", note: "베타아트로 보임" },
  NONUPEIPE: { status: "beta", note: "베타아트로 보임" },
};

const DEFAULT_IDS = {
  character: "NECROBINDER",
  ancient: "OROBAS",
  pet: "OSTY",
  card: "SIC_EM",
  relic: "BONE_FLUTE",
  potion: "STRENGTH_POTION",
};

export default async function DevProfilePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [characters, ancients, monsters, cards, relics, potions] = await Promise.all([
    getCodexCharacters({ gameLocale: "kor" }),
    getCodexAncients({ gameLocale: "kor" }),
    getCodexMonsters({ gameLocale: "kor" }),
    getCodexCards({ gameLocale: "kor" }),
    getCodexRelics({ gameLocale: "kor" }),
    getCodexPotions({ gameLocale: "kor" }),
  ]);

  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));

  return (
    <ProfileDevPage
      characters={characters.map(mapCharacter)}
      ancients={ancients.map(mapAncient)}
      pets={buildPetOptions(monsterById)}
      cards={cards.filter(hasImage).map(mapCard)}
      relics={relics.map(mapRelic).filter(hasEntityImage)}
      potions={potions.map(mapPotion).filter(hasEntityImage)}
      assetAudit={buildAssetAudit(characters, ancients, monsterById)}
      defaults={DEFAULT_IDS}
    />
  );
}

function mapCharacter(character: CodexCharacter): CharacterProfileOption {
  const slug = CHARACTER_SLUGS[character.id] ?? character.id.toLowerCase();

  return {
    id: character.id,
    name: character.name,
    colorLabel: CHARACTER_LABELS[character.id] ?? "neutral",
    iconUrl: `/images/sts2/characters/character_icon_${slug}.webp`,
    outlineUrl: `/images/sts2/characters/character_icon_${slug}_outline.webp`,
    portraitUrl: `/images/sts2/characters/combat_${slug}.webp`,
    selectUrl: `/images/sts2/characters/select_${slug}.webp`,
    spineStatus: "pending",
  };
}

function mapAncient(ancient: Awaited<ReturnType<typeof getCodexAncients>>[number]): AncientProfileOption {
  const slug = ancient.id.toLowerCase();
  const note = ANCIENT_BACKGROUND_NOTES[ancient.id];

  return {
    id: ancient.id,
    name: ancient.name,
    nameEn: ancient.nameEn,
    epithet: ancient.epithet,
    imageUrl: ancient.imageUrl,
    backgroundUrl: note?.status === "missing" ? null : `/images/sts2/ancients-bg/${slug}_bg.webp`,
    backgroundStatus: note?.status ?? "ready",
    note: note?.note ?? "배경 사용 가능",
  };
}

function buildPetOptions(monsterById: Map<string, CodexMonster>): PetProfileOption[] {
  const byrdpip = monsterById.get("BYRDPIP");
  const byrdpipOptions = ["version1", "version2", "version3", "version4"].map((skin, index) =>
    mapPetMonster({
      monster: byrdpip,
      id: `BYRDPIP_${skin.toUpperCase()}`,
      label: `짹짹이 ${index + 1}`,
      tokenUrl: "/images/sts2/relics/byrdpip.webp",
      skin,
      source: "relic-token",
      note: "BYRDPIP Spine skin",
    }),
  );

  return [
    mapPetMonster({
      monster: monsterById.get("OSTY"),
      id: "OSTY",
      label: "골골이",
      tokenUrl: "/images/sts2/powers/calcify_power.webp",
      source: "power-token",
      note: "석회화 파워 토큰 임시 사용",
    }),
    ...byrdpipOptions,
    mapPetMonster({
      monster: monsterById.get("PAELS_LEGION"),
      id: "PAELS_LEGION",
      label: "파엘의 군체",
      tokenUrl: "/images/sts2/relics/paels_legion.webp",
      source: "relic-token",
      note: "유물 토큰 사용",
    }),
    mapPetTokenOnly({
      id: "MR_STRUGGLES",
      label: "버둥 씨",
      tokenUrl: "/images/sts2/relics/mr_struggles.webp",
      note: "유물 토큰만 확인됨",
    }),
    mapPetTokenOnly({
      id: "LOST_WISP",
      label: "잃어버린 위습",
      tokenUrl: "/images/sts2/relics/lost_wisp.webp",
      note: "유물 토큰만 확인됨",
    }),
  ];
}

function mapPetMonster({
  monster,
  id,
  label,
  tokenUrl,
  skin,
  source,
  note,
}: {
  monster: CodexMonster | undefined;
  id: string;
  label: string;
  tokenUrl: string;
  skin?: string;
  source: PetProfileOption["source"];
  note: string;
}): PetProfileOption {
  return {
    id,
    monsterId: monster?.id ?? id,
    label,
    nameEn: monster?.nameEn ?? id,
    tokenUrl,
    imageUrl: monster?.imageUrl ?? tokenUrl,
    spineAsset: cloneSpineAssetWithSkin(monster?.spineAsset ?? null, skin),
    skin: skin ?? null,
    source,
    note,
  };
}

function mapPetTokenOnly({
  id,
  label,
  tokenUrl,
  note,
}: {
  id: string;
  label: string;
  tokenUrl: string;
  note: string;
}): PetProfileOption {
  return {
    id,
    monsterId: null,
    label,
    nameEn: id,
    tokenUrl,
    imageUrl: tokenUrl,
    spineAsset: null,
    skin: null,
    source: "relic-token",
    note,
  };
}

function cloneSpineAssetWithSkin(asset: MonsterSpineAsset | null, skin?: string): MonsterSpineAsset | null {
  if (!asset) return null;
  return {
    ...asset,
    skin: skin ?? asset.skin,
  };
}

function mapCard(card: CodexCard): MiniEntityProfileOption {
  return {
    id: card.id,
    name: card.name,
    nameEn: card.nameEn,
    imageUrl: card.imageUrl ?? card.betaImageUrl,
    meta: `${card.color} / ${card.rarityLabel}`,
  };
}

function mapRelic(relic: CodexRelic): MiniEntityProfileOption {
  return {
    id: relic.id,
    name: relic.name,
    nameEn: relic.nameEn,
    imageUrl: relic.imageUrl ?? firstVariantImage(relic.variantImageUrls),
    meta: `${relic.pool} / ${relic.rarity}`,
  };
}

function mapPotion(potion: CodexPotion): MiniEntityProfileOption {
  return {
    id: potion.id,
    name: potion.name,
    nameEn: potion.nameEn,
    imageUrl: potion.imageUrl,
    meta: `${potion.pool} / ${potion.rarity}`,
  };
}

function hasImage(card: CodexCard): boolean {
  return Boolean(card.imageUrl ?? card.betaImageUrl);
}

function hasEntityImage(entity: MiniEntityProfileOption): entity is MiniEntityProfileOption & { imageUrl: string } {
  return Boolean(entity.imageUrl);
}

function firstVariantImage(variants: CodexRelic["variantImageUrls"]): string | null {
  return Object.values(variants ?? {})[0] ?? null;
}

function buildAssetAudit(
  characters: CodexCharacter[],
  ancients: Awaited<ReturnType<typeof getCodexAncients>>,
  monsterById: Map<string, CodexMonster>,
): ProfileAssetAuditItem[] {
  const ancientBackgrounds = ancients.map((ancient) => ANCIENT_BACKGROUND_NOTES[ancient.id]?.status ?? "ready");
  const readyAncientBackgrounds = ancientBackgrounds.filter((status) => status === "ready").length;
  const petSpineReady = ["OSTY", "BYRDPIP", "PAELS_LEGION"].filter((id) => monsterById.get(id)?.spineAsset).length;

  return [
    {
      label: "캐릭터 Spine + VFX",
      value: `${characters.length}명 미추출`,
      tone: "warn",
      detail: "현재 mock은 character_icon 및 combat 정적 이미지를 사용합니다.",
    },
    {
      label: "고대의 존재 배경",
      value: `${readyAncientBackgrounds}/${ancients.length} ready`,
      tone: readyAncientBackgrounds === ancients.length ? "ok" : "warn",
      detail: "니오우 없음, 테즈카타라/바쿠/노누파이페 보강 대상.",
    },
    {
      label: "펫 Spine 후보",
      value: `${petSpineReady}/3 ready`,
      tone: petSpineReady === 3 ? "ok" : "warn",
      detail: "짹짹이는 4개 skin을 각각 선택 후보로 펼쳤습니다.",
    },
  ];
}
