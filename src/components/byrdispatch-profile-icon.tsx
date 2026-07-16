"use client";

import { useStoredUserProfile } from "@/hooks/use-user-profile";
import { characterIconUrl } from "@/lib/user-profile";
import Image from "@/components/ui/static-image";

export function ByrdispatchProfileIcon({ className }: { className: string }) {
  const profile = useStoredUserProfile();

  return (
    <Image
      src={characterIconUrl(profile.characterId)}
      alt=""
      width={20}
      height={20}
      className={className}
    />
  );
}
