"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Link2, Eye, EyeOff } from "lucide-react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer, buildEntityMap } from "./post-renderer";
import { blocksToPlainText } from "@/lib/chemical-utils";

interface PostViewProps {
  postId: string;
  entities: EntityInfo[];
}

function getTextClass(len: number): string {
  if (len <= 8) return "text-2xl";
  if (len <= 18) return "text-xl";
  return "text-lg";
}

export function ChemicalXPostView({ postId, entities }: PostViewProps) {
  const [post, setPost] = useState<ChemicalPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Image
          src="/images/sts2/powers/asleep_power.webp"
          alt="수면"
          width={48}
          height={48}
          className="object-contain animate-pulse"
        />
        <span className="text-sm text-gray-500">투입을 불러오는 중...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-4">글을 찾을 수 없습니다</p>
        <Link href="/chemical-x" className="text-yellow-400 text-sm hover:underline">
          케미컬X로 돌아가기
        </Link>
      </div>
    );
  }

  const textLen = blocksToPlainText(post.content).length;

  return (
    <div className="space-y-4">
      {/* Back + actions — outside the card (not in screenshot) */}
      <div className="flex items-center justify-between">
        <Link
          href="/chemical-x"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <ArrowLeft size={16} />
          케미컬X
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-gray-400 hover:text-yellow-400 hover:border-yellow-500/30 transition-colors"
          >
            <Link2 size={14} />
            {copied ? "복사됨!" : "링크 복사"}
          </button>
          <button
            type="button"
            onClick={() => setShowTooltips((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-gray-400 hover:text-yellow-400 hover:border-yellow-500/30 transition-colors"
          >
            {showTooltips ? <EyeOff size={14} /> : <Eye size={14} />}
            {showTooltips ? "접기" : "펼치기"}
          </button>
        </div>
      </div>

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
            {new Date(post.created_at).toLocaleDateString("ko-KR")}
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
            <span className="text-[11px] text-yellow-500/40 font-semibold tracking-wide">슬서운 이야기</span>
          </div>
          <span className="text-[11px] text-gray-600/60 tracking-wide">
            scare-the-spire.vercel.app/chemical-x/{postId.slice(0, 8)}
          </span>
        </div>
      </article>
    </div>
  );
}
