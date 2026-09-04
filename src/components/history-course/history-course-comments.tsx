"use client";

import { useCallback, useMemo, useState } from "react";
import { CommentSection } from "@/components/comment-section";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";
import { buildHistoryCourseCommentThreadKey } from "@/lib/comment-threads";
import type { Comment } from "@/hooks/use-comments";
import {
  commentMentionsHistoryFloor,
  historyFloorCatalogFromActs,
  historyFloorFromActStep,
} from "@/lib/history-run-floor";
import type { ReplayActAnalysis } from "@/lib/sts2-run-replay";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

export function HistoryCourseComments({
  runId,
  acts,
  act,
  actIndex,
  step,
  floorInsertRequest,
  onJumpToStep,
  onCommentsChange,
}: {
  runId: string;
  acts: ReplayActAnalysis[];
  act: ReplayActAnalysis;
  actIndex: number;
  step: number;
  floorInsertRequest: {
    requestId: number;
    block: HistoryRunFloorBlock;
  } | null;
  onJumpToStep: (actIndex: number, step: number) => void;
  onCommentsChange?: (comments: Comment[]) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.detail;
  const threadKey = buildHistoryCourseCommentThreadKey(runId);
  const [comments, setComments] = useState<Comment[]>([]);

  const catalog = useMemo(() => historyFloorCatalogFromActs(acts), [acts]);
  const currentFloor = historyFloorFromActStep(act.baseFloor, step);
  const currentFloorBlock = catalog.find(
    (block) => block.actIndex === actIndex && block.step === step,
  ) ?? null;

  const currentFloorComments = useMemo(
    () => comments.filter((comment) => (
      commentMentionsHistoryFloor(comment.content_blocks, actIndex, step)
    )),
    [actIndex, comments, step],
  );

  const handleCommentsChange = useCallback((next: Comment[]) => {
    setComments(next);
    onCommentsChange?.(next);
  }, [onCommentsChange]);

  const handleFloorClick = useCallback((block: HistoryRunFloorBlock) => {
    onJumpToStep(block.actIndex, block.step);
  }, [onJumpToStep]);

  const scrollToCurrentFloor = useCallback(() => {
    const first = currentFloorComments[0];
    if (!first) return;
    document.getElementById(`history-comment-${first.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentFloorComments]);

  return (
    <section id="comments" className="space-y-3" data-history-course-comments="">
      <h2 className="text-sm font-semibold text-zinc-200">{copy.comments}</h2>
      {currentFloorComments.length > 0 && currentFloorBlock && (
        <button
          type="button"
          onClick={scrollToCurrentFloor}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-left text-xs text-amber-100 hover:border-amber-400/50 hover:bg-amber-400/10"
        >
          <HistoryRunFloorChip block={currentFloorBlock} />
          <span>
            {copy.atThisFloor.replace("{count}", String(currentFloorComments.length))}
          </span>
        </button>
      )}
      <CommentSection
        threadKey={threadKey}
        placeholder={copy.commentPlaceholder}
        floorHashTip={copy.floorHashTip}
        onCommentsChange={handleCommentsChange}
        onHistoryFloorClick={handleFloorClick}
        activeHistoryFloor={{ actIndex, step }}
        historyFloorInsertRequest={floorInsertRequest}
        historyFloorMentions={{ catalog, currentFloor }}
      />
    </section>
  );
}
