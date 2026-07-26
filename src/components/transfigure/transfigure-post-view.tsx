"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Link2, Sparkles } from "lucide-react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useTransfigurePost } from "@/hooks/use-transfigure-posts";
import { buildTransfigureCommentThreadKey } from "@/lib/comment-threads";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
} from "@/lib/i18n";
import { getSiteDisplayOrigin } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

interface TransfigurePostViewProps {
  postId: string;
  gameLocale: GameLocale;
}

function getTextClass(length: number): string {
  if (length <= 80) return "text-xl sm:text-2xl";
  if (length <= 240) return "text-lg sm:text-xl";
  return "text-base sm:text-lg";
}

export function TransfigurePostView({
  postId,
  gameLocale,
}: TransfigurePostViewProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].transfigure;
  const siteDisplayOrigin = getSiteDisplayOrigin();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const [copied, setCopied] = useState(false);
  const { post, loading, unavailable } = useTransfigurePost(postId);
  const { entities } = useCommentEntities(undefined, { enabled: Boolean(post) });
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }

  if (loading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }

  if (!post) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-gray-500">{copy.notFound}</p>
        <Link
          href={localizeHrefWithGameLocale("/transfigure", serviceLocale, gameLocale)}
          className="text-sm text-cyan-200 hover:underline"
        >
          {copy.backToIndex}
        </Link>
      </div>
    );
  }

  const resource = entityMap.get(`${post.resource_type}:${post.resource_id}`);

  return (
    <div data-transfigure-page="detail" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={localizeHrefWithGameLocale("/transfigure", serviceLocale, gameLocale)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-cyan-200"
        >
          <ArrowLeft size={16} />
          {copy.backToIndex}
        </Link>
        <button
          type="button"
          onClick={handleCopyUrl}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
        >
          <Link2 size={14} />
          {copied ? copy.copied : copy.copyLink}
        </button>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-b from-[#080c17] via-[#0b1220] to-[#080c17] p-4 sm:p-6">
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.09) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/25">
              {resource?.imageUrl ? (
                <Image
                  src={resource.imageUrl}
                  alt=""
                  width={38}
                  height={38}
                  className="max-h-9 max-w-9 object-contain"
                />
              ) : (
                <Sparkles className="h-5 w-5 text-cyan-200/70" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-zinc-100">
                {post.title?.trim() || resource?.nameKo || post.resource_id}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                {resource?.nameKo ?? post.resource_id} · {post.nickname}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        <div className="relative rounded-xl border border-white/5 bg-black/15 px-3 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/45">
            {copy.sourceLabel}
          </span>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            {post.source_text}
          </p>
        </div>

        <div className="relative flex justify-center py-2 text-cyan-200/45">
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="relative rounded-xl border border-cyan-300/10 bg-cyan-500/5 px-3 py-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/55">
            {copy.resultLabel}
          </span>
          <div className={`mt-2 font-bold leading-relaxed text-[#f0e6d2] ${getTextClass(post.content_text.length)}`}>
            <PostRenderer
              blocks={post.content}
              entityMap={entityMap}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            />
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <Image
              src="/images/sts2/relics/astrolabe.webp"
              alt=""
              width={14}
              height={14}
              className="object-contain opacity-60"
            />
            <span className="text-[11px] font-semibold tracking-wide text-cyan-200/40">
              {serviceMessages[serviceLocale].brand}
            </span>
          </div>
          <span className="text-[11px] tracking-wide text-gray-600/60">
            {siteDisplayOrigin}/transfigure/{postId.slice(0, 8)}
          </span>
        </div>
      </article>

      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={buildTransfigureCommentThreadKey(post.id)}
          initialEntities={entities}
        />
      </section>
    </div>
  );
}
