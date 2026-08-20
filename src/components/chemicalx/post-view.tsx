"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/static-image";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { PostDetailActions } from "@/components/post-detail-actions";
import { CommentSection } from "@/components/comment-section";
import { useAuth } from "@/hooks/use-auth";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { localizeHref } from "@/lib/i18n";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { PostRenderer, buildEntityMap } from "./post-renderer";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { buildChemicalXCommentThreadKey } from "@/lib/comment-threads";
import { getSiteDisplayOrigin } from "@/lib/site-origin";
import { useCommentEntities } from "@/hooks/use-comment-entities";

interface PostViewProps {
  postId: string;
  entities?: EntityInfo[];
  variant?: "page" | "embed";
}

function getTextClass(len: number): string {
  if (len <= 8) return "text-2xl";
  if (len <= 18) return "text-xl";
  return "text-lg";
}

export function ChemicalXPostView({ postId, entities, variant = "page" }: PostViewProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const siteDisplayOrigin = getSiteDisplayOrigin();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const { userId, ready } = useAuth();
  const [post, setPost] = useState<ChemicalPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [copied, setCopied] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  const { entities: resolvedEntities } = useCommentEntities(entities);
  const entityMap = useMemo(() => buildEntityMap(resolvedEntities), [resolvedEntities]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    supabase
      .from("chemical_posts")
      .select("*")
      .eq("id", postId)
      .eq("env", supabaseEnv)
      .single()
      .then(({ data }) => {
        setPost(data as ChemicalPost | null);
        setLoading(false);
      });
  }, [postId]);

  const handleCopyUrl = useCallback(() => {
    const url = `${window.location.origin}/chemical-x/${postId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [postId]);

  const handleDelete = useCallback(async () => {
    if (!userId || !supabaseEnabled || !post) return;
    const { error } = await withSupabaseTimeout(
      "chemical_posts.detail.delete",
      supabase
        .from("chemical_posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv),
    ).catch(() => ({ error: new Error("timeout") }));
    if (error) return;
    router.replace(localizeHref("/chemical-x", serviceLocale));
  }, [post, postId, router, serviceLocale, userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Image
          src="/images/sts2/powers/asleep_power.webp"
          alt={copy.loading}
          width={48}
          height={48}
          className="object-contain animate-pulse"
        />
        <span className="text-sm text-gray-500">{copy.loading}</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-4">{copy.notFound}</p>
        <Link href={localizeHref("/chemical-x", serviceLocale)} className="text-yellow-400 text-sm hover:underline">
          {copy.backToChemicalX}
        </Link>
      </div>
    );
  }

  const textLen = blocksToPlainText(post.content).length;
  const embed = variant === "embed";

  return (
    <div className="space-y-4">
      {!embed && (
      <div className="flex items-center justify-between">
        <Link
          href={localizeHref("/chemical-x", serviceLocale)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <ArrowLeft size={16} />
          {copy.title}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
          isAuthor={ready && !!userId && userId === post.user_id}
          deleteLabel={copy.delete}
          onDelete={handleDelete}
        >
          <button
            type="button"
            onClick={() => setShowTooltips((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-[#d4a843]/40 hover:text-[#d4a843]"
          >
            {showTooltips ? <EyeOff size={14} /> : <Eye size={14} />}
            {showTooltips ? copy.collapse : copy.expand}
          </button>
        </PostDetailActions>
      </div>
      )}

      {/* ===== Screenshot-worthy card ===== */}
      <article className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#0c0c18] via-[#10101e] to-[#0c0c18] border border-yellow-500/15 p-6 pb-5">
        {/* Ambient gold glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(200,155,60,0.08) 0%, transparent 70%)", filter: "blur(40px)" }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-300">{post.nickname}</span>
          <span className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        {/* Post text — adaptive size */}
        <div className={`relative ${getTextClass(textLen)} font-bold leading-relaxed text-[#f0e6d2] py-3`}>
          <PostRenderer blocks={post.content} entityMap={entityMap} forceShowTooltips={showTooltips} />
        </div>

        {/* Branding footer — subtle, in-card */}
        <div className="relative flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <Image
              src="/images/sts2/relics/chemical_x.webp"
              alt=""
              width={14}
              height={14}
              className="object-contain opacity-50"
            />
            <span className="text-[11px] text-yellow-500/40 font-semibold tracking-wide">
              {serviceMessages[serviceLocale].brand}
            </span>
          </div>
          <span className="text-[11px] text-gray-600/60 tracking-wide">
            {siteDisplayOrigin}/chemical-x/{postId.slice(0, 8)}
          </span>
        </div>
      </article>

      {!embed && (
      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={buildChemicalXCommentThreadKey(post.id)}
          initialEntities={resolvedEntities}
        />
      </section>
      )}
    </div>
  );
}
