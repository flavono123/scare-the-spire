"use client";

import { ProfileAvatarToken } from "@/components/profile/profile-avatar-token";
import { useStoredUserProfile } from "@/hooks/use-user-profile";

export function ByrdispatchProfileIcon({ className }: { className: string }) {
  const profile = useStoredUserProfile();

  return (
    <ProfileAvatarToken
      profile={profile}
      size={20}
      className={className}
    />
  );
}
