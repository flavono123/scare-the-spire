"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { LikeButton } from "@/components/like-button";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { FavoriteTournamentPlay } from "@/components/this-or-that/favorite-tournament-play";
import { FavoriteTournamentRanking } from "@/components/this-or-that/favorite-tournament-ranking";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import { useAuth } from "@/hooks/use-auth";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import { useFavoriteTournamentPost } from "@/hooks/use-favorite-tournament-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { buildFavoriteTournamentCommentThreadKey } from "@/lib/comment-threads";
import {
  byeCountForSize,
  entityForRef,
  FAVORITE_TOURNAMENT_HREF,
  formatBracketRoundLabel,
  isFavoriteTournamentBuiltinKey,
  playRoundOptions,
  type FavoriteTournamentMatchRecord,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import type { GameLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import { worldcupPostTitle } from "@/components/this-or-that/favorite-tournament-title";
import { formatTimeAgo } from "@/lib/relative-time";
import { serviceMessages } from "@/messages/service";

export function FavoriteTournamentPostView({
  postId,
  gameLocale,
  votePrompt,
  presetLabels,
}: {
  postId: string;
  gameLocale: GameLocale;
  votePrompt: string;
  presetLabels: Record<string, string>;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const { userId, ready, ensureUser } = useAuth();
  const catalog = useDecisionsDecisionsCatalog(gameLocale, { includeStamps: false });
  const { post, stats, loading, unavailable, remove, completePlay } = useFavoriteTournamentPost(
    postId,
    userId,
  );
  const [copied, setCopied] = useState(false);
  const [startingSize, setStartingSize] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [champion, setChampion] = useState<FavoriteTournamentResourceRef | null>(null);
  const indexHref = localizeHrefWithGameLocale(FAVORITE_TOURNAMENT_HREF, serviceLocale, gameLocale);
  const threadKey = buildFavoriteTournamentCommentThreadKey(postId);

  const roundOptions = useMemo(
    () => (post ? playRoundOptions(post.pool.length) : []),
    [post],
  );

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDelete = useCallback(async () => {
    const removed = await remove();
    if (!removed) return;
    router.push(indexHref);
  }, [indexHref, remove, router]);

  const handleComplete = useCallback(async (result: {
    champion: FavoriteTournamentResourceRef;
    matches: FavoriteTournamentMatchRecord[];
  }) => {
    setChampion(result.champion);
    setPlaying(false);
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    await completePlay({
      startingSize: startingSize ?? result.matches.length + 1,
      champion: result.champion,
      matches: result.matches,
    });
  }, [completePlay, ensureUser, startingSize, userId]);

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }
  if (loading || catalog.loading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }
  if (!post) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{copy.notFound}</p>
        <Link href={indexHref} className="text-sm text-primary underline-offset-4 hover:underline">
          {copy.backToIndex}
        </Link>
      </div>
    );
  }

  const isAuthor = Boolean(
    userId
    && post.user_id === userId
    && !isFavoriteTournamentBuiltinKey(post.preset_key),
  );
  const selectedSize = startingSize ?? roundOptions[0] ?? post.pool.length;
  const championEntity = champion ? entityForRef(champion, catalog.entityMap) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={indexHref}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          {copy.backToIndex}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
          isAuthor={isAuthor}
          deleteLabel={copy.delete}
          onDelete={() => { void handleDelete(); }}
        />
      </div>

      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-game-title text-2xl font-semibold leading-snug spire-gold md:text-3xl">
              {worldcupPostTitle(post, serviceLocale, presetLabels, catalog.entityMap)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{post.nickname}</span>
              <span>{formatTimeAgo(post.created_at, copy, dateLocale)}</span>
              <span>{formatBracketRoundLabel(post.pool.length, copy)}</span>
              <span>{copy.playCount.replace("{count}", String(post.play_count ?? 0))}</span>
            </div>
            {post.note ? (
              <p className="mt-2 font-game-text text-sm text-zinc-400">{post.note}</p>
            ) : null}
          </div>
          <LikeButton
            storyId={threadKey}
            userId={userId}
            initialCount={post.like_count ?? 0}
            authReady={ready}
            ensureUser={ensureUser}
          />
        </div>
      </header>

      {playing ? (
        <FavoriteTournamentPlay
          pool={post.pool}
          startingSize={selectedSize}
          entityMap={catalog.entityMap}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          votePrompt={votePrompt}
          onComplete={(result) => { void handleComplete(result); }}
        />
      ) : (
        <section className="space-y-3 rounded-lg border border-border/70 bg-card/20 p-4">
          <p className="font-game-text text-sm text-zinc-300">{copy.roundPrompt}</p>
          <div className="flex flex-wrap gap-2">
            {roundOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setStartingSize(size)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  selectedSize === size
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-white/5"
                }`}
              >
                {formatBracketRoundLabel(size, copy)}
              </button>
            ))}
          </div>
          {byeCountForSize(selectedSize) > 0 && selectedSize === post.pool.length ? (
            <p className="text-xs text-muted-foreground">{copy.byeNote}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {copy.roundSample
                .replace("{pool}", String(post.pool.length))
                .replace("{size}", String(selectedSize))}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setChampion(null);
              setPlaying(true);
            }}
            className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
          >
            {copy.startPlay}
          </button>
        </section>
      )}

      {championEntity && !playing && (
        <section className="space-y-3 rounded-lg border border-border/70 bg-card/20 p-4">
          <h2 className="font-service text-sm font-semibold text-zinc-300">{copy.championTitle}</h2>
          <div className="max-w-sm">
            <ThisOrThatResourcePanel
              entity={championEntity}
              sideLabel={copy.championTitle}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              size="large"
              assetOnly
              linkAsset
            />
          </div>
        </section>
      )}

      {!playing && (
        <FavoriteTournamentRanking
          post={post}
          stats={stats}
          entityMap={catalog.entityMap}
          serviceLocale={serviceLocale}
        />
      )}

      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={threadKey}
          initialEntities={catalog.entities}
        />
      </section>
    </div>
  );
}
