"use client";

import { OwnPostMark } from "@/components/own-post-mark";
import { ProfileNickname } from "@/components/profile/profile-nickname";
import { serviceMessages } from "@/messages/service";

const ko = serviceMessages.ko;

export type NicknameSurfaceTone = {
  iconUrl: string | null;
  duotone: { shadow: string; highlight: string } | null;
  nickname: string;
};

export const PALETTE_NICKNAME_SURFACES = [
  { id: "comment", label: "댓글", source: "comment-section.tsx", defaultNickname: ko.comments.defaultNickname },
  { id: "patch-comment", label: "슬서운변경 댓글", source: "patch-comments-client.js", defaultNickname: ko.comments.defaultNickname },
  { id: "combo-card", label: "코오오옴보 인덱스", source: "combo-post-card.tsx", defaultNickname: ko.combo.defaultNickname },
  { id: "chemical-card", label: "케미컬X 인덱스", source: "chemicalx/post-card.tsx", defaultNickname: ko.chemicalX.defaultNickname },
  { id: "transfigure-card", label: "변형 인덱스", source: "transfigure-post-card.tsx", defaultNickname: ko.transfigure.defaultNickname },
  { id: "this-or-that-card", label: "이거 아님 저거? 인덱스", source: "this-or-that/post-card.tsx", defaultNickname: ko.thisOrThat.defaultNickname },
  { id: "decisions-card", label: "어려운 결정 인덱스", source: "decisions-decisions-post-card.tsx", defaultNickname: ko.decisionsDecisions.defaultNickname },
  { id: "tournament-card", label: "이아저? 월드컵 인덱스", source: "favorite-tournament-post-card.tsx", defaultNickname: ko.favoriteTournament.defaultNickname },
  { id: "combo-detail", label: "코오오옴보 상세", source: "combo-post-view.tsx", defaultNickname: ko.combo.defaultNickname },
  { id: "chemical-detail", label: "케미컬X 상세", source: "chemicalx/post-view.tsx", defaultNickname: ko.chemicalX.defaultNickname },
  { id: "transfigure-detail", label: "변형 상세", source: "transfigure-post-view.tsx", defaultNickname: ko.transfigure.defaultNickname },
  { id: "this-or-that-detail", label: "이거 아님 저거? 상세", source: "this-or-that/post-view.tsx", defaultNickname: ko.thisOrThat.defaultNickname },
  { id: "decisions-detail", label: "어려운 결정 상세", source: "decisions-decisions-post-view.tsx", defaultNickname: ko.decisionsDecisions.defaultNickname },
  { id: "tournament-detail", label: "이아저? 월드컵 상세", source: "favorite-tournament-post-view.tsx", defaultNickname: ko.favoriteTournament.defaultNickname },
  { id: "defragment-detail", label: "조각모음 상세", source: "defragment-post-view.tsx", defaultNickname: ko.defragment.defaultNickname },
  { id: "defragment-index", label: "조각모음 인덱스", source: "defragment-index-row.tsx", defaultNickname: ko.defragment.defaultNickname },
  { id: "story-card", label: "슬서운 이야기 카드", source: "story-feed.tsx", defaultNickname: ko.comments.defaultNickname },
  { id: "story-detail", label: "슬서운 이야기 상세", source: "story-feed.tsx", defaultNickname: ko.comments.defaultNickname },
] as const;

export type PaletteNicknameSurfaceId = (typeof PALETTE_NICKNAME_SURFACES)[number]["id"];

export function PaletteNicknameSurfaceGallery({
  tone,
}: {
  tone: Omit<NicknameSurfaceTone, "nickname"> & { nickname?: string };
}) {
  const unset = !tone.nickname;
  return (
    <div
      data-nickname-gallery
      data-nickname-icon-url={tone.iconUrl ?? ""}
      data-nickname-mode={unset ? "unset" : "profile"}
      className="grid gap-5 sm:grid-cols-2"
    >
      {PALETTE_NICKNAME_SURFACES.map((surface) => {
        const nickname = tone.nickname ?? surface.defaultNickname;
        return (
          <section
            key={surface.id}
            data-nickname-surface={surface.id}
            data-nickname-value={nickname}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-zinc-200">{surface.label}</h3>
              <p className="font-mono text-[10px] text-zinc-500">{surface.source}</p>
            </div>
            <PaletteNicknameSurface
              id={surface.id}
              tone={{ iconUrl: tone.iconUrl, duotone: tone.duotone, nickname }}
            />
          </section>
        );
      })}
    </div>
  );
}

export function PaletteNicknameSurface({
  id,
  tone,
}: {
  id: PaletteNicknameSurfaceId;
  tone: NicknameSurfaceTone;
}) {
  switch (id) {
    case "comment":
    case "patch-comment":
      return (
        <div className="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={16}
              tokenClassName="h-4 w-4"
              nicknameClassName="font-medium text-primary"
            />
            <span className="text-[10px] text-muted-foreground">방금</span>
          </div>
          <p className="mt-1.5 text-muted-foreground">댓글 본문</p>
        </div>
      );
    case "combo-card":
    case "chemical-card":
      return (
        <article className="rounded-lg border border-border bg-card/30 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ProfileNickname
                nickname={tone.nickname}
                iconUrl={tone.iconUrl}
                duotone={tone.duotone}
                size={18}
                tokenClassName="h-[18px] w-[18px]"
                nicknameClassName="text-sm font-semibold text-gray-300"
              />
              <OwnPostMark />
            </span>
            <span className="text-xs text-gray-500">3분 전</span>
          </div>
          <p className="text-sm text-muted-foreground">인덱스 카드 본문</p>
        </article>
      );
    case "transfigure-card":
    case "this-or-that-card":
      return (
        <article className="flex flex-col rounded-lg border border-border bg-card/25 px-4 py-4">
          <h2 className="font-game-title text-base font-semibold leading-snug spire-gold">제목</h2>
          <p className="mt-2 text-sm text-muted-foreground">미리보기 자리</p>
          <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
            <OwnPostMark />
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              className="max-w-[70%]"
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-[11px] text-muted-foreground/80"
            />
          </div>
        </article>
      );
    case "decisions-card":
      return (
        <article className="flex flex-col rounded-lg border border-border bg-card/25 px-4 py-4">
          <h2 className="font-game-title text-base font-semibold leading-snug spire-gold">티어 제목</h2>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-xs text-muted-foreground"
            />
            <OwnPostMark />
            <span>3분 전</span>
          </span>
        </article>
      );
    case "tournament-card":
      return (
        <article className="rounded-lg border border-border bg-card/25 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="flex w-16 shrink-0 items-center pt-0.5">
              <ProfileNickname
                nickname={tone.nickname}
                iconUrl={tone.iconUrl}
                duotone={tone.duotone}
                size={14}
                tokenClassName="h-3.5 w-3.5"
                nicknameClassName="text-xs text-muted-foreground"
              />
            </span>
            <h2 className="min-w-0 flex-1 font-service text-[15px] font-semibold leading-snug text-foreground">
              월드컵 제목
            </h2>
          </div>
        </article>
      );
    case "defragment-index":
      return (
        <article className="border-b border-border px-1 py-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
              제목이 두 줄까지 보인다
            </span>
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">3</span>
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">5</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 pl-0">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-[11px] leading-none text-muted-foreground"
            />
            <span className="text-[11px] text-zinc-500">· 3분 전</span>
          </p>
        </article>
      );
    case "combo-detail":
    case "chemical-detail":
    case "defragment-detail":
      return (
        <article className="rounded-lg border border-border bg-card/30 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={18}
              tokenClassName="h-[18px] w-[18px]"
              nicknameClassName="text-sm font-semibold text-gray-300"
            />
            <span className="text-xs text-gray-500">방금</span>
          </div>
          <p className="text-sm text-muted-foreground">상세 본문</p>
        </article>
      );
    case "transfigure-detail":
      return (
        <div className="flex items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold text-zinc-100">변형 제목</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <span>변형된 이름</span>
              <span>·</span>
              <ProfileNickname
                nickname={tone.nickname}
                iconUrl={tone.iconUrl}
                duotone={tone.duotone}
                size={14}
                tokenClassName="h-3.5 w-3.5"
                nicknameClassName="text-xs text-zinc-500"
              />
            </span>
          </span>
        </div>
      );
    case "this-or-that-detail":
    case "tournament-detail":
      return (
        <header className="flex flex-col gap-3">
          <h1 className="font-game-title text-2xl font-semibold leading-snug spire-gold">상세 제목</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-xs text-muted-foreground"
            />
            <span aria-hidden>·</span>
            <span>방금</span>
          </div>
        </header>
      );
    case "decisions-detail":
      return (
        <header className="flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="font-service text-xl font-bold spire-gold">티어 제목</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ProfileNickname
                nickname={tone.nickname}
                iconUrl={tone.iconUrl}
                duotone={tone.duotone}
                size={14}
                tokenClassName="h-3.5 w-3.5"
                nicknameClassName="text-xs text-muted-foreground"
              />
              <span>· 3분 전 · v0</span>
            </p>
          </div>
        </header>
      );
    case "story-card":
      return (
        <div className="text-center">
          <p className="text-lg font-medium leading-snug">“이야기 문장”</p>
          <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-[11px] text-muted-foreground"
            />
            <span>· 방금</span>
          </div>
        </div>
      );
    case "story-detail":
      return (
        <div className="text-center">
          <p className="text-xl font-medium leading-snug">“이야기 문장”</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ProfileNickname
              nickname={tone.nickname}
              iconUrl={tone.iconUrl}
              duotone={tone.duotone}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-[11px] text-muted-foreground"
            />
            <span>· 방금</span>
          </p>
        </div>
      );
  }
}
