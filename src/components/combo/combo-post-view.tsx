"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";
import Image from "@/components/ui/static-image";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useComboPost } from "@/hooks/use-combo-posts";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
} from "@/lib/i18n";
import { getSiteDisplayOrigin } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";
import { buildComboEntityMap, ComboPostRenderer } from "./combo-post-renderer";
import { ComboResourceGallery } from "./combo-resource-gallery";

interface ComboPostViewProps {
  postId: string;
  gameLocale: GameLocale;
}

function getTextClass(length: number): string {
  if (length <= 80) return "text-xl sm:text-2xl";
  if (length <= 240) return "text-lg sm:text-xl";
  return "text-base sm:text-lg";
}

export function ComboPostView({ postId, gameLocale }: ComboPostViewProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].combo;
  const siteDisplayOrigin = getSiteDisplayOrigin();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const [copied, setCopied] = useState(false);
  const { post, loading, unavailable } = useComboPost(postId);
  const { entities } = useCommentEntities(undefined, { enabled: Boolean(post) });
  const entityMap = useMemo(() => buildComboEntityMap(entities), [entities]);

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
          href={localizeHrefWithGameLocale("/combo", serviceLocale, gameLocale)}
          className="text-sm text-yellow-400 hover:underline"
        >
          {copy.backToIndex}
        </Link>
      </div>
    );
  }

  return (
    <div data-combo-page="detail" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={localizeHrefWithGameLocale("/combo", serviceLocale, gameLocale)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-yellow-400"
        >
          <ArrowLeft size={16} />
          {copy.title}
        </Link>
        <button
          type="button"
          onClick={handleCopyUrl}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-yellow-500/30 hover:text-yellow-400"
        >
          <Link2 size={14} />
          {copied ? copy.copied : copy.copyLink}
        </button>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-yellow-500/15 bg-gradient-to-b from-[#0c0c18] via-[#10101e] to-[#0c0c18] p-4 pb-4 sm:p-6 sm:pb-5">
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(200,155,60,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-300">{post.nickname}</span>
          <span className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        <div className={`relative py-4 font-bold leading-relaxed text-[#f0e6d2] ${getTextClass(post.content_text.length)}`}>
          <ComboPostRenderer
            blocks={post.content}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </div>

        <div className="relative mt-2">
          <ComboResourceGallery
            resources={post.resources}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <Image
              src="/images/sts2/badges/ccccombo.webp"
              alt=""
              width={14}
              height={14}
              className="object-contain opacity-50"
            />
            <span className="text-[11px] font-semibold tracking-wide text-yellow-500/40">
              {serviceMessages[serviceLocale].brand}
            </span>
          </div>
          <span className="text-[11px] tracking-wide text-gray-600/60">
            {siteDisplayOrigin}/combo/{postId.slice(0, 8)}
          </span>
        </div>
      </article>
    </div>
  );
}
