"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { PenLine } from "lucide-react";
import {
  PatchNoteRenderer,
} from "@/components/patch-note-renderer";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import type { STS2PatchLine } from "@/lib/types";

type PatchNoteRendererProps = ComponentProps<typeof PatchNoteRenderer>;

function patchLineStoryCopy(serviceLocale: ServiceLocale | undefined) {
  if (serviceLocale === "ko") {
    return {
      write: "이 변경으로 이야기 쓰기",
      countLabel: (count: number) => `이 변경의 이야기 ${count}개`,
    };
  }

  return {
    write: "Write story from this change",
    countLabel: (count: number) => `${count} stories for this change`,
  };
}

function PatchLineStoryAction({
  count,
  serviceLocale,
  onWrite,
}: {
  count: number;
  serviceLocale?: ServiceLocale;
  onWrite: () => void;
}) {
  const copy = patchLineStoryCopy(serviceLocale);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onWrite();
      }}
      data-patch-line-story-action
      className={`inline-flex h-5 items-center gap-1 rounded border px-1.5 align-baseline text-[10px] leading-none tabular-nums transition-colors ${
        count > 0
          ? "border-yellow-400/35 bg-yellow-400/10 text-yellow-200 hover:border-yellow-300/60 hover:bg-yellow-400/15"
          : "border-cyan-300/20 bg-cyan-400/5 text-cyan-100/65 hover:border-cyan-300/45 hover:bg-cyan-400/10 hover:text-cyan-100"
      }`}
      title={copy.write}
      aria-label={`${copy.write}. ${copy.countLabel(count)}`}
    >
      <PenLine size={11} aria-hidden="true" />
      <span>{count}</span>
    </button>
  );
}

function countStoriesByPatchLine(stories: { patchLineId?: string; community?: boolean }[]) {
  const counts = new Map<string, number>();
  for (const story of stories) {
    if (!story.patchLineId) continue;
    counts.set(story.patchLineId, (counts.get(story.patchLineId) ?? 0) + 1);
  }
  return counts;
}

export function PatchNoteWithStoryActions({
  patchId,
  patchLines,
  staticStoryCounts,
  storyPlaceholder,
  ...rendererProps
}: PatchNoteRendererProps & {
  patchId: string;
  patchLines: STS2PatchLine[];
  staticStoryCounts: Record<string, number>;
  storyPlaceholder: string;
}) {
  const { userId, ready: authReady, unavailable: authUnavailable, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId, { source: patchId, limit: 200 });
  const [activePatchLineId, setActivePatchLineId] = useState<string | null>(null);
  const patchLineIds = useMemo(() => new Set(patchLines.map((patchLine) => patchLine.id)), [patchLines]);
  const communityStoryCounts = useMemo(() => {
    const scopedStories = communityStories.stories.filter((story) =>
      story.community && story.patchLineId && patchLineIds.has(story.patchLineId),
    );
    return countStoriesByPatchLine(scopedStories);
  }, [communityStories.stories, patchLineIds]);
  const activePatchLine = useMemo(
    () => patchLines.find((patchLine) => patchLine.id === activePatchLineId) ?? null,
    [activePatchLineId, patchLines],
  );
  const patchLineActions = useMemo(() => {
    const actions = new Map<string, ReactNode>();
    for (const patchLine of patchLines) {
      const count = (staticStoryCounts[patchLine.id] ?? 0) + (communityStoryCounts.get(patchLine.id) ?? 0);
      actions.set(
        patchLine.id,
        <PatchLineStoryAction
          count={count}
          serviceLocale={rendererProps.serviceLocale}
          onWrite={() => setActivePatchLineId(patchLine.id)}
        />,
      );
    }
    return actions;
  }, [communityStoryCounts, patchLines, rendererProps.serviceLocale, staticStoryCounts]);

  return (
    <>
      <PatchNoteRenderer
        {...rendererProps}
        patchLines={patchLines}
        patchLineActions={patchLineActions}
      />
      {activePatchLine && (
        <StoryComposerModal
          serviceLocale={rendererProps.serviceLocale ?? "ko"}
          storyPlaceholder={storyPlaceholder}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          unavailable={authUnavailable || communityStories.unavailable}
          loading={communityStories.loading}
          patchLines={patchLines}
          initialPatchLineId={activePatchLine.id}
          onAdd={communityStories.add}
          onClose={() => setActivePatchLineId(null)}
        />
      )}
    </>
  );
}
