"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  useTransfigurePost,
  type SaveTransfigurePostInput,
} from "@/hooks/use-transfigure-posts";
import { buildTransfigureCommentThreadKey } from "@/lib/comment-threads";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
} from "@/lib/i18n";
import { getSiteDisplayOrigin } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

const TransfigureComposerModal = dynamic(
  () => import("./transfigure-composer-modal").then(
    (module) => module.TransfigureComposerModal,
  ),
  { ssr: false },
);

interface TransfigurePostViewProps {
  postId: string;
  gameLocale: GameLocale;
  upgradeLabel: string;
}

export function TransfigurePostView({
  postId,
  gameLocale,
  upgradeLabel,
}: TransfigurePostViewProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].transfigure;
  const siteDisplayOrigin = getSiteDisplayOrigin();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const router = useRouter();
  const { userId, ready, ensureUser } = useAuth();
  const { post, loading, unavailable, update, remove } = useTransfigurePost(postId, userId);
  const { entities } = useCommentEntities(undefined, { enabled: Boolean(post) });
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);
  const handleUpdate = useCallback(async (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const updatedPost = await update({ ...input, activeUserId });
    if (!updatedPost) throw new Error("transfigure update rejected");
    setEditing(false);
    setSaveNotice(copy.updateSuccess);
  }, [copy.updateSuccess, ensureUser, update, userId]);
  const handleDelete = useCallback(async () => {
    const removed = await remove();
    if (!removed) return;
    setEditing(false);
    router.replace(
      localizeHrefWithGameLocale("/transfigure", serviceLocale, gameLocale),
    );
  }, [gameLocale, remove, router, serviceLocale]);

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
          className="spire-gold text-sm hover:underline"
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
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-yellow-200"
        >
          <ArrowLeft size={16} />
          {copy.backToIndex}
        </Link>
        <div className="flex items-center gap-2">
          {ready && userId === post.user_id && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSaveNotice(null);
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-yellow-400/30 hover:text-yellow-200"
              >
                <Pencil size={14} />
                {copy.edit}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded border border-red-400/15 px-3 py-1.5 text-xs text-red-300/70 transition-colors hover:border-red-300/40 hover:text-red-200"
              >
                <Trash2 size={14} />
                {copy.delete}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-yellow-400/30 hover:text-yellow-200"
          >
            <Link2 size={14} />
            {copied ? copy.copied : copy.copyLink}
          </button>
        </div>
      </div>

      {saveNotice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-yellow-300/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100"
          data-transfigure-save-feedback="success"
        >
          {saveNotice}
        </p>
      )}

      <article className="relative overflow-hidden rounded-2xl border border-yellow-500/15 bg-gradient-to-b from-[#080c17] via-[#0b1220] to-[#080c17] p-4 sm:p-6">
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(239,200,81,0.09) 0%, transparent 70%)",
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
                <Sparkles className="h-5 w-5 text-yellow-200/70" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-zinc-100">
                {post.title?.trim() || resource?.nameKo || post.resource_id}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                {post.transformed_name?.trim() || resource?.nameKo || post.resource_id}
                {post.show_upgrade && resource?.type === "card" ? "+" : ""}
                {" · "}
                {post.nickname}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        <div className="relative rounded-xl border border-yellow-300/10 bg-yellow-500/5 px-3 py-4">
          <span className="spire-gold text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
            {copy.resultLabel}
          </span>
          <div className="mt-3">
            {resource ? (
              <TransfigureResourcePreview
                key={`${post.id}:${post.show_upgrade}`}
                blocks={post.content}
                entities={entities}
                entity={resource}
                gameLocale={gameLocale}
                serviceLocale={serviceLocale}
                transformedName={post.transformed_name}
                transformedCost={post.transformed_cost}
                transformedCardType={post.transformed_card_type}
                transformedCardRarity={post.transformed_card_rarity}
                cardKeywords={{
                  top: post.card_top_keywords,
                  bottom: post.card_bottom_keywords,
                }}
                transformedUpgradeCost={post.transformed_upgrade_cost}
                upgradedBlocks={post.upgraded_content}
                upgradedCardKeywords={{
                  top: post.upgraded_card_top_keywords,
                  bottom: post.upgraded_card_bottom_keywords,
                }}
                upgradeLabel={upgradeLabel}
                initialShowUpgrade={post.show_upgrade}
              />
            ) : (
              <div className="text-lg font-bold leading-relaxed text-[#f0e6d2]">
                <PostRenderer
                  blocks={post.content}
                  entityMap={entityMap}
                  serviceLocale={serviceLocale}
                  gameLocale={gameLocale}
                />
              </div>
            )}
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 items-center gap-1.5">
            <Image
              src="/images/sts2/relics/astrolabe.webp"
              alt=""
              width={14}
              height={14}
              className="object-contain opacity-60"
            />
            <span className="spire-gold whitespace-nowrap text-[11px] font-semibold tracking-wide opacity-50">
              {serviceMessages[serviceLocale].brand}
            </span>
          </div>
          <span className="block max-w-full truncate text-[11px] tracking-wide text-gray-600/60 sm:text-right">
            {siteDisplayOrigin}/transfigure/{postId.slice(0, 8)}
          </span>
        </div>
      </article>

      {editing && resource && (
        <TransfigureComposerModal
          entities={entities}
          gameLocale={gameLocale}
          initialPost={post}
          profileNickname={post.nickname}
          serviceLocale={serviceLocale}
          upgradeLabel={upgradeLabel}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setEditing(false)}
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
          threadKey={buildTransfigureCommentThreadKey(post.id)}
          initialEntities={entities}
        />
      </section>
    </div>
  );
}
