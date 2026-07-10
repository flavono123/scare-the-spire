"use client";

import { useCallback, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { StoryWriteIcon } from "@/components/story-token-icon";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import type { STS2PatchLine } from "@/lib/types";

let fullPatchLinesPromise: Promise<STS2PatchLine[]> | null = null;

function loadFullSts2PatchLines(): Promise<STS2PatchLine[]> {
  fullPatchLinesPromise ??= fetch("/generated/sts2-patch-lines.json", { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load STS2 patch lines: ${response.status}`);
      }
      return response.json() as Promise<STS2PatchLine[]>;
    });
  return fullPatchLinesPromise;
}

function newStoryLabel(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko" ? "이야기 쓰기" : "Write story";
}

export function ByrdispatchStoryComposerButton({
  serviceLocale,
  storyPlaceholder,
  entities,
}: {
  serviceLocale: ServiceLocale;
  storyPlaceholder: string;
  entities: EntityInfo[];
}) {
  const { userId, ready: authReady, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId);
  const [composerOpen, setComposerOpen] = useState(false);
  const [patchLines, setPatchLines] = useState<STS2PatchLine[]>([]);
  const [loading, setLoading] = useState(false);
  const label = newStoryLabel(serviceLocale);

  const openComposer = useCallback(() => {
    setComposerOpen(true);
    if (patchLines.length > 0 || loading) return;
    setLoading(true);
    loadFullSts2PatchLines()
      .then(setPatchLines)
      .catch(() => setPatchLines([]))
      .finally(() => setLoading(false));
  }, [loading, patchLines.length]);

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className="mx-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#fb923c]/50 bg-[#fb923c]/15 px-3 text-xs font-semibold text-[#fed7aa] shadow-[0_0_18px_rgba(251,146,60,0.14)] transition-colors hover:border-[#fb923c]/75 hover:bg-[#fb923c]/25 hover:text-white"
      >
        <StoryWriteIcon size={16} />
        <span>{label}</span>
      </button>
      {composerOpen && (
        <StoryComposerModal
          serviceLocale={serviceLocale}
          storyPlaceholder={storyPlaceholder}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          patchLines={patchLines}
          entities={entities}
          onAdd={communityStories.add}
          onClose={() => setComposerOpen(false)}
        />
      )}
    </>
  );
}
