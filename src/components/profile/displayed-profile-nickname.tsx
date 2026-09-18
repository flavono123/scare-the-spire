"use client";

import { ProfileNickname } from "@/components/profile/profile-nickname";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import {
  resolveDisplayedNicknameIcon,
  type AuthorProfileTokenInput,
} from "@/lib/profile-nickname-icon";
import type { ProfileAvatarKind } from "@/lib/user-profile";

export function DisplayedProfileNickname({
  nickname,
  isOwner,
  size = 16,
  className,
  tokenClassName,
  nicknameClassName,
  authorToken,
  avatarId,
  avatarKind,
  paletteId,
  paletteSwapped,
  avatar_id,
  avatar_kind,
  palette_id,
  palette_swapped,
}: {
  nickname: string;
  isOwner: boolean;
  size?: number;
  className?: string;
  tokenClassName?: string;
  nicknameClassName?: string;
  authorToken?: AuthorProfileTokenInput | null;
  avatarId?: string | null;
  avatarKind?: ProfileAvatarKind | string | null;
  paletteId?: string | null;
  paletteSwapped?: boolean | null;
  avatar_id?: string | null;
  avatar_kind?: ProfileAvatarKind | string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
}) {
  const { stored, profile } = useStoredProfileSnapshot();

  const effectiveAuthorToken: AuthorProfileTokenInput | undefined = authorToken
    ?? (avatarId !== undefined
      || avatar_id !== undefined
      || paletteId !== undefined
      || palette_id !== undefined
      ? {
          avatarId: avatarId ?? avatar_id,
          avatarKind: avatarKind ?? avatar_kind,
          paletteId: paletteId ?? palette_id,
          paletteSwapped: paletteSwapped ?? palette_swapped,
        }
      : undefined);

  const icon = resolveDisplayedNicknameIcon({
    stored,
    profile,
    isOwner,
    nickname,
    authorToken: effectiveAuthorToken,
  });

  return (
    <ProfileNickname
      nickname={nickname}
      iconUrl={icon.iconUrl}
      duotone={icon.duotone}
      kind={icon.kind}
      size={size}
      className={className}
      tokenClassName={tokenClassName}
      nicknameClassName={nicknameClassName}
    />
  );
}

