"use client";

import Image from "@/components/ui/static-image";
import { CardTile } from "@/components/codex/card-tile";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { COLORFUL_PHILOSOPHERS_TOKEN_SRC, type ColorfulPhilosopherPost } from "@/lib/colorful-philosophers";
import type { ServiceLocale } from "@/lib/i18n";

export function ColorfulPhilosopherSubjectArt({
  post,
  serviceLocale,
  width = 112,
}: {
  post: ColorfulPhilosopherPost;
  serviceLocale: ServiceLocale;
  width?: number;
}) {
  const { entities } = useCommentEntities();
  if (post.slot === "card" || post.resourceType === "card") {
    const card = entities.find((entity) => entity.type === "card" && entity.id === post.resourceId)?.cardData;
    if (card) {
      return (
        <div style={{ width }} className="shrink-0">
          <CardTile card={card} serviceLocale={serviceLocale} width={width} />
        </div>
      );
    }
  }
  return (
    <Image
      src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC}
      alt=""
      width={width}
      height={width}
      className="object-contain"
    />
  );
}
