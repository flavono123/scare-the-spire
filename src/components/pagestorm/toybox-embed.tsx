"use client";

import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { ThisOrThatVoteChoiceFrame } from "@/components/this-or-that/vote-display";
import Image from "@/components/ui/static-image";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
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
import {
  createMissingThisOrThatEntity,
  isThisOrThatResourceType,
  type ThisOrThatResourceType,
} from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { findPagestormEntity, usePagestormEntities } from "./entities-context";
import { AssetCornerHandles, AssetFocusChrome, alignRowClass } from "./figures";
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

function totType(type: string): ThisOrThatResourceType {
  return isThisOrThatResourceType(type) ? type : "card";
}

function TotSide({
  type,
  id,
  side,
  sideLabel,
}: {
  type: string;
  id: string;
  side: "left" | "right";
  sideLabel: string;
}) {
  const entities = usePagestormEntities();
  const entity = findByTypeId(entities, type, id)
    ?? createMissingThisOrThatEntity(totType(type), id);
  const src = entity.imageUrl;
  return (
    <div className="space-y-2">
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-black/25">
        {src ? (
          <Image
            src={src}
            alt=""
            width={112}
            height={112}
            className="max-h-28 max-w-full object-contain"
          />
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">{entity.nameKo}</span>
        )}
      </div>
      <ThisOrThatVoteChoiceFrame side={side} label={sideLabel} />
    </div>
  );
}

function ThisOrThatPreview({
  leftType,
  leftId,
  rightType,
  rightId,
  title,
  label,
}: {
  leftType: string;
  leftId: string;
  rightType: string;
  rightId: string;
  title: string;
  label: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale];
  return (
    <div className="space-y-2 p-3">
      <p className="font-game-title text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <TotSide type={leftType} id={leftId} side="left" sideLabel={copy.thisOrThat.leftLabel} />
        <TotSide type={rightType} id={rightId} side="right" sideLabel={copy.thisOrThat.rightLabel} />
      </div>
    </div>
  );
}

function DecisionsPreview({
  post,
  label,
}: {
  post: {
    title: string;
    rows: TierRow[];
    placements: TierPlacement[];
    pool: DecisionsDecisionsResourceRef[];
  };
  label: string;
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
    <div className="space-y-2 p-2">
      <p className="px-1 font-game-title text-sm">{post.title}</p>
      <p className="px-1 text-xs text-muted-foreground">{label}</p>
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

function GenericPreview({
  title,
  nickname,
  tokenSrc,
}: {
  title: string;
  nickname: string;
  tokenSrc: string;
}) {
  return (
    <div className="flex h-full items-center gap-3 p-3">
      {tokenSrc ? (
        <Image
          src={tokenSrc}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-md bg-black/25" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 font-game-title text-sm">{title || nickname}</p>
        {nickname ? (
          <p className="truncate text-xs text-muted-foreground">{nickname}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ToyboxEmbedFigure({
  postId,
  service,
  title = "",
  nickname = "",
  leftType = "",
  leftId = "",
  rightType = "",
  rightId = "",
  rows,
  placements,
  pool,
  tokenSrc = "",
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
  const copy = serviceMessages[serviceLocale];
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
        title: mock.title,
      }
      : leftType && leftId && rightType && rightId
        ? { leftType, leftId, rightType, rightId, title }
        : null
    : null;
  const dd = serviceHref === "/decisions-decisions"
    ? mock
      ? mock
      : Array.isArray(rows) && Array.isArray(placements)
        ? {
          title,
          rows: rows as TierRow[],
          placements: placements as TierPlacement[],
          pool: (Array.isArray(pool) ? pool : []) as DecisionsDecisionsResourceRef[],
        }
        : null
    : null;

  const inner = (() => {
    if (tot) {
      return (
        <ThisOrThatPreview
          leftType={tot.leftType}
          leftId={tot.leftId}
          rightType={tot.rightType}
          rightId={tot.rightId}
          title={tot.title}
          label={copy.pagestorm.toyboxThisOrThat}
        />
      );
    }
    if (dd) {
      return (
        <DecisionsPreview
          post={dd}
          label={copy.pagestorm.toyboxDecisions}
        />
      );
    }
    return (
      <GenericPreview
        title={mock?.title || title}
        nickname={mock?.body || nickname}
        tokenSrc={tokenSrc}
      />
    );
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
