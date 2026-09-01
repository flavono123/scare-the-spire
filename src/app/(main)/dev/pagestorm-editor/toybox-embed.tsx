"use client";

import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import { ThisOrThatVoteChoiceFrame } from "@/components/this-or-that/vote-display";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  isDecisionsDecisionsResourceType,
  resourceKey,
} from "@/lib/decisions-decisions";
import { createMissingThisOrThatEntity } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { findPagestormEntity, usePagestormEntities } from "./entities-context";
import {
  alignRowClass,
  FourEdgeHandles,
  PublishLinkButton,
} from "./figures";
import {
  clampPlayerWidth,
  defaultPlayerWidth,
  type MockAlign,
} from "./sample";
import { findToyboxPost } from "./toybox-samples";

function findByTypeId(
  entities: ReturnType<typeof usePagestormEntities>,
  type: string,
  id: string,
) {
  return findPagestormEntity(entities, type, id);
}

export function ToyboxEmbedFigure({
  postId,
  align,
  mode = "edit",
  linked = true,
  width,
  height,
  onResize,
  onLinked,
}: {
  postId: string;
  align: MockAlign;
  mode?: "edit" | "preview";
  linked?: boolean;
  width?: number;
  height?: number;
  onResize?: (size: { width: number; height: number }) => void;
  onLinked?: (linked: boolean) => void;
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const entities = usePagestormEntities();
  const copy = serviceMessages[serviceLocale];
  const post = findToyboxPost(postId);
  const px = width ?? defaultPlayerWidth();
  const py = height ?? 240;

  const inner = (() => {
    if (!post) {
      return (
        <p className="p-3 text-xs text-muted-foreground">{postId}</p>
      );
    }
    if (post.service === "/this-or-that") {
      const left = findByTypeId(entities, post.leftType, post.leftId)
        ?? createMissingThisOrThatEntity(post.leftType, post.leftId);
      const right = findByTypeId(entities, post.rightType, post.rightId)
        ?? createMissingThisOrThatEntity(post.rightType, post.rightId);
      return (
        <div className="space-y-2 p-3">
          <p className="font-game-title text-sm">{post.title}</p>
          <p className="text-xs text-muted-foreground">{copy.pagestormEditor.toyboxThisOrThat}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <ThisOrThatResourcePanel
                entity={left}
                sideLabel={copy.thisOrThat.leftLabel}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                size="compact"
                assetOnly
                linkAsset={false}
              />
              <ThisOrThatVoteChoiceFrame side="left" label={copy.thisOrThat.leftLabel} />
            </div>
            <div className="space-y-2">
              <ThisOrThatResourcePanel
                entity={right}
                sideLabel={copy.thisOrThat.rightLabel}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                size="compact"
                assetOnly
                linkAsset={false}
              />
              <ThisOrThatVoteChoiceFrame side="right" label={copy.thisOrThat.rightLabel} />
            </div>
          </div>
        </div>
      );
    }

    const entitiesByKey = new Map(
      entities.flatMap((entity) => (
        isDecisionsDecisionsResourceType(entity.type)
          ? [[resourceKey({ type: entity.type, id: entity.id }), entity] as const]
          : []
      )),
    );
    return (
      <div className="space-y-2 p-2">
        <p className="px-1 font-game-title text-sm">{post.title}</p>
        <p className="px-1 text-xs text-muted-foreground">{copy.pagestormEditor.toyboxDecisions}</p>
        <DecisionsDecisionsBoard
          rows={post.rows}
          placements={post.placements}
          pool={post.pool}
          entitiesByKey={entitiesByKey}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          showNames={false}
          selectedKey={null}
          readOnly
          compact
          thumbnail
          disablePreview
        />
      </div>
    );
  })();

  const card = (
    <div
      className="relative overflow-hidden rounded-md border border-border bg-card/40"
      style={{ width: px, maxWidth: "100%", minHeight: py }}
    >
      {mode === "edit" && onLinked ? (
        <PublishLinkButton linked={linked} onLinked={onLinked} />
      ) : null}
      {inner}
      {mode === "edit" ? (
        <div className="absolute inset-0 cursor-default bg-transparent" aria-hidden />
      ) : null}
      {mode === "edit" && onResize ? (
        <FourEdgeHandles
          width={px}
          height={py}
          clampWidth={clampPlayerWidth}
          clampHeight={(next) => Math.min(480, Math.max(160, Math.round(next)))}
          onResize={onResize}
        />
      ) : null}
    </div>
  );

  if (mode === "preview" && linked && post) {
    return (
      <div className={alignRowClass(align)}>
        <a href={post.service} className="block no-underline" target="_blank" rel="noreferrer">
          {card}
        </a>
      </div>
    );
  }

  return <div className={alignRowClass(align)}>{card}</div>;
}
