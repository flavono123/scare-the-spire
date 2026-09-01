"use client";

import { useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  GripHorizontal,
  GripVertical,
  Link2,
  Link2Off,
} from "lucide-react";
import { CardTile } from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import Image from "@/components/ui/static-image";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { CodexCard } from "@/lib/codex-types";
import { youtubeEmbedUrl } from "@/lib/youtube-reference";
import { serviceMessages } from "@/messages/service";
import {
  clampAssetWidth,
  clampPlayerWidth,
  defaultAssetWidth,
  defaultPlayerWidth,
  type CardPresentation,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";

const ALIGN_CLASS: Record<MockAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function alignRowClass(align: MockAlign): string {
  return `my-3 flex w-full ${ALIGN_CLASS[align]}`;
}

export function mockButtonClass(active?: boolean): string {
  return `inline-flex items-center justify-center rounded px-2 py-1 text-xs ${
    active
      ? "bg-primary/20 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
}

export function IconTipButton({
  label,
  active,
  className,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      <button
        type="button"
        data-asset-chrome
        aria-label={label}
        className={className ?? mockButtonClass(active)}
        onClick={onClick}
      >
        {children}
      </button>
    </GameUiHoverTip>
  );
}

type ResizeEdge = "n" | "s" | "e" | "w";

function EdgeHandle({
  edge,
  width,
  height,
  clampWidth,
  clampHeight,
  lockAspect,
  onResize,
}: {
  edge: ResizeEdge;
  width: number;
  height: number;
  clampWidth: (width: number) => number;
  clampHeight: (height: number) => number;
  lockAspect?: boolean;
  onResize: (size: { width: number; height: number }) => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestormEditor;
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const label =
    edge === "n" ? copy.resizeN
    : edge === "s" ? copy.resizeS
    : edge === "e" ? copy.resizeE
    : copy.resizeW;
  const vertical = edge === "n" || edge === "s";
  const position =
    edge === "n" ? "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"
    : edge === "s" ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"
    : edge === "e" ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize"
    : "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize";

  return (
    <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      <button
        type="button"
        data-asset-chrome
        aria-label={label}
        className={`absolute z-10 flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-background text-primary ${position}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          origin.current = { x: event.clientX, y: event.clientY, width, height };
          const move = (next: MouseEvent) => {
            const dx = next.clientX - origin.current.x;
            const dy = next.clientY - origin.current.y;
            const signedX = edge === "w" ? -dx : dx;
            const signedY = edge === "n" ? -dy : dy;
            if (lockAspect) {
              const delta = vertical ? signedY : signedX;
              const nextWidth = clampWidth(origin.current.width + delta);
              const ratio = origin.current.height / origin.current.width;
              onResize({
                width: nextWidth,
                height: clampHeight(nextWidth * ratio),
              });
              return;
            }
            onResize({
              width: vertical ? origin.current.width : clampWidth(origin.current.width + signedX),
              height: vertical ? clampHeight(origin.current.height + signedY) : origin.current.height,
            });
          };
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      >
        {vertical
          ? <GripHorizontal className="h-3 w-3" aria-hidden />
          : <GripVertical className="h-3 w-3" aria-hidden />}
      </button>
    </GameUiHoverTip>
  );
}

export function FourEdgeHandles({
  width,
  height,
  clampWidth,
  clampHeight,
  lockAspect,
  onResize,
}: {
  width: number;
  height: number;
  clampWidth: (width: number) => number;
  clampHeight: (height: number) => number;
  lockAspect?: boolean;
  onResize: (size: { width: number; height: number }) => void;
}) {
  return (
    <>
      {(["n", "s", "e", "w"] as const).map((edge) => (
        <EdgeHandle
          key={edge}
          edge={edge}
          width={width}
          height={height}
          clampWidth={clampWidth}
          clampHeight={clampHeight}
          lockAspect={lockAspect}
          onResize={onResize}
        />
      ))}
    </>
  );
}

export function AlignButtons({
  value,
  onChange,
}: {
  value?: MockAlign;
  onChange: (align: MockAlign) => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestormEditor;
  const items = [
    { align: "left" as const, label: copy.alignLeft, Icon: AlignLeft },
    { align: "center" as const, label: copy.alignCenter, Icon: AlignCenter },
    { align: "right" as const, label: copy.alignRight, Icon: AlignRight },
  ];
  return (
    <>
      {items.map(({ align, label, Icon }) => (
        <IconTipButton
          key={align}
          label={label}
          active={value === align}
          onClick={() => onChange(align)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </IconTipButton>
      ))}
    </>
  );
}

export function PublishLinkButton({
  linked,
  onLinked,
}: {
  linked: boolean;
  onLinked: (linked: boolean) => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestormEditor;
  const label = linked ? copy.publishLink : copy.publishUnlink;
  return (
    <IconTipButton
      label={label}
      active={linked}
      className="absolute right-0 top-0 z-10 rounded-md border border-border bg-background/90 p-1 text-muted-foreground hover:text-foreground"
      onClick={() => onLinked(!linked)}
    >
      {linked
        ? <Link2 className="h-3.5 w-3.5" aria-hidden />
        : <Link2Off className="h-3.5 w-3.5" aria-hidden />}
    </IconTipButton>
  );
}

export function CardPresentationPicker({
  value,
  beta,
  onChange,
  onBeta,
}: {
  value: CardPresentation;
  beta: boolean;
  onChange: (value: CardPresentation) => void;
  onBeta: (beta: boolean) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestormEditor;
  const betaLabel = serviceMessages[serviceLocale].codex.cardsView.toggles.betaArt;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1" data-asset-chrome>
      {([
        ["art", copy.presentationArt],
        ["tile", copy.presentationTile],
        ["tiny", copy.presentationTiny],
      ] as const).map(([id, label]) => (
        <GameUiHoverTip key={id} label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
          <button
            type="button"
            className={mockButtonClass(value === id)}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        </GameUiHoverTip>
      ))}
      {value !== "tiny" ? (
        <GameCheckboxToggle
          checked={beta}
          onCheckedChange={onBeta}
          label={betaLabel}
          size="sm"
        />
      ) : null}
    </div>
  );
}

export function EditBlockChrome({
  align,
  onAlign,
  presentation,
  beta,
  onPresentation,
  onBeta,
}: {
  align: MockAlign;
  onAlign: (align: MockAlign) => void;
  presentation?: CardPresentation;
  beta?: boolean;
  onPresentation?: (value: CardPresentation) => void;
  onBeta?: (beta: boolean) => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 pb-2"
      data-asset-chrome
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        <AlignButtons value={align} onChange={onAlign} />
      </div>
      {onPresentation && presentation && onBeta && beta != null ? (
        <CardPresentationPicker
          value={presentation}
          beta={beta}
          onChange={onPresentation}
          onBeta={onBeta}
        />
      ) : null}
    </div>
  );
}

function AssetBody({
  asset,
  presentation,
  beta,
  card,
  width,
}: {
  asset: MockGameAsset;
  presentation: CardPresentation;
  beta: boolean;
  card?: CodexCard | null;
  width: number;
}) {
  if (presentation === "tiny" && card) {
    return (
      <TinyCardIcon
        card={{
          color: card.color,
          visualColor: card.visualColor,
          rarity: card.rarity,
          type: card.type,
        }}
        width={Math.max(32, Math.round(width * 0.35))}
      />
    );
  }
  if (presentation === "tile" && card) {
    return (
      <CardTile
        card={card}
        showUpgrade={false}
        showBeta={beta}
        width={width}
        interactive={false}
      />
    );
  }
  const src = beta && card?.betaImageUrl ? card.betaImageUrl : asset.imageUrl;
  const portrait = asset.kind === "card";
  return (
    <>
      <Image
        src={src}
        alt={asset.name}
        width={width}
        height={portrait ? Math.round(width * 1.56) : width}
        className="pointer-events-none h-auto w-full select-none"
        draggable={false}
      />
      <figcaption className="mt-1 text-center font-game-title text-xs spire-gold">
        {asset.name}
      </figcaption>
    </>
  );
}

export function GameAssetFigure({
  asset,
  align,
  mode = "edit",
  linked = true,
  width,
  height,
  presentation = "art",
  beta = false,
  card,
  onResize,
  onLinked,
}: {
  asset: MockGameAsset;
  align: MockAlign;
  mode?: "edit" | "preview";
  linked?: boolean;
  width?: number;
  height?: number;
  presentation?: CardPresentation;
  beta?: boolean;
  card?: CodexCard | null;
  onResize?: (size: { width: number; height: number }) => void;
  onLinked?: (linked: boolean) => void;
}) {
  const px = width ?? defaultAssetWidth(asset.kind);
  const py = height ?? (asset.kind === "card" ? Math.round(px * 1.56) : px);
  const figure = (
    <figure className="relative" style={{ width: px }}>
      {mode === "edit" && onLinked ? (
        <PublishLinkButton linked={linked} onLinked={onLinked} />
      ) : null}
      <AssetBody
        asset={asset}
        presentation={presentation}
        beta={beta}
        card={card}
        width={px}
      />
      {mode === "edit" && onResize ? (
        <FourEdgeHandles
          width={px}
          height={py}
          clampWidth={(next) => clampAssetWidth(asset.kind, next)}
          clampHeight={(next) => clampAssetWidth(asset.kind, next)}
          lockAspect
          onResize={onResize}
        />
      ) : null}
    </figure>
  );

  if (mode === "preview" && linked) {
    return (
      <div className={alignRowClass(align)}>
        <a href={asset.href} className="block no-underline" target="_blank" rel="noreferrer">
          {figure}
        </a>
      </div>
    );
  }

  return <div className={alignRowClass(align)}>{figure}</div>;
}

export function YoutubePlayerFigure({
  videoId,
  title,
  align,
  mode = "edit",
  width,
  height,
  onResize,
}: {
  videoId: string;
  title: string;
  align: MockAlign;
  mode?: "edit" | "preview";
  width?: number;
  height?: number;
  onResize?: (size: { width: number; height: number }) => void;
}) {
  const px = width ?? defaultPlayerWidth();
  const py = height ?? Math.round(px * 9 / 16);
  return (
    <div className={alignRowClass(align)}>
      <div
        className="relative overflow-hidden rounded-md border border-border bg-black"
        style={{ width: px, maxWidth: "100%" }}
      >
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={`aspect-video h-auto w-full ${mode === "edit" ? "pointer-events-none" : ""}`}
          tabIndex={mode === "edit" ? -1 : undefined}
        />
        {mode === "edit" ? (
          <div className="absolute inset-0 cursor-default bg-transparent" aria-hidden />
        ) : null}
        {mode === "edit" && onResize ? (
          <FourEdgeHandles
            width={px}
            height={py}
            clampWidth={clampPlayerWidth}
            clampHeight={(next) => clampPlayerWidth(Math.round(next * 16 / 9))}
            lockAspect
            onResize={onResize}
          />
        ) : null}
      </div>
    </div>
  );
}

export function OgBookmarkFigure({
  bookmark,
  align,
  mode = "edit",
  linked = true,
  width,
  height,
  onResize,
  onLinked,
}: {
  bookmark: MockOgBookmark;
  align: MockAlign;
  mode?: "edit" | "preview";
  linked?: boolean;
  width?: number;
  height?: number;
  onResize?: (size: { width: number; height: number }) => void;
  onLinked?: (linked: boolean) => void;
}) {
  const px = width ?? defaultPlayerWidth();
  const py = height ?? 96;
  const card = (
    <span
      className="relative flex overflow-hidden rounded-md border border-border bg-card/40"
      style={{ width: px, maxWidth: "100%", minHeight: py }}
    >
      {mode === "edit" && onLinked ? (
        <PublishLinkButton linked={linked} onLinked={onLinked} />
      ) : null}
      {bookmark.image ? (
        <Image
          src={bookmark.image}
          alt=""
          width={144}
          height={96}
          className="pointer-events-none h-24 w-36 shrink-0 object-cover"
        />
      ) : null}
      <span className="min-w-0 flex-1 p-3">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
          {bookmark.siteName}
        </span>
        <span className="mt-0.5 block font-game-title text-sm text-foreground">
          {bookmark.title}
        </span>
        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
          {bookmark.description}
        </span>
      </span>
      {mode === "edit" && onResize ? (
        <FourEdgeHandles
          width={px}
          height={py}
          clampWidth={clampPlayerWidth}
          clampHeight={(next) => Math.min(240, Math.max(72, Math.round(next)))}
          onResize={onResize}
        />
      ) : null}
    </span>
  );

  if (mode === "preview" && linked) {
    return (
      <div className={alignRowClass(align)}>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="block no-underline hover:border-primary/50"
        >
          {card}
        </a>
      </div>
    );
  }

  return <div className={alignRowClass(align)}>{card}</div>;
}
