"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { resolveDisplayedNicknameIcon } from "@/lib/profile-nickname-icon";
import { ProfileNickname } from "@/components/profile/profile-nickname";
import {
  ADMIN_SERVICE_LABELS,
  ADMIN_SERVICE_TOKEN_SRC,
  type AdminAuthorRow,
} from "@/lib/admin-rls-activity";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AdminAuthorTable({ authors }: { authors: AdminAuthorRow[] }) {
  const { userId } = useAuth();
  const { stored, profile } = useStoredProfileSnapshot();

  const authorTokens = useMemo(() => {
    return authors.map((author) => {
      const isOwner = Boolean(userId && userId === author.userId);
      const icon = resolveDisplayedNicknameIcon({
        stored,
        profile,
        isOwner,
        nickname: author.latestNickname,
        authorToken: {
          avatar_id: author.latestAvatarId,
          avatar_kind: author.latestAvatarKind,
          palette_id: author.latestPaletteId,
          palette_swapped: author.latestPaletteSwapped,
        },
      });
      return { author, isOwner, icon };
    });
  }, [authors, profile, stored, userId]);

  return (
    <div className="space-y-4">
      {/* Explanation Banner */}
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-4 text-xs text-emerald-200/90">
        <h3 className="font-semibold text-emerald-300">💡 프로필 토큰 동작 원리 및 RLS UUID 안내</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
          <li>
            <strong className="text-zinc-100">작성 시점 프로필 토큰 영구 저장</strong>: 글/댓글 작성 및 수정 시 작성자의 프로필 토큰(<code className="text-emerald-200">avatar_id</code>, <code className="text-emerald-200">avatar_kind</code>, <code className="text-emerald-200">palette_id</code>, <code className="text-emerald-200">palette_swapped</code>)이 DB에 스냅샷으로 저장됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">기기/브라우저/타인 무관 렌더링</strong>: DB에 저장된 토큰이 있는 글은 모바일/PC/타인 구분 없이 누구나 작성자가 설정한 캐릭터 및 배색 토큰으로 표시됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">이전 작성 글 및 프로필 미설정 fallback(?)</strong>: 본 기능 적용 이전의 레거시 글이거나 프로필을 저장하지 않은 사용자의 글은 미지정 fallback인 <code className="text-emerald-200">?</code> 토큰으로 표시됩니다 (단, 본인 브라우저에서 볼 때는 로컬 프로필로 fallback).
          </li>
        </ul>
        {userId && (
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-mono text-emerald-100">
            <span>내 현재 브라우저 RLS UUID:</span>
            <span className="font-bold">{userId}</span>
            {stored ? (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">프로필 저장됨 ({profile.nickname})</span>
            ) : (
              <span className="rounded bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-zinc-400">프로필 미저장 (기본값)</span>
            )}
          </div>
        )}
      </div>

      {/* Authors Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">프로필 토큰</th>
              <th className="px-3 py-2">대표 닉네임</th>
              <th className="px-3 py-2">RLS UUID (user_id)</th>
              <th className="px-3 py-2 text-right">작성 수</th>
              <th className="px-3 py-2">활동 서비스</th>
              <th className="px-3 py-2">최근 활동 (KST)</th>
            </tr>
          </thead>
          <tbody>
            {authorTokens.map(({ author, isOwner, icon }) => (
              <tr
                key={author.userId}
                className={`border-t border-border/70 align-middle ${
                  isOwner ? "bg-primary/5 font-medium" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <ProfileNickname
                      nickname={author.latestNickname}
                      iconUrl={icon.iconUrl}
                      duotone={icon.duotone}
                      kind={icon.kind}
                      size={18}
                      tokenClassName="h-[18px] w-[18px]"
                      nicknameClassName="sr-only"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {icon.kind === "profile" ? "프로필" : "?"}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-primary font-semibold">
                      {author.latestNickname}
                    </span>
                    {author.nicknames.length > 1 && (
                      <span className="text-[10px] text-muted-foreground">
                        다른 닉네임: {author.nicknames.filter((n) => n !== author.latestNickname).join(", ")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <code className="text-zinc-300">{author.userId}</code>
                    {isOwner && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        내 세션
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                  <span className="text-zinc-200">
                    총 {(author.commentCount + author.postCount).toLocaleString("ko-KR")}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    댓글 {author.commentCount} · 글 {author.postCount}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {author.services.map((service) => (
                      <span
                        key={service}
                        className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {service === "comments" ? (
                          <span>댓글</span>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ADMIN_SERVICE_TOKEN_SRC[service]}
                              alt=""
                              width={12}
                              height={12}
                              className="h-3 w-3 shrink-0"
                            />
                            <span>{ADMIN_SERVICE_LABELS[service]}</span>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                  {formatDate(author.lastActiveAt)}
                </td>
              </tr>
            ))}
            {authors.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                  작성자 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
