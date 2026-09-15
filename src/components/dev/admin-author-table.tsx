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
      });
      return { author, isOwner, icon };
    });
  }, [authors, profile, stored, userId]);

  return (
    <div className="space-y-4">
      {/* Explanation Banner */}
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200/90">
        <h3 className="font-semibold text-amber-300">💡 프로필 토큰 동작 원리 및 RLS UUID 안내</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
          <li>
            <strong className="text-zinc-100">로컬 스토리지 전용 프로필</strong>: 현재 프로필(캐릭터/보스/배색)은 서버 DB에 저장되지 않고 각 사용자의 브라우저 LocalStorage(<code className="text-amber-200">sts-user-profile</code>)에만 보관됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">타인 글의 fallback(?) 토큰</strong>: 글/댓글 테이블에는 오직 RLS 익명 <code className="text-amber-200">user_id</code>와 <code className="text-amber-200">nickname</code>만 저장되므로, 다른 사용자의 글이나 다른 기기에서 쓴 글은 프로필을 알 수 없어 무조건 <code className="text-amber-200">?</code>(미지정 fallback)로 렌더링됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">PC vs 모바일 UUID 분리</strong>: Supabase 익명 세션은 브라우저마다 별도 발급됩니다. PC에서 작성한 글(예: 패치아조씨)은 PC의 UUID를 가지므로, 모바일 기기에서는 본인 글로 인식되지 않아 <code className="text-amber-200">?</code>로 표시됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">모바일에서 일부만 보이는 현상</strong>: 모바일 브라우저에서 프로필 저장을 누르지 않았거나(<code className="text-amber-200">stored: false</code>), Safari ITP/시크릿 탭 등으로 세션이 갱신된 경우 과거 글의 UUID와 현재 UUID가 달라져 <code className="text-amber-200">?</code>가 됩니다.
          </li>
        </ul>
        {userId && (
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-mono text-amber-100">
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
