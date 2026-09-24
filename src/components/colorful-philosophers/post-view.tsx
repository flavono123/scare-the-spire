"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties } from "react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { ColorfulPhilosopherSubjectArt } from "@/components/colorful-philosophers/subject-art";
import { useColorfulPhilosopherPost } from "@/hooks/use-colorful-philosopher-posts";
import { useResourceReactions } from "@/hooks/use-resource-reactions";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  colorfulPhilosophersCommentThreadKey,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

function ReactionWords({
  kind,
  label,
}: {
  kind: ColorfulPhilosopherReaction;
  label: string;
}) {
  if (kind === "buff") {
    return (
      <span className="rich-sine font-semibold text-[#34d399]">
        {Array.from(label).map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="rich-sine-letter"
            style={{ "--rich-sine-index": index } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  }
  if (kind === "nerf") {
    return <span className="rich-jitter font-semibold text-[#f87171]">{label}</span>;
  }
  return <span className="font-semibold text-[#EFC851]">{label}</span>;
}

export function ColorfulPhilosopherPostView({ postId }: { postId: string }) {
  const pathname = usePathname();
  const id = postId || pathname.split("/").filter(Boolean).at(-1) || "";
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const { post, loading, unavailable } = useColorfulPhilosopherPost(id);
  const { userId, ensureUser } = useAuth();
  const resource = useResourceReactions(post?.resourceType ?? "", post?.resourceId ?? "", post?.gameVersion ?? "");

  if (!id) return null;
  if (loading) return <ContentLoadingNotice label={copy.loading} />;
  if (unavailable) return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  if (!post) return <p className="text-sm text-zinc-400">{copy.notFound}</p>;

  const choose = (kind: ColorfulPhilosopherReaction) => {
    void (async () => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await resource.choose(kind, activeUserId);
    })();
  };

  return (
    <article className="space-y-6" data-colorful-philosophers-post={post.id}>
      <Link href={COLORFUL_PHILOSOPHERS_HREF} className="inline-flex items-center gap-2 text-sm text-primary">
        <Image src={COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt="" width={20} height={20} className="object-contain" />
        {copy.title}
      </Link>
      <header className="flex items-center gap-4">
        <ColorfulPhilosopherSubjectArt post={post} serviceLocale={serviceLocale} />
        <div>
          <p className="font-service text-xs text-zinc-500">{copy.slots[post.slot]}</p>
          <h1 className="font-service text-2xl font-bold text-primary">{post.nameKo}</h1>
          <p className="text-sm text-zinc-400">{`${post.nameEn} · v${post.gameVersion}`}</p>
        </div>
      </header>
      <p className="font-game-text text-base leading-7 text-zinc-100">{post.body}</p>
      <div className="flex flex-wrap gap-2">
        {COLORFUL_PHILOSOPHER_REACTIONS.map((kind) => {
          const active = resource.kind === kind;
          const tip = active ? copy.reactionClear[kind] : copy.reactions[kind];
          return (
            <GameUiHoverTip key={kind} label={tip}>
              <button
                type="button"
                onClick={() => choose(kind)}
                aria-pressed={active}
                aria-label={tip}
                className={cn(
                  SPIRE_ACTION_CONTROL_CLASS,
                  "gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  kind === "buff" && (active ? "border-[#34d399] bg-[#34d399]/15" : "border-white/10 hover:border-[#34d399]/70"),
                  kind === "nerf" && (active ? "border-[#f87171] bg-[#f87171]/15" : "border-white/10 hover:border-[#f87171]/70"),
                  kind === "rework" && (active ? "border-[#EFC851] bg-[#EFC851]/15" : "border-white/10 hover:border-[#EFC851]/70"),
                )}
              >
                <ColorfulPhilosopherReactionIcon kind={kind} active={active} lift size={18} />
                <ReactionWords kind={kind} label={copy.reactions[kind]} />
                <span className="tabular-nums text-zinc-400">{resource.counts[kind]}</span>
              </button>
            </GameUiHoverTip>
          );
        })}
      </div>
      <CommentSection threadKey={colorfulPhilosophersCommentThreadKey(post.id)} />
    </article>
  );
}
