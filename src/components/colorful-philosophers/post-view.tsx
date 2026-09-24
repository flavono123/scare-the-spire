"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { SpireIcon } from "@/components/spire-icon";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import {
  useColorfulPhilosopherPost,
  useColorfulPhilosopherReaction,
} from "@/hooks/use-colorful-philosopher-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  COLORFUL_PHILOSOPHER_REACTION_TOKENS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  colorfulPhilosophersCommentThreadKey,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";

function countFor(post: ColorfulPhilosopherPost, kind: ColorfulPhilosopherReaction): number {
  if (kind === "buff") return post.buffCount;
  if (kind === "nerf") return post.nerfCount;
  return post.reworkCount;
}

export function ColorfulPhilosopherPostView({ postId }: { postId: string }) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const { post, loading, unavailable, reload } = useColorfulPhilosopherPost(postId);
  const { userId, ensureUser } = useAuth();
  const reaction = useColorfulPhilosopherReaction(postId, userId);

  if (!postId) return null;
  if (loading) return <ContentLoadingNotice label={copy.loading} />;
  if (unavailable) return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  if (!post) return <p className="text-sm text-zinc-400">{copy.notFound}</p>;

  const choose = async (kind: ColorfulPhilosopherReaction) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    const result = await reaction.choose(kind);
    if (result.ok) reload();
  };

  return (
    <article className="space-y-6" data-colorful-philosophers-post={post.id}>
      <Link href={COLORFUL_PHILOSOPHERS_HREF} className="inline-flex items-center gap-2 text-sm text-primary">
        <Image src={COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt="" width={20} height={20} className="object-contain" />
        {copy.title}
      </Link>
      <header className="flex items-center gap-4">
        <Image
          src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC}
          alt=""
          width={72}
          height={72}
          className="object-contain"
        />
        <div>
          <p className="font-service text-xs text-zinc-500">{copy.slots[post.slot]}</p>
          <h1 className="font-service text-2xl font-bold text-primary">{post.nameKo}</h1>
          <p className="text-sm text-zinc-400">{`${post.nameEn} · v${post.gameVersion}`}</p>
        </div>
      </header>
      <p className="font-game-text text-base leading-7 text-zinc-100">{post.body}</p>
      <div className="flex flex-wrap gap-2">
        {COLORFUL_PHILOSOPHER_REACTIONS.map((kind) => {
          const token = COLORFUL_PHILOSOPHER_REACTION_TOKENS[kind];
          const active = reaction.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => choose(kind)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${active ? "border-primary/60 bg-primary/15" : "border-white/10"}`}
            >
              <SpireIcon src={token.src} size={18} variant={active ? token.variant : "ghost"} label={copy.reactions[kind]} />
              <span>{copy.reactions[kind]}</span>
              <span className="tabular-nums text-zinc-400">{countFor(post, kind)}</span>
            </button>
          );
        })}
      </div>
      <CommentSection threadKey={colorfulPhilosophersCommentThreadKey(post.id)} />
    </article>
  );
}
