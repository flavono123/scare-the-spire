"use client";

import { ProfileAvatarToken } from "@/components/profile/profile-avatar-token";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";

export function ByrdispatchProfileIcon({ className }: { className: string }) {
  const { stored, profile } = useStoredProfileSnapshot();

  return (
    <ProfileAvatarToken
      profile={profile}
      stored={stored}
      size={20}
      className={className}
    />
  );
}
