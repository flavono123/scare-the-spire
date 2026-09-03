import { resolveProfileDuotone } from "@/lib/profile-palettes";
import {
  UNSET_PROFILE_TOKEN_URL,
  profileAvatarTokenUrl,
  type UserProfile,
} from "@/lib/user-profile";

export type DisplayedNicknameIconKind = "profile" | "unset";

export type DisplayedNicknameIcon = {
  kind: DisplayedNicknameIconKind;
  iconUrl: string;
  duotone: { shadow: string; highlight: string } | null;
};

export function profileNicknamesMatch(displayed: string, stored: string): boolean {
  return displayed.trim() === stored.trim();
}

/** Profile token only for the viewer's stored nick on their own post/comment. */
export function resolveDisplayedNicknameIcon({
  stored,
  profile,
  isOwner,
  nickname,
}: {
  stored: boolean;
  profile: UserProfile;
  isOwner: boolean;
  nickname: string;
}): DisplayedNicknameIcon {
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
