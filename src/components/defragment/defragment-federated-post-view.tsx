"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { ComboPostView } from "@/components/combo/combo-post-view";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";
import { PostDetailActions } from "@/components/post-detail-actions";
import { ThisOrThatPostView } from "@/components/this-or-that/post-view";
import { TransfigurePostView } from "@/components/transfigure/transfigure-post-view";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { fetchDefragmentBody, type DefragmentBody } from "@/hooks/use-defragment-bodies";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_HREF,
  defragmentItemThreadKey,
  defragmentOriginalHref,
  type DefragmentFederatedService,
} from "@/lib/defragment";
import { localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export function DefragmentFederatedPostView({
  service,
  postId,
  gameLocale,
  typeLabel,
  comboPlaceholder,
  upgradeLabel,
  thisOrThatTitle,
  votePrompt,
  voteDone,
}: {
  service: DefragmentFederatedService;
  postId: string;
  gameLocale: GameLocale;
  typeLabel: string;
  comboPlaceholder: string;
  upgradeLabel: string;
  thisOrThatTitle: string;
  votePrompt: string;
  voteDone: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const { userId, ready, ensureUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [overlay, setOverlay] = useState<DefragmentBody | null>(null);
  const { entities } = useCommentEntities();
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const indexHref = localizeHrefWithGameLocale(DEFRAGMENT_HREF, serviceLocale, gameLocale);
  const originalHref = defragmentOriginalHref({ id: postId, service }, serviceLocale, gameLocale);
  const threadKey = defragmentItemThreadKey({ id: postId, service });
  const tokenSrc = DEFRAGMENT_FEED_SERVICE_META[service].tokenSrc;

  useEffect(() => {
    let cancelled = false;
    fetchDefragmentBody(service, postId)
      .then((body) => {
        if (!cancelled) setOverlay(body);
      })
      .catch(() => {
        if (!cancelled) setOverlay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, service]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="space-y-6" data-defragment-page="detail" data-defragment-embed={service}>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={indexHref}
          className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:underline"
        >
          <ArrowLeft size={14} />
          {copy.backToIndex}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <Image src={tokenSrc} alt="" width={16} height={16} className="size-4 object-contain" />
        <Link href={originalHref} className="text-yellow-400/80 hover:underline">
          {copy.openOriginal.replace("{name}", typeLabel)}
        </Link>
      </div>

      {overlay && overlay.content_text.trim().length > 0 && (
        <article className="rounded-lg border border-border bg-card/20 px-4 py-3 text-sm leading-relaxed">
          <PostRenderer
            blocks={overlay.content}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </article>
      )}

      {service === "combo" && (
        <ComboPostView
          postId={postId}
          gameLocale={gameLocale}
          placeholder={comboPlaceholder}
          variant="embed"
        />
      )}
      {service === "transfigure" && (
        <TransfigurePostView
          postId={postId}
          gameLocale={gameLocale}
          upgradeLabel={upgradeLabel}
          variant="embed"
        />
      )}
      {service === "this_or_that" && (
        <ThisOrThatPostView
          postId={postId}
          gameLocale={gameLocale}
          title={thisOrThatTitle}
          votePrompt={votePrompt}
          voteDone={voteDone}
          variant="embed"
        />
      )}
      {service === "chemical_x" && (
        <ChemicalXPostView postId={postId} variant="embed" />
      )}

      {service !== "this_or_that" && (
        <LikeButton
          storyId={threadKey}
          userId={userId}
          size={15}
          authReady={ready}
          userStatusLoading="lazy"
          ensureUser={ensureUser}
          tipLabel={tips.like}
          tipLabelActive={tips.unlike}
        />
      )}

      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection threadKey={threadKey} initialEntities={entities} />
      </section>
    </div>
  );
}
