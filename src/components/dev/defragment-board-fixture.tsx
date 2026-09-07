"use client";

import { DefragmentIndexRow } from "@/components/defragment/defragment-index-row";
import {
  DEFRAGMENT_AUTHOR_COL_CLASS,
  DEFRAGMENT_BOARD_CONTAINER_CLASS,
  DEFRAGMENT_COUNT_COL_CLASS,
  DEFRAGMENT_DATE_COL_CLASS,
  DEFRAGMENT_TYPE_COL_CLASS,
} from "@/lib/defragment-board";
import { getPagestormNavTitle, getTransfigureNavTitle } from "@/lib/borrowed-game-copy";
import type { DefragmentFeedItem } from "@/lib/defragment";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const NOW = "2026-09-07T10:20:00.000Z";
const ko = serviceMessages.ko;

export const DEFRAGMENT_PREVIEW_FIXTURE_ITEMS: DefragmentFeedItem[] = [
  {
    id: "preview-combo-long-title",
    created_at: NOW,
    service: "combo",
    title: "아이언클래드 타락·제물로 첫 심장을 깼는데 유물이 말려서 덱이 끝까지 흔들린 이야기",
    nickname: ko.combo.defaultNickname,
    userId: "",
    likeCount: 12,
    commentCount: 7,
    recommendScore: 12,
  },
  {
    id: "preview-this-or-that",
    created_at: NOW,
    service: "this_or_that",
    title: "불꽃 vs 얼음 — 액트 1에서 뭘 고를지",
    nickname: ko.thisOrThat.defaultNickname,
    userId: "",
    likeCount: 4,
    commentCount: 21,
    recommendScore: 4,
  },
  {
    id: "preview-pagestorm",
    created_at: NOW,
    service: "pagestorm",
    title: "짧은 제목",
    nickname: ko.pagestorm.defaultNickname,
    userId: "",
    likeCount: 0,
    commentCount: 0,
    recommendScore: 0,
  },
  {
    id: "preview-transfigure",
    created_at: NOW,
    service: "transfigure",
    title: "Strike를 다시 쓰면 이름이 이렇게 길어질 수도 있다: 타격 변형 실험",
    nickname: ko.transfigure.defaultNickname,
    userId: "",
    likeCount: 3,
    commentCount: 1,
    recommendScore: 3,
  },
];

const TYPE_LABELS: Record<string, string> = {
  combo: ko.nav.combo,
  transfigure: getTransfigureNavTitle("kor"),
  this_or_that: ko.nav.thisOrThat,
  pagestorm: getPagestormNavTitle("kor"),
};

export function DefragmentBoardFixture({
  widthClass,
}: {
  widthClass: string;
}) {
  const copy = serviceMessages.ko.defragment;
  return (
    <div
      data-defragment-board-fixture
      className={cn(DEFRAGMENT_BOARD_CONTAINER_CLASS, widthClass, "overflow-hidden rounded-lg border border-white/10 bg-black/20 px-1")}
    >
      <div className="flex items-center gap-2 border-b border-primary/15 px-1 py-1 text-[11px] font-semibold tracking-wide text-zinc-500">
        <span className={cn(DEFRAGMENT_TYPE_COL_CLASS, "truncate")}>
          <span className="hidden @xl:inline">{copy.boardType}</span>
          <span className="sr-only @xl:hidden">{copy.boardType}</span>
        </span>
        <span className="min-w-0 flex-1">{copy.boardTitle}</span>
        <span className={DEFRAGMENT_AUTHOR_COL_CLASS}>{copy.boardAuthor}</span>
        <span className={cn(DEFRAGMENT_DATE_COL_CLASS, "text-right")}>{copy.boardDate}</span>
        <span className={cn(DEFRAGMENT_COUNT_COL_CLASS, "text-right")}>{copy.boardLikes}</span>
        <span className={cn(DEFRAGMENT_COUNT_COL_CLASS, "text-right")}>{copy.boardComments}</span>
      </div>
      {DEFRAGMENT_PREVIEW_FIXTURE_ITEMS.map((item) => (
        <DefragmentIndexRow
          key={item.id}
          item={item}
          typeLabel={TYPE_LABELS[item.service] ?? item.service}
          gameLocale="kor"
          userId={null}
          authReady={false}
        />
      ))}
    </div>
  );
}
