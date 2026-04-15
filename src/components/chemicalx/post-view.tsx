"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Link2, Eye, EyeOff } from "lucide-react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer, buildEntityMap } from "./post-renderer";

interface PostViewProps {
  postId: string;
  entities: EntityInfo[];
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
    const url = `${window.location.origin}/chemicalx/${postId}`;
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
        <Link href="/chemicalx" className="text-yellow-400 text-sm hover:underline">
          케미컬X로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/chemicalx"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
      >
        <ArrowLeft size={16} />
        케미컬X
      </Link>

      {/* Post card — designed to look good as a native screenshot */}
      <div className="rounded-xl border border-yellow-500/20 bg-[#0c0c16] p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-300">{post.nickname}</span>
          <span className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString("ko-KR")}
          </span>
        </div>

        {/* Content */}
        <div className="text-base leading-relaxed py-4">
          <PostRenderer blocks={post.content} entityMap={entityMap} forceShowTooltips={showTooltips} />
        </div>

        {/* Branding footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Image
              src="/images/sts2/relics/chemical_x.webp"
              alt=""
              width={14}
              height={14}
              className="object-contain"
            />
            <span className="text-[10px] text-yellow-500/60 font-semibold">슬서운 이야기</span>
          </div>
          <span className="text-[10px] text-gray-600">
            scare-the-spire.vercel.app/chemicalx/{postId.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Actions */}
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
          {showTooltips ? "툴팁 숨기기" : "전체 툴팁"}
        </button>
      </div>
    </div>
  );
}
