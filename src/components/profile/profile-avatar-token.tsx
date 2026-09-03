"use client";

import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
import { resolveProfileDuotone } from "@/lib/profile-palettes";
import {
  UNSET_PROFILE_TOKEN_URL,
  profileAvatarTokenUrl,
  type UserProfile,
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function ProfileAvatarToken({
  profile,
  stored = true,
  size,
  className,
  alt = "",
}: {
  profile: UserProfile;
  /** When false, show the unset `?` token instead of the in-memory fallback avatar. */
  stored?: boolean;
  size: number;
  className?: string;
  alt?: string;
}) {
  if (!stored) {
    return (
      <Image
        src={UNSET_PROFILE_TOKEN_URL}
        alt={alt}
        width={size}
        height={size}
        data-profile-nick-kind="unset"
        className={cn("object-contain", className)}
      />
    );
  }

  const src = profileAvatarTokenUrl(profile);
  const duotone = resolveProfileDuotone(profile);
  if (duotone) {
    return (
      <DuotoneCharacterToken
        iconUrl={src}
        shadowHex={duotone.shadow}
        highlightHex={duotone.highlight}
        size={size}
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
    />
  );
}
