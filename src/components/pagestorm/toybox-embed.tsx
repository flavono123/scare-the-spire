"use client";

import { CardTile } from "@/components/codex/card-tile";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import Image from "@/components/ui/static-image";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import {
  isDecisionsDecisionsResourceType,
  resourceKey,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import {
  pagestormToyboxFederatedFromHref,
  pagestormToyboxPostHref,
  pagestormToyboxServiceHref,
} from "@/lib/pagestorm-toybox";
import { findPagestormEntity, usePagestormEntities } from "./entities-context";
import { AssetCornerHandles, AssetFocusChrome, alignRowClass } from "./figures";
import {
  clampPlayerWidth,
  defaultPlayerWidth,
  type MockAlign,
} from "./sample";
import { findToyboxPost } from "./toybox-samples";

const CARD_TILE_WIDTH = 140;
const ICON_SIZE = 96;

function resourceImageSrc(
  entity: NonNullable<ReturnType<typeof findPagestormEntity>>,
): string | null {
  if (entity.type === "character") {
    return entity.characterData?.iconUrl || entity.imageUrl;
  }
  if (entity.type === "monster") {
    return entity.monsterData?.imageUrl
      || entity.monsterData?.bossImageUrl
      || entity.imageUrl;
  }
  if (entity.type === "keyword") {
    return entity.imageUrl || COMBO_KEYWORD_IMAGE_URL;
  }
  return entity.imageUrl;
}

function ToyboxResourceVisual({
  type,
  id,
}: {
  type: string;
  id: string;
}) {
  const serviceLocale = useServiceLocale();
  const entities = usePagestormEntities();
  const entity = findPagestormEntity(entities, type, id);
  if (!entity) {
    return (
      <span className="px-2 text-center text-xs text-muted-foreground">{id}</span>
    );
  }
  if (entity.cardData) {
    return (
      <CardTile
        card={entity.cardData}
        serviceLocale={serviceLocale}
        showUpgrade={false}
        showBeta={false}
        width={CARD_TILE_WIDTH}
        interactive={false}
      />
    );
  }
  const src = resourceImageSrc(entity);
  if (!src) {
    return (
      <span className="px-2 text-center text-xs text-muted-foreground">{entity.nameKo}</span>
    );
  }
  const landscape = entity.type === "event" || entity.type === "epoch";
  return (
    <Image
      src={src}
      alt={entity.nameKo}
      width={landscape ? 220 : ICON_SIZE}
      height={landscape ? 120 : ICON_SIZE}
      className={
        landscape
          ? "max-h-28 max-w-[13rem] object-contain"
          : "h-24 w-24 object-contain"
      }
    />
  );
}

function ThisOrThatPreview({
  leftType,
  leftId,
  rightType,
  rightId,
}: {
  leftType: string;
  leftId: string;
  rightType: string;
  rightId: string;
}) {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-4">
      <ToyboxResourceVisual type={leftType} id={leftId} />
      <span className="shrink-0 font-game-title text-xl font-black text-primary/80">
        VS
      </span>
      <ToyboxResourceVisual type={rightType} id={rightId} />
    </div>
  );
}

function DecisionsPreview({
  post,
}: {
  post: {
    rows: TierRow[];
    placements: TierPlacement[];
    pool: DecisionsDecisionsResourceRef[];
  };
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const entities = usePagestormEntities();
  const entitiesByKey = new Map(
    entities.flatMap((entity) => (
      isDecisionsDecisionsResourceType(entity.type)
        ? [[resourceKey({ type: entity.type, id: entity.id }), entity] as const]
        : []
    )),
  );
  return (
    <div className="h-full p-2">
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
}

export function ToyboxEmbedFigure({
  postId,
  service,
  leftType = "",
  leftId = "",
  rightType = "",
  rightId = "",
  rows,
  placements,
  pool,
  align,
  mode = "edit",
  selected = false,
  linked = true,
  width,
  height,
  onResize,
  onLinked,
  onAlign,
}: {
  postId: string;
  service: string;
  title?: string;
  nickname?: string;
  leftType?: string;
  leftId?: string;
  rightType?: string;
  rightId?: string;
  rows?: unknown;
  placements?: unknown;
  pool?: unknown;
  tokenSrc?: string;
  align: MockAlign;
  mode?: "edit" | "preview";
  selected?: boolean;
  linked?: boolean;
  width?: number;
  height?: number;
  onResize?: (size: { width: number; height: number }) => void;
  onLinked?: (linked: boolean) => void;
  onAlign?: (align: MockAlign) => void;
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const mock = findToyboxPost(postId);
  const px = width ?? defaultPlayerWidth();
  const py = height ?? 240;
  const href = pagestormToyboxPostHref(service, postId, serviceLocale, gameLocale);
  const federated = pagestormToyboxFederatedFromHref(service);
  const serviceHref = pagestormToyboxServiceHref(mock?.service || service);
  const tot = serviceHref === "/this-or-that"
    ? mock
      ? {
        leftType: mock.leftType,
        leftId: mock.leftId,
        rightType: mock.rightType,
        rightId: mock.rightId,
      }
      : leftType && leftId && rightType && rightId
        ? { leftType, leftId, rightType, rightId }
        : null
    : null;
  const dd = serviceHref === "/decisions-decisions"
    ? mock
      ? mock
      : Array.isArray(rows) && Array.isArray(placements)
        ? {
          rows: rows as TierRow[],
          placements: placements as TierPlacement[],
          pool: (Array.isArray(pool) ? pool : []) as DecisionsDecisionsResourceRef[],
        }
        : null
    : null;
  const transfigure = serviceHref === "/transfigure" && leftType && leftId
    ? { type: leftType, id: leftId }
    : null;

  const inner = (() => {
    if (tot) {
      return (
        <ThisOrThatPreview
          leftType={tot.leftType}
          leftId={tot.leftId}
          rightType={tot.rightType}
          rightId={tot.rightId}
        />
      );
    }
    if (dd) {
      return <DecisionsPreview post={dd} />;
    }
    if (transfigure) {
      return (
        <div className="flex h-full items-center justify-center p-3">
          <ToyboxResourceVisual type={transfigure.type} id={transfigure.id} />
        </div>
      );
    }
    return null;
  })();

  const card = (
    <div
      className="relative overflow-hidden rounded-md border border-border bg-card/40"
      style={{ width: px, maxWidth: "100%", height: py }}
    >
      {inner}
      {mode === "edit" ? (
        <div className="absolute inset-0 cursor-default bg-transparent" aria-hidden />
      ) : null}
    </div>
  );
  const body = (
    <div className="relative" style={{ width: px, maxWidth: "100%", height: py }}>
      {card}
      {mode === "edit" ? (
        <>
          <AssetCornerHandles
            linked={linked}
            onLinked={onLinked}
            width={px}
            height={py}
            clampWidth={clampPlayerWidth}
            clampHeight={(next) => Math.min(480, Math.max(160, Math.round(next)))}
            onResize={onResize}
          />
          <AssetFocusChrome
            selected={selected}
            align={align}
            onAlign={onAlign}
          />
        </>
      ) : null}
    </div>
  );

  const canLink = mode === "preview" && linked && Boolean(mock || federated);
  if (canLink) {
    const linkHref = mock
      ? pagestormToyboxServiceHref(mock.service)
      : href;
    return (
      <div className={alignRowClass(align)}>
        <a
          href={linkHref}
          className="block min-w-0 max-w-full cursor-pointer no-underline"
          target="_blank"
          rel="noreferrer"
          data-pagestorm-embed="linked"
        >
          {card}
        </a>
      </div>
    );
  }

  if (mode === "preview") {
    return (
      <div className={`${alignRowClass(align)} cursor-default`} data-pagestorm-embed="unlinked">
        <div className="min-w-0 max-w-full">{card}</div>
      </div>
    );
  }

  return <div className={alignRowClass(align)}>{body}</div>;
}
