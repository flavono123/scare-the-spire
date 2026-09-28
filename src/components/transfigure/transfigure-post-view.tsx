"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { BoundedCarouselFrame } from "@/components/codex/bounded-carousel";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import {
  TransfigureVariantPreview,
  transfigureVariantDisplayName,
} from "@/components/transfigure/transfigure-variant-preview";
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
import {
  transfigurePostVariants,
  transfigureVariantEntityKey,
} from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";
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
  variant?: "page" | "embed";
}

export function TransfigurePostView({
  postId,
  gameLocale,
  upgradeLabel,
  variant = "page",
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
  const variants = useMemo(
    () => (post ? transfigurePostVariants(post) : []),
    [post],
  );
  const [activeIndex, setActiveIndex] = useState(0);

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

  const embed = variant === "embed";

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
        {!embed && (
          <Link
            href={localizeHrefWithGameLocale("/transfigure", serviceLocale, gameLocale)}
            className="spire-gold text-sm hover:underline"
          >
            {copy.backToIndex}
          </Link>
        )}
      </div>
    );
  }

  const currentIndex = activeIndex < variants.length ? activeIndex : 0;
  const activeVariant = variants[currentIndex]!;
  const resource = entityMap.get(transfigureVariantEntityKey(activeVariant));

  return (
    <div data-transfigure-page={embed ? "embed" : "detail"} className="space-y-4">
      {!embed && (
      <div className="flex items-center justify-between">
        <Link
          href={localizeHrefWithGameLocale("/transfigure", serviceLocale, gameLocale)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          {copy.backToIndex}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
          isAuthor={ready && userId === post.user_id}
          editLabel={copy.edit}
          onEdit={() => {
            setSaveNotice(null);
            setEditing(true);
          }}
          deleteLabel={copy.delete}
          onDelete={handleDelete}
        />
      </div>
      )}

      {saveNotice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
          data-transfigure-save-feedback="success"
        >
          {saveNotice}
        </p>
      )}

      <article className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-b from-[#080c17] via-[#0b1220] to-[#080c17] p-4 sm:p-6">
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
                <Sparkles className="h-5 w-5 text-primary/70" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold text-zinc-100">
                {post.title?.trim() || resource?.nameKo || post.resource_id}
              </span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
                <span className="truncate">
                  {transfigureVariantDisplayName(activeVariant, entityMap)}
                </span>
                <span>·</span>
                <DisplayedProfileNickname
                  nickname={post.nickname}
                  isOwner={Boolean(ready && userId && userId === post.user_id)}
                  authorToken={post}
                  size={14}
                  tokenClassName="h-3.5 w-3.5"
                  nicknameClassName="text-xs text-zinc-500"
                />
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        <div className="relative rounded-xl border border-primary/10 bg-primary/5 px-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="spire-gold text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              {copy.resultLabel}
            </span>
            {variants.length > 1 && (
              <span
                className="font-game-title text-xs tabular-nums text-primary/70"
                data-transfigure-variant-position=""
              >
                {copy.variantPosition
                  .replace("{index}", String(currentIndex + 1))
                  .replace("{total}", String(variants.length))}
              </span>
            )}
          </div>
          {variants.length > 1 && (
            <div
              role="tablist"
              aria-label={copy.variantsLabel}
              className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-transfigure-variant-tabs=""
            >
              {variants.map((variant, index) => {
                const selected = index === currentIndex;
                const variantResource = entityMap.get(transfigureVariantEntityKey(variant));
                return (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      selected
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/10 text-zinc-400 hover:border-primary/30 hover:text-zinc-200",
                    )}
                  >
                    {variantResource?.imageUrl && (
                      <Image
                        src={variantResource.imageUrl}
                        alt=""
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain"
                      />
                    )}
                    <span className="max-w-[10rem] truncate">
                      {transfigureVariantDisplayName(variant, entityMap)}
                    </span>
                    {index === 0 && (
                      <span className="rounded bg-primary/20 px-1 text-[10px] text-primary">
                        {copy.representative}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3">
            {(() => {
              const preview = (
                <TransfigureVariantPreview
                  key={`${post.id}:${currentIndex}:${activeVariant.show_upgrade}`}
                  variant={activeVariant}
                  entities={entities}
                  entityMap={entityMap}
                  gameLocale={gameLocale}
                  serviceLocale={serviceLocale}
                  upgradeLabel={upgradeLabel}
                  showImageActions
                  showUpgradeToggle
                  fallbackClassName="text-lg font-bold"
                />
              );
              if (variants.length <= 1) return preview;
              return (
                <BoundedCarouselFrame
                  canMovePrevious={currentIndex > 0}
                  canMoveNext={currentIndex < variants.length - 1}
                  onPrevious={() => setActiveIndex(Math.max(0, currentIndex - 1))}
                  onNext={() => setActiveIndex(
                    Math.min(variants.length - 1, currentIndex + 1),
                  )}
                  previousLabel={copy.previousVariant}
                  nextLabel={copy.nextVariant}
                >
                  {preview}
                </BoundedCarouselFrame>
              );
            })()}
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

      {!embed && editing && entities.length > 0 && (
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

      {!embed && (
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
      )}
    </div>
  );
}
