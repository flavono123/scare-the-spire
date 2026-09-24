"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useComments } from "@/hooks/use-comments";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  addColorfulPhilosophersDays,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersCommentThreadKey,
  colorfulPhilosophersWeekNumber,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { localizeHref } from "@/lib/i18n";
import { buildRichContentIndexes, resolveRichContentBlocks } from "@/lib/rich-content-blocks";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { serviceMessages } from "@/messages/service";
import { ResourceReactionBar } from "@/components/resource-reaction-bar";

function ReplyLines({ postId }: { postId: string }) {
  const { comments } = useComments(colorfulPhilosophersCommentThreadKey(postId), null);
  const { entities } = useCommentEntities();
  const entityMap = buildEntityMap(entities);
  const indexes = buildRichContentIndexes(entities);
  if (comments.length === 0) return null;
  return (
    <ul className="ml-4 space-y-3 border-l border-white/10 pl-3">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm">
          <div className="text-[10px] text-primary">{comment.nickname}</div>
          <div className="mt-1.5 leading-relaxed break-words text-muted-foreground">
            <PostRenderer
              blocks={resolveRichContentBlocks(comment.content, comment.content_blocks, indexes)}
              entityMap={entityMap}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ColorfulPhilosopherResourceThread({
  resourceType,
  resourceId,
}: {
  resourceType: string;
  resourceId: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const [posts, setPosts] = useState<ColorfulPhilosopherPost[]>([]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    supabase.from(COLORFUL_PHILOSOPHERS_POSTS_TABLE)
      .select("id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count")
      .eq("env", supabaseEnv)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .order("week_start", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled) return;
        setPosts((data ?? []).flatMap((row) => {
          const post = colorfulPhilosopherPostFromRow(row);
          return post ? [post] : [];
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId, resourceType]);

  if (posts.length === 0) return null;

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const href = localizeHref(`${COLORFUL_PHILOSOPHERS_HREF}/${post.id}`, serviceLocale);
        const weekEnd = addColorfulPhilosophersDays(post.weekStart, 6);
        return (
          <article key={post.id} className="space-y-1 rounded-lg border border-white/10 px-3 py-2">
            <p className="text-sm text-foreground">{post.body}</p>
            <p className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
              <span>{copy.weekNumber.replace("{week}", String(colorfulPhilosophersWeekNumber(post.weekStart)))}</span>
              <span>{`${post.weekStart.slice(5)} – ${weekEnd.slice(5)}`}</span>
              <span>{`v${post.gameVersion}`}</span>
              <Link href={href} className="text-primary">{copy.title}</Link>
            </p>
            <ResourceReactionBar
              resourceType={post.resourceType}
              resourceId={post.resourceId}
              gameVersion={post.gameVersion}
              variant="readonly"
            />
            <ReplyLines postId={post.id} />
          </article>
        );
      })}
    </div>
  );
}
