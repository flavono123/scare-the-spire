import { resolveProfileDuotone } from "@/lib/profile-palettes";
import {
  UNSET_PROFILE_TOKEN_URL,
  bossAvatarTokenUrl,
  characterIconUrl,
  isBossAvatarId,
  profileAvatarTokenUrl,
  type ProfileAvatarKind,
  type UserProfile,
} from "@/lib/user-profile";

export type DisplayedNicknameIconKind = "profile" | "unset";

export type DisplayedNicknameIcon = {
  kind: DisplayedNicknameIconKind;
  iconUrl: string;
  duotone: { shadow: string; highlight: string } | null;
};

export interface AuthorProfileTokenInput {
  avatarId?: string | null;
  avatarKind?: ProfileAvatarKind | string | null;
  paletteId?: string | null;
  paletteSwapped?: boolean | null;
  // DB snake_case compatibility
  avatar_id?: string | null;
  avatar_kind?: ProfileAvatarKind | string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
}

export function profileNicknamesMatch(displayed: string, stored: string): boolean {
  return displayed.trim() === stored.trim();
}

/**
 * Resolves the profile nickname token icon:
 * 1. If authorToken is provided (persisted on post/comment), renders the author's exact token/palette.
 * 2. If authorToken.avatar_id is explicitly null, renders the unset token '?'.
 * 3. Fallback (legacy posts/comments): viewer's stored token if owner and nickname match, else '?'.
 */
export function resolveDisplayedNicknameIcon({
  stored,
  profile,
  isOwner,
  nickname,
  authorToken,
}: {
  stored: boolean;
  profile: UserProfile;
  isOwner: boolean;
  nickname: string;
  authorToken?: AuthorProfileTokenInput | null;
}): DisplayedNicknameIcon {
  if (authorToken) {
    const avatarId = authorToken.avatarId ?? authorToken.avatar_id;
    const avatarKind = authorToken.avatarKind ?? authorToken.avatar_kind;
    const paletteId = authorToken.paletteId ?? authorToken.palette_id;
    const paletteSwapped = Boolean(authorToken.paletteSwapped ?? authorToken.palette_swapped);

    if (avatarId && typeof avatarId === "string" && avatarId.trim()) {
      const trimmed = avatarId.trim();
      const isBoss = avatarKind === "boss" || isBossAvatarId(trimmed);
      const iconUrl = isBoss
        ? bossAvatarTokenUrl(trimmed)
        : characterIconUrl(trimmed);
      const duotone = resolveProfileDuotone({
        paletteId: paletteId ?? null,
        paletteSwapped,
      });

      return {
        kind: "profile",
        iconUrl,
        duotone,
      };
    }

    if (avatarId === null) {
      return {
        kind: "unset",
        iconUrl: UNSET_PROFILE_TOKEN_URL,
        duotone: null,
      };
    }
  }

  if (stored && isOwner && profileNicknamesMatch(nickname, profile.nickname)) {
    return {
      kind: "profile",
      iconUrl: profileAvatarTokenUrl(profile),
      duotone: resolveProfileDuotone(profile),
    };
  }

  return {
    kind: "unset",
    iconUrl: UNSET_PROFILE_TOKEN_URL,
    duotone: null,
  };
}

