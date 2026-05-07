"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "@/components/ui/static-image";
import { Eye, EyeOff } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { useAuth } from "@/hooks/use-auth";
import { useChemicalPosts } from "@/hooks/use-chemical-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { ChemicalXEditor } from "./chemicalx-editor";
import { PostCard } from "./post-card";
import { buildEntityMap } from "./post-renderer";

interface ChemicalXClientProps {
  entities: EntityInfo[];
  placeholder: string;
}

export function ChemicalXClient({ entities, placeholder }: ChemicalXClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
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
          alt={copy.title}
          width={32}
          height={32}
          className="object-contain"
        />
        <div>
          <h1 className="text-xl font-bold text-yellow-400 font-spectral">{copy.title}</h1>
          <span className="text-xs text-gray-500">{copy.legacyName}</span>
        </div>
      </div>

      {/* Editor */}
      {ready && (
        <ChemicalXEditor entities={entities} placeholder={placeholder} onSubmit={handleSubmit} />
      )}

      {/* Toolbar */}
      {!loading && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
          <button
            type="button"
            onClick={() => setShowAllTooltips((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
            title={showAllTooltips ? copy.hideTooltips : copy.showAllTooltipsTitle}
          >
            {showAllTooltips ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAllTooltips ? copy.hideTooltips : copy.showAllTooltips}
          </button>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Image
            src="/images/sts2/powers/knockdown_power.webp"
            alt={copy.loading}
            width={48}
            height={48}
            className="object-contain animate-pulse"
          />
          <span className="text-sm text-gray-500">{copy.loading}</span>
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
