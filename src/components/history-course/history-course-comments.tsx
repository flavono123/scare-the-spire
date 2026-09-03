"use client";

import { useCallback, useMemo, useState } from "react";
import { CommentSection } from "@/components/comment-section";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";
import { buildHistoryCourseCommentThreadKey } from "@/lib/comment-threads";
import type { Comment } from "@/hooks/use-comments";
import {
  buildHistoryRunFloorBlock,
  commentMentionsHistoryFloor,
  historyRunFloorPlainText,
} from "@/lib/history-run-floor";
import type { ReplayActAnalysis } from "@/lib/sts2-run-replay";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

export function HistoryCourseComments({
  runId,
  act,
  actIndex,
  step,
  onJumpToStep,
  onCommentsChange,
}: {
  runId: string;
  act: ReplayActAnalysis;
  actIndex: number;
  step: number;
  onJumpToStep: (actIndex: number, step: number) => void;
  onCommentsChange?: (comments: Comment[]) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.detail;
  const threadKey = buildHistoryCourseCommentThreadKey(runId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [floorInsertRequest, setFloorInsertRequest] = useState<{
    requestId: number;
    block: HistoryRunFloorBlock;
  } | null>(null);

  const stampBlock = useMemo(
    () => buildHistoryRunFloorBlock({ ...act, actIndex }, step),
    [act, actIndex, step],
  );

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

  const handleStamp = useCallback(() => {
    if (!stampBlock) return;
    setFloorInsertRequest((prev) => ({
      requestId: (prev?.requestId ?? 0) + 1,
      block: stampBlock,
    }));
  }, [stampBlock]);

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
      {currentFloorComments.length > 0 && stampBlock && (
        <button
          type="button"
          onClick={scrollToCurrentFloor}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-left text-xs text-amber-100 hover:border-amber-400/50 hover:bg-amber-400/10"
        >
          <HistoryRunFloorChip block={stampBlock} />
          <span>
            {copy.atThisFloor.replace("{count}", String(currentFloorComments.length))}
          </span>
        </button>
      )}
      <CommentSection
        threadKey={threadKey}
        onCommentsChange={handleCommentsChange}
        onHistoryFloorClick={handleFloorClick}
        activeHistoryFloor={{ actIndex, step }}
        historyFloorInsertRequest={floorInsertRequest}
        toolbarStart={
          stampBlock ? (
            <GameUiHoverTip label={historyRunFloorPlainText(stampBlock, serviceLocale)}>
              <button
                type="button"
                onClick={handleStamp}
                className="flex shrink-0 items-center gap-1.5 rounded bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/25 hover:bg-amber-400/20"
              >
                {copy.stampFloor}
              </button>
            </GameUiHoverTip>
          ) : null
        }
      />
    </section>
  );
}
