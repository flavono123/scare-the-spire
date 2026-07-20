"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  PatchNoteRenderer,
} from "@/components/patch-note-renderer";
import { PatchLineReferenceBlock } from "@/components/patch-line-reference";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { StoryStatIcon, StoryWriteIcon } from "@/components/story-token-icon";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import type { ServiceLocale } from "@/lib/i18n";
import { patchLineDisplayText } from "@/lib/patch-line-display";
import type { STS2Patch, STS2PatchLine, Story } from "@/lib/types";
import { serviceMessages } from "@/messages/service";

type PatchNoteRendererProps = ComponentProps<typeof PatchNoteRenderer>;

export function patchLineStoryCopy(serviceLocale: ServiceLocale | undefined) {
  if (serviceLocale === "ko") {
    return {
      title: "이 변경의 이야기",
      open: "이 변경의 이야기 보기",
      openEmpty: "이 변경으로 이야기 쓰기",
      write: "이 변경으로 이야기 쓰기",
      close: "닫기",
      empty: "아직 이 변경으로 쓴 이야기가 없습니다",
      staticStory: "슬서운 이야기",
      communityStory: "작성됨",
      countLabel: (count: number) => `이 변경의 이야기 ${count}개`,
    };
  }

  return {
    title: "Stories for this change",
    open: "View stories for this change",
    openEmpty: "Write story from this change",
    write: "Write story from this change",
    close: "Close",
    empty: "No stories have been written from this change yet",
    staticStory: "Slseoun story",
    communityStory: "Posted",
    countLabel: (count: number) => `${count} stories for this change`,
  };
}

function PatchLineStoryAction({
  count,
  staticCount,
  patchLine,
  serviceLocale,
  storiesUnavailable,
  onOpen,
  onWrite,
}: {
  count: number;
  staticCount: number;
  patchLine: STS2PatchLine;
  serviceLocale?: ServiceLocale;
  storiesUnavailable: boolean;
  onOpen: () => void;
  onWrite: () => void;
}) {
  const copy = patchLineStoryCopy(serviceLocale);
  const actionLabel = count > 0 || storiesUnavailable ? copy.open : copy.openEmpty;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (count > 0 || storiesUnavailable) onOpen();
        else onWrite();
      }}
      data-patch-line-story-action
      data-patch-line-id={patchLine.id}
      data-patch-id={patchLine.patch}
      data-patch-line-label={patchLineDisplayText(patchLine, serviceLocale ?? "ko")}
      data-patch-line-refs={JSON.stringify(patchLine.entityRefs)}
      data-static-story-count={staticCount}
      data-story-count-positive={count > 0}
      className="group inline-flex h-5 items-center gap-1 rounded border border-[#fb923c]/14 bg-[#fb923c]/[0.035] px-1 align-baseline text-[10px] leading-none text-[#fed7aa]/55 opacity-80 tabular-nums transition-colors hover:border-[#fb923c]/28 hover:bg-[#fb923c]/[0.075] hover:text-[#fed7aa]/90 hover:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#fb923c]/50 data-[story-count-positive=true]:border-[#fb923c]/16 data-[story-count-positive=true]:bg-[#fb923c]/[0.045] data-[story-count-positive=true]:text-[#fed7aa]/65 data-[story-count-positive=true]:opacity-85 data-[story-count-positive=true]:hover:border-[#fb923c]/32 data-[story-count-positive=true]:hover:bg-[#fb923c]/[0.08] data-[story-count-positive=true]:hover:text-[#fed7aa] data-[story-count-positive=true]:hover:opacity-100"
      title={actionLabel}
      aria-label={`${actionLabel}. ${copy.countLabel(count)}`}
    >
      <StoryStatIcon size={14} className="opacity-60 group-data-[story-count-positive=true]:opacity-75" />
      <span data-patch-line-story-count>{count}</span>
    </button>
  );
}

function countStoriesByPatchLine(stories: { patchLineId?: string }[]) {
  const counts = new Map<string, number>();
  for (const story of stories) {
    if (!story.patchLineId) continue;
    counts.set(story.patchLineId, (counts.get(story.patchLineId) ?? 0) + 1);
  }
  return counts;
}

function storyPublishedTime(story: Story) {
  if (!story.publishedAt) return 0;
  const time = Date.parse(story.publishedAt);
  return Number.isFinite(time) ? time : 0;
}

function sortPatchLineStories(stories: Story[]) {
  return [...stories].sort((a, b) => {
    const timeDiff = storyPublishedTime(b) - storyPublishedTime(a);
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}

function PatchLineStoriesPanel({
  patchLine,
  stories,
  serviceLocale,
  patches,
  entities,
  communityUnavailable,
  onClose,
  onWrite,
}: {
  patchLine: STS2PatchLine;
  stories: Story[];
  serviceLocale: ServiceLocale;
  patches?: STS2Patch[];
  entities?: PatchNoteRendererProps["entities"];
  communityUnavailable: boolean;
  onClose: () => void;
  onWrite: () => void;
}) {
  const copy = patchLineStoryCopy(serviceLocale);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-3 py-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{copy.title}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-yellow-500">{patchLine.patch}</span>
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              {copy.countLabel(stories.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            title={copy.close}
          >
            <X size={16} />
            <span className="sr-only">{copy.close}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <PatchLineReferenceBlock
            patchLine={patchLine}
            serviceLocale={serviceLocale}
            patches={patches}
            entities={entities}
            compact
          />

          {communityUnavailable ? (
            <StorageUnavailableNotice
              compact
              className="mt-3"
              title={serviceMessages[serviceLocale].comments.unavailableTitle}
            />
          ) : (
            <div className="mt-3 space-y-2">
              {stories.length > 0 ? stories.map((story) => (
                <article
                  key={story.id}
                  className="rounded-md border border-border/60 bg-card/25 px-3 py-2.5"
                >
                  <p className="text-sm leading-relaxed text-foreground">{story.sentence}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{story.community ? copy.communityStory : copy.staticStory}</span>
                    {story.authorName && <span>{story.authorName}</span>}
                    {story.publishedAt && <span>{story.publishedAt}</span>}
                  </p>
                </article>
              )) : (
                <p className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
                  {copy.empty}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border/60 px-4 py-3">
          <button
            type="button"
            onClick={onWrite}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#fb923c]/45 bg-[#fb923c]/12 px-3 text-xs font-medium text-[#fb923c] transition-colors hover:border-[#fb923c]/70 hover:bg-[#fb923c]/20 hover:text-[#fed7aa]"
          >
            <StoryWriteIcon size={16} />
            {copy.write}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PatchNoteWithStoryActions({
  patchId,
  patchLines,
  staticStories,
  storyPlaceholder,
  ...rendererProps
}: PatchNoteRendererProps & {
  patchId: string;
  patchLines: STS2PatchLine[];
  staticStories: Story[];
  storyPlaceholder: string;
}) {
  const { userId, ready: authReady, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId, { source: patchId, limit: 200 });
  const [activePatchLineId, setActivePatchLineId] = useState<string | null>(null);
  const [composerPatchLineId, setComposerPatchLineId] = useState<string | null>(null);
  const patchLineIds = useMemo(() => new Set(patchLines.map((patchLine) => patchLine.id)), [patchLines]);
  const staticStoryCounts = useMemo(() => countStoriesByPatchLine(staticStories), [staticStories]);
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
  const composerPatchLine = useMemo(
    () => patchLines.find((patchLine) => patchLine.id === composerPatchLineId) ?? null,
    [composerPatchLineId, patchLines],
  );
  const activePatchLineStories = useMemo(() => {
    if (!activePatchLine) return [];
    const communityPatchLineStories = communityStories.stories.filter((story) =>
      story.community && story.patchLineId === activePatchLine.id,
    );
    const staticPatchLineStories = staticStories.filter((story) => story.patchLineId === activePatchLine.id);
    return sortPatchLineStories([...communityPatchLineStories, ...staticPatchLineStories]);
  }, [activePatchLine, communityStories.stories, staticStories]);
  const patchLineActions = useMemo(() => {
    const actions = new Map<string, ReactNode>();
    for (const patchLine of patchLines) {
      const staticCount = staticStoryCounts.get(patchLine.id) ?? 0;
      const count = staticCount + (communityStoryCounts.get(patchLine.id) ?? 0);
      actions.set(
        patchLine.id,
        <PatchLineStoryAction
          count={count}
          staticCount={staticCount}
          patchLine={patchLine}
          serviceLocale={rendererProps.serviceLocale}
          storiesUnavailable={communityStories.unavailable}
          onOpen={() => setActivePatchLineId(patchLine.id)}
          onWrite={() => setComposerPatchLineId(patchLine.id)}
        />,
      );
    }
    return actions;
  }, [communityStories.unavailable, communityStoryCounts, patchLines, rendererProps.serviceLocale, staticStoryCounts]);

  return (
    <>
      <PatchNoteRenderer
        {...rendererProps}
        patchLines={patchLines}
        patchLineActions={patchLineActions}
      />
      {activePatchLine && (
        <PatchLineStoriesPanel
          patchLine={activePatchLine}
          stories={activePatchLineStories}
          serviceLocale={rendererProps.serviceLocale ?? "ko"}
          patches={rendererProps.patches}
          entities={rendererProps.entities ?? rendererProps.cards}
          communityUnavailable={communityStories.unavailable}
          onClose={() => setActivePatchLineId(null)}
          onWrite={() => {
            setComposerPatchLineId(activePatchLine.id);
            setActivePatchLineId(null);
          }}
        />
      )}
      {composerPatchLine && (
        <StoryComposerModal
          serviceLocale={rendererProps.serviceLocale ?? "ko"}
          storyPlaceholder={storyPlaceholder}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          patchLines={patchLines}
          patches={rendererProps.patches}
          entities={rendererProps.entities ?? rendererProps.cards}
          initialPatchLineId={composerPatchLine.id}
          onAdd={communityStories.add}
          onClose={() => setComposerPatchLineId(null)}
        />
      )}
    </>
  );
}
