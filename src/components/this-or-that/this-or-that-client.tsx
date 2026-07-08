"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatPosts } from "@/hooks/use-this-or-that-posts";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { GameLocale } from "@/lib/i18n";
import {
  buildThisOrThatEntityMap,
  entityToThisOrThatRef,
  isSameThisOrThatResource,
  resolveThisOrThatPost,
} from "@/lib/this-or-that";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatPostCard } from "@/components/this-or-that/post-card";
import { ThisOrThatResourcePicker } from "@/components/this-or-that/resource-picker";

export function ThisOrThatClient({
  entities,
  gameLocale,
  title,
  prompt,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  title: string;
  prompt: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const { userId, ready, unavailable: authUnavailable, ensureUser } = useAuth();
  const { posts, loading, unavailable, add, remove } = useThisOrThatPosts(userId);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildThisOrThatEntityMap(entities), [entities]);
  const resolvedPosts = useMemo(
    () => posts.map((post) => resolveThisOrThatPost(post, entityMap)),
    [entityMap, posts],
  );
  const [leftEntity, setLeftEntity] = useState<EntityInfo | null>(null);
  const [rightEntity, setRightEntity] = useState<EntityInfo | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);

  const leftRef = leftEntity ? entityToThisOrThatRef(leftEntity) : null;
  const rightRef = rightEntity ? entityToThisOrThatRef(rightEntity) : null;
  const trimmedReason = reason.trim();
  const canSubmit =
    ready
    && !authUnavailable
    && !unavailable
    && Boolean(leftRef)
    && Boolean(rightRef)
    && !isSameThisOrThatResource(leftRef, rightRef)
    && trimmedReason.length >= 2
    && trimmedReason.length <= 500
    && nickname.trim().length >= 1
    && nickname.trim().length <= 20
    && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!leftRef || !rightRef || !canSubmit) return;
    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      const post = await add({
        left: leftRef,
        right: rightRef,
        reason,
        nickname,
        activeUserId,
      });
      if (post) {
        setLeftEntity(null);
        setRightEntity(null);
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  }, [add, canSubmit, ensureUser, leftRef, nickname, reason, rightRef, userId]);

  const handleDelete = useCallback(
    (postId: string) => {
      remove(postId);
    },
    [remove],
  );

  const storageUnavailable = authUnavailable || unavailable;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-lg border border-border bg-card/25">
        <Image
          src="/images/sts2/events/this_or_that.webp"
          alt=""
          width={3440}
          height={1616}
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="relative flex items-center gap-3 px-4 py-5">
          <Image
            src="/images/sts2/relics/choices_paradox.webp"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0">
            <h1 className="font-service text-2xl font-black text-zinc-50">
              {title}
            </h1>
            {prompt && (
              <p className="mt-1 truncate font-game-title text-sm text-blue-200">
                {prompt}
              </p>
            )}
          </div>
        </div>
      </header>

      {storageUnavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : (
        <section className="rounded-lg border border-border bg-card/25 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ThisOrThatResourcePicker
              entities={entities}
              label={copy.leftLabel}
              value={leftEntity}
              onChange={setLeftEntity}
              placeholder={copy.searchPlaceholder}
              exclude={rightEntity}
            />
            <ThisOrThatResourcePicker
              entities={entities}
              label={copy.rightLabel}
              value={rightEntity}
              onChange={setRightEntity}
              placeholder={copy.searchPlaceholder}
              exclude={leftEntity}
            />
          </div>

          <div className="mt-4 space-y-2">
            <input
              key={profile.nickname}
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={copy.nicknamePlaceholder}
              maxLength={20}
              className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-yellow-500/50"
            />
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              maxLength={500}
              rows={4}
              className="min-h-24 w-full resize-y rounded bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-yellow-500/50"
            />
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xs ${trimmedReason.length > 500 ? "text-red-400" : "text-muted-foreground"}`}>
                {trimmedReason.length}/500
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="ml-auto rounded bg-yellow-500/20 px-3 py-1.5 text-sm font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "..." : copy.submit}
              </button>
            </div>
          </div>
        </section>
      )}

      {!storageUnavailable && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
        </div>
      )}

      {storageUnavailable ? null : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="space-y-3">
          {resolvedPosts.map((resolvedPost) => (
            <ThisOrThatPostCard
              key={resolvedPost.post.id}
              resolvedPost={resolvedPost}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              isOwner={resolvedPost.post.user_id === userId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
