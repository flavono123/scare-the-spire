"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { ProfileAvatarToken } from "@/components/profile/profile-avatar-token";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_CHANGE_EVENT,
  USER_PROFILE_DEV_BACKUP_KEY,
  USER_PROFILE_STORAGE_KEY,
  backupAndClearStoredUserProfile,
  hasStoredUserProfileBackup,
  restoreStoredUserProfileBackup,
  writeStoredUserProfile,
} from "@/lib/user-profile";

const DEV_SAMPLE_PROFILE = {
  ...DEFAULT_USER_PROFILE,
  nickname: "네바",
  characterId: "NECROBINDER",
  avatarKind: "character" as const,
  avatarId: "NECROBINDER",
  paletteId: "carmine-ink",
  paletteSwapped: false,
};

function subscribeProfileBackup(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === null
      || event.key === USER_PROFILE_STORAGE_KEY
      || event.key === USER_PROFILE_DEV_BACKUP_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(USER_PROFILE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(USER_PROFILE_CHANGE_EVENT, onStoreChange);
  };
}

function getProfileBackupSnapshot() {
  return hasStoredUserProfileBackup() ? "1" : "";
}

function getProfileBackupServerSnapshot() {
  return "";
}

export default function DevProfileSwitchPageClient() {
  const { stored, profile } = useStoredProfileSnapshot();
  const hasBackup = useSyncExternalStore(
    subscribeProfileBackup,
    getProfileBackupSnapshot,
    getProfileBackupServerSnapshot,
  ) === "1";

  return (
    <main
      data-dev-profile-switch
      data-profile-stored={stored ? "true" : "false"}
      className="mx-auto max-w-xl space-y-6 px-4 py-8"
    >
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
          DEV only
        </p>
        <h1 className="font-service text-2xl font-bold text-primary">프로필 저장 전환</h1>
        <p className="text-sm text-muted-foreground">
          로컬 `sts-user-profile` 키를 지워 익명 닉으로 돌아가거나, 직전에 백업한 프로필을
          되돌립니다. 프로덕션 `/profile` 에는 없습니다.
        </p>
      </header>

      <section
        data-dev-profile-preview
        className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-4 py-3"
      >
        <p className="text-xs text-amber-200">현재 뷰어 상태</p>
        <div className="mt-2 flex items-center gap-3">
          <ProfileAvatarToken profile={profile} stored={stored} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {stored ? "저장한 프로필" : "익명 (키 없음)"}
            </p>
            <DisplayedProfileNickname
              nickname={stored ? profile.nickname : "닉"}
              isOwner
              size={16}
              tokenClassName="h-4 w-4"
              nicknameClassName="text-sm text-muted-foreground"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          data-dev-profile-clear
          className="rounded-md border border-border bg-card/40 px-3 py-2 text-sm text-foreground hover:border-primary/40"
          onClick={() => backupAndClearStoredUserProfile()}
        >
          익명으로 전환
        </button>
        <button
          type="button"
          data-dev-profile-restore
          className="rounded-md border border-border bg-card/40 px-3 py-2 text-sm text-foreground hover:border-primary/40 disabled:opacity-40"
          disabled={!hasBackup}
          onClick={() => restoreStoredUserProfileBackup()}
        >
          저장한 프로필 복원
        </button>
        <button
          type="button"
          data-dev-profile-sample
          className="rounded-md border border-dashed border-amber-300/50 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 hover:border-amber-200"
          onClick={() => writeStoredUserProfile(DEV_SAMPLE_PROFILE)}
        >
          DEV 샘플 프로필 쓰기
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        복원할 백업이 없으면 DEV 샘플(네바 / 네크로바인더 / 카민-잉크)을 씁니다.
        실제 프로필은{" "}
        <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
          /profile
        </Link>
        에서 고르고, 배색 실험은{" "}
        <Link href="/dev/character-palette" className="text-primary underline-offset-4 hover:underline">
          /dev/character-palette
        </Link>
        입니다.
      </p>
    </main>
  );
}
