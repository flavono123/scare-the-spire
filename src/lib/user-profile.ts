import { isProfilePaletteId } from "@/lib/profile-palettes";

const KNOWN_CHARACTER_IDS = new Set([
  "IRONCLAD",
  "SILENT",
  "REGENT",
  "NECROBINDER",
  "DEFECT",
]);

export type ProfileAvatarKind = "character" | "boss";

export interface UserProfile {
  nickname: string;
  characterId: string;
  avatarKind: ProfileAvatarKind;
  avatarId: string;
  paletteId: string | null;
  paletteSwapped: boolean;
  petId: string;
  petSkinId: string | null;
  ancientId: string;
}

export const USER_PROFILE_STORAGE_KEY = "sts-user-profile";
export const USER_PROFILE_CHANGE_EVENT = "sts-user-profile-change";

export const DEFAULT_USER_PROFILE: UserProfile = {
  nickname: "닉",
  characterId: "NECROBINDER",
  avatarKind: "character",
  avatarId: "NECROBINDER",
  paletteId: null,
  paletteSwapped: false,
  petId: "OSTY",
  petSkinId: null,
  ancientId: "OROBAS",
};

export type CharacterPoolSlug =
  | "ironclad"
  | "silent"
  | "regent"
  | "necrobinder"
  | "defect";

const CHARACTER_ICON_SLUGS: Record<string, CharacterPoolSlug> = {
  IRONCLAD: "ironclad",
  SILENT: "silent",
  REGENT: "regent",
  NECROBINDER: "necrobinder",
  DEFECT: "defect",
};

/** Boss-room encounter ids from extracted `encounters.json`. */
export const PROFILE_BOSS_AVATAR_IDS = [
  "AEONGLASS_BOSS",
  "CEREMONIAL_BEAST_BOSS",
  "DOORMAKER_BOSS",
  "KAISER_CRAB_BOSS",
  "KNOWLEDGE_DEMON_BOSS",
  "LAGAVULIN_MATRIARCH_BOSS",
  "QUEEN_BOSS",
  "SOUL_FYSH_BOSS",
  "TEST_SUBJECT_BOSS",
  "THE_INSATIABLE_BOSS",
  "THE_KIN_BOSS",
  "VANTOM_BOSS",
  "WATERFALL_GIANT_BOSS",
] as const;

const KNOWN_BOSS_AVATAR_IDS = new Set<string>(PROFILE_BOSS_AVATAR_IDS);

export function isKnownCharacterId(id: string | null | undefined): id is string {
  return Boolean(id && KNOWN_CHARACTER_IDS.has(id));
}

export function isBossAvatarId(id: string | null | undefined): id is string {
  return Boolean(id && KNOWN_BOSS_AVATAR_IDS.has(id));
}

export function characterPoolSlug(characterId: string): CharacterPoolSlug {
  return CHARACTER_ICON_SLUGS[characterId] ?? "necrobinder";
}

export function characterIconUrl(characterId: string): string {
  const slug = characterPoolSlug(characterId);
  return `/images/sts2/characters/character_icon_${slug}.webp`;
}

export function bossAvatarTokenUrl(encounterId: string): string {
  return `/images/sts2/bosses/${encounterId.toLowerCase()}.webp`;
}

export function profileAvatarTokenUrl(
  profile: Pick<UserProfile, "avatarKind" | "avatarId" | "characterId">,
): string {
  if (profile.avatarKind === "boss") {
    return bossAvatarTokenUrl(profile.avatarId);
  }
  return characterIconUrl(profile.avatarId || profile.characterId);
}

function knownCharacterId(id: string | null | undefined, fallback: string): string {
  return isKnownCharacterId(id) ? id : fallback;
}

function normalizeAvatar(
  profile: Partial<UserProfile> | null | undefined,
  characterId: string,
): Pick<UserProfile, "avatarKind" | "avatarId"> {
  if (profile?.avatarKind === "boss" && isBossAvatarId(profile.avatarId)) {
    return { avatarKind: "boss", avatarId: profile.avatarId };
  }
  return {
    avatarKind: "character",
    avatarId: knownCharacterId(profile?.avatarId, characterId),
  };
}

export function normalizeUserProfile(profile: Partial<UserProfile> | null | undefined, fallback = DEFAULT_USER_PROFILE): UserProfile {
  const characterId = knownCharacterId(profile?.characterId, fallback.characterId);
  const avatar = normalizeAvatar(profile, characterId);
  const paletteId = isProfilePaletteId(profile?.paletteId) ? profile.paletteId : null;
  return {
    nickname: cleanNickname(profile?.nickname ?? fallback.nickname, fallback.nickname),
    characterId,
    avatarKind: avatar.avatarKind,
    avatarId: avatar.avatarId,
    paletteId,
    paletteSwapped: Boolean(paletteId && profile?.paletteSwapped),
    petId: profile?.petId || fallback.petId,
    petSkinId: profile?.petSkinId ?? fallback.petSkinId,
    ancientId: profile?.ancientId || fallback.ancientId,
  };
}

export function readStoredUserProfile(fallback = DEFAULT_USER_PROFILE): UserProfile {
  if (typeof window === "undefined") return fallback;

  return parseStoredUserProfile(window.localStorage.getItem(USER_PROFILE_STORAGE_KEY), fallback);
}

export function parseStoredUserProfile(raw: string | null, fallback = DEFAULT_USER_PROFILE): UserProfile {
  if (!raw) return fallback;

  try {
    return normalizeUserProfile(JSON.parse(raw) as Partial<UserProfile>, fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredUserProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;

  const normalized = normalizeUserProfile(profile);
  window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<UserProfile>(USER_PROFILE_CHANGE_EVENT, { detail: normalized }));
}

function cleanNickname(nickname: string, fallback = DEFAULT_USER_PROFILE.nickname): string {
  const trimmed = nickname.trim();
  return trimmed.slice(0, 20) || fallback;
}
