"use client";

import { ProfileNickname } from "@/components/profile/profile-nickname";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { resolveDisplayedNicknameIcon } from "@/lib/profile-nickname-icon";

export function DisplayedProfileNickname({
  nickname,
  isOwner,
  size = 16,
  className,
  tokenClassName,
  nicknameClassName,
}: {
  nickname: string;
  isOwner: boolean;
  size?: number;
  className?: string;
  tokenClassName?: string;
  nicknameClassName?: string;
}) {
  const { stored, profile } = useStoredProfileSnapshot();
  const icon = resolveDisplayedNicknameIcon({
    stored,
    profile,
    isOwner,
    nickname,
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
