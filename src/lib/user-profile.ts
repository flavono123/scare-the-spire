export interface UserProfile {
  nickname: string;
  characterId: string;
  petId: string;
  petSkinId: string | null;
  ancientId: string;
}

export const USER_PROFILE_STORAGE_KEY = "sts-user-profile";
export const USER_PROFILE_CHANGE_EVENT = "sts-user-profile-change";

export const DEFAULT_USER_PROFILE: UserProfile = {
  nickname: "닉",
  characterId: "NECROBINDER",
  petId: "OSTY",
  petSkinId: null,
  ancientId: "OROBAS",
};

const CHARACTER_ICON_SLUGS: Record<string, string> = {
  IRONCLAD: "ironclad",
  SILENT: "silent",
  REGENT: "regent",
  NECROBINDER: "necrobinder",
  DEFECT: "defect",
};

export function characterIconUrl(characterId: string): string {
  const slug = CHARACTER_ICON_SLUGS[characterId] ?? CHARACTER_ICON_SLUGS.NECROBINDER;
  return `/images/sts2/characters/character_icon_${slug}.webp`;
}

export function normalizeUserProfile(profile: Partial<UserProfile> | null | undefined, fallback = DEFAULT_USER_PROFILE): UserProfile {
  return {
    nickname: cleanNickname(profile?.nickname ?? fallback.nickname, fallback.nickname),
    characterId: profile?.characterId || fallback.characterId,
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
