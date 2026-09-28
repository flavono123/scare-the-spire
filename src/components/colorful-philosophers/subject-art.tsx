"use client";

import Image from "@/components/ui/static-image";
import { CardTile } from "@/components/codex/card-tile";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import {
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  colorfulPhilosopherSubjectHref,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import type { ServiceLocale } from "@/lib/i18n";

const SUBJECT_LINK_CLASS =
  "block shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70";

/** Subject art that opens the Compendium detail page and shows the game hover tip. */
export function ColorfulPhilosopherSubjectArt({
  post,
  serviceLocale,
  width = 112,
  imageWidth = width,
  entity: providedEntity,
  staticHoverPreviews = false,
}: {
  post: ColorfulPhilosopherPost;
  serviceLocale: ServiceLocale;
  width?: number;
  imageWidth?: number;
  /** Skips the client entity fetch when the caller already has the resource. */
  entity?: EntityInfo;
  staticHoverPreviews?: boolean;
}) {
  const { entities } = useCommentEntities(undefined, { enabled: !providedEntity });
  const entity = providedEntity
    ?? entities.find((candidate) => candidate.type === post.resourceType && candidate.id === post.resourceId);
  const card = post.resourceType === "card" ? entity?.cardData : undefined;
  const art = card ? (
    <span style={{ width }} className="block shrink-0">
      <CardTile card={card} serviceLocale={serviceLocale} width={width} showUpgrade={false} showBeta={false} />
    </span>
  ) : (
    <Image
      src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC}
      alt={post.nameKo}
      width={imageWidth}
      height={imageWidth}
      className="object-contain"
    />
  );

  const href = colorfulPhilosopherSubjectHref(post, serviceLocale);
  if (!href) return art;

  const previewEntity: EntityInfo = {
    ...(entity ?? {
      id: post.resourceId,
      nameKo: post.nameKo,
      nameEn: post.nameEn,
      imageUrl: post.imageUrl,
      color: post.resourceType,
      type: post.resourceType as EntityInfo["type"],
    }),
    href,
  };

  return (
    <EntityPreview
      entity={previewEntity}
      serviceLocale={serviceLocale}
      linkClassName={SUBJECT_LINK_CLASS}
      staticHoverPreviews={staticHoverPreviews}
    >
      {art}
    </EntityPreview>
  );
}
