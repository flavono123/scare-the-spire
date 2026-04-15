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
          <h1 className="text-xl font-bold text-yellow-400 font-spectral">케미컬X</h1>
          <span className="text-xs text-gray-500">(구 투입터)</span>
        </div>
      </div>

      {/* Editor */}
      {ready && (
        <ChemicalXEditor entities={entities} onSubmit={handleSubmit} />
      )}

      {/* Toolbar */}
      {!loading && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {posts.length}개의 투입
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
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Image
            src="/images/sts2/powers/slumber_power.webp"
            alt="숙면"
            width={48}
            height={48}
            className="object-contain animate-pulse"
          />
          <span className="text-sm text-gray-500">투입을 불러오는 중...</span>
        </div>
      ) : (
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
        </div>
      )}
    </div>
  );
}
