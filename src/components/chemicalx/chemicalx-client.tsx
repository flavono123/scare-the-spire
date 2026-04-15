"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { useAuth } from "@/hooks/use-auth";
import { useChemicalPosts } from "@/hooks/use-chemical-posts";
import { ChemicalXEditor } from "./chemicalx-editor";
import { PostCard } from "./post-card";
import { buildEntityMap } from "./post-renderer";

interface ChemicalXClientProps {
  entities: EntityInfo[];
}

export function ChemicalXClient({ entities }: ChemicalXClientProps) {
  const { userId, ready } = useAuth();
  const { posts, loading, add, remove } = useChemicalPosts(userId);
  const [showAllTooltips, setShowAllTooltips] = useState(false);

  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleSubmit = useCallback(
    async (blocks: PostBlock[], nickname: string) => {
      await add(blocks, nickname);
    },
    [add],
  );

  const handleDelete = useCallback(
    (postId: string) => {
      remove(postId);
    },
    [remove],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Image
          src="/images/sts2/relics/chemical_x.webp"
          alt="케미컬엑스"
          width={32}
          height={32}
          className="object-contain"
        />
        <div>
          <h1 className="text-xl font-bold text-yellow-400 font-spectral">케미컬엑스</h1>
          <p className="text-xs text-gray-500">슬더스 이야기를 짧게, 강렬하게.</p>
        </div>
      </div>

      {/* Editor */}
      {ready && (
        <ChemicalXEditor entities={entities} onSubmit={handleSubmit} />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {loading ? "불러오는 중..." : `${posts.length}개의 투입`}
        </span>
        <button
          type="button"
          onClick={() => setShowAllTooltips((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
          title={showAllTooltips ? "툴팁 숨기기" : "전체 툴팁 표시"}
        >
          {showAllTooltips ? <EyeOff size={14} /> : <Eye size={14} />}
          {showAllTooltips ? "툴팁 숨기기" : "전체 툴팁"}
        </button>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            entityMap={entityMap}
            forceShowTooltips={showAllTooltips}
            isOwner={post.user_id === userId}
            onDelete={handleDelete}
          />
        ))}

        {!loading && posts.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            아직 아무도 투입하지 않았어요. 첫 번째가 되어보세요!
          </div>
        )}
      </div>
    </div>
  );
}
