"use client";

import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
import { resolveProfileDuotone } from "@/lib/profile-palettes";
import { profileAvatarTokenUrl, type UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function ProfileAvatarToken({
  profile,
  size,
  className,
  alt = "",
}: {
  profile: UserProfile;
  size: number;
  className?: string;
  alt?: string;
}) {
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
