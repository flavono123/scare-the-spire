"use client";

import { useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Link2,
  Link2Off,
  MoveDiagonal2,
  Play,
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
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube-reference";
import { serviceMessages } from "@/messages/service";
import {
  clampAssetWidth,
  defaultAssetWidth,
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

function DiagonalResizeHandle({
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
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });

  return (
    <GameUiHoverTip label={copy.resize} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      <button
        type="button"
        data-asset-chrome
        aria-label={copy.resize}
        className="flex h-6 w-6 items-center justify-center rounded-sm border border-primary bg-background text-primary"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          origin.current = { x: event.clientX, y: event.clientY, width, height };
          const move = (next: MouseEvent) => {
            const dx = next.clientX - origin.current.x;
            const dy = next.clientY - origin.current.y;
            if (lockAspect) {
              const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
              const nextWidth = clampWidth(origin.current.width + delta);
              const ratio = origin.current.height / Math.max(origin.current.width, 1);
              onResize({
                width: nextWidth,
                height: clampHeight(nextWidth * ratio),
              });
              return;
            }
            onResize({
              width: clampWidth(origin.current.width + dx),
              height: clampHeight(origin.current.height + dy),
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
        <MoveDiagonal2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </GameUiHoverTip>
  );
}

export function AlignButtons({
  value,
  onChange,
}: {
  value?: MockAlign;
  onChange: (align: MockAlign) => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestorm;
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
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  const label = linked ? copy.insertWithLink : copy.insertImageOnly;
  return (
    <IconTipButton
      label={label}
      active={linked}
      className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:text-foreground"
      onClick={() => onLinked(!linked)}
    >
      {linked
        ? <Link2 className="h-3.5 w-3.5" aria-hidden />
        : <Link2Off className="h-3.5 w-3.5" aria-hidden />}
    </IconTipButton>
  );
}

export function AssetSideRail({
  linked,
  onLinked,
  width,
  height,
  clampWidth,
  clampHeight,
  lockAspect,
  onResize,
}: {
  linked?: boolean;
  onLinked?: (linked: boolean) => void;
  width: number;
  height: number;
  clampWidth: (width: number) => number;
  clampHeight: (height: number) => number;
  lockAspect?: boolean;
  onResize?: (size: { width: number; height: number }) => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1 self-start"
      data-asset-chrome
      onMouseDown={(event) => event.stopPropagation()}
    >
      {onLinked != null && linked != null ? (
        <PublishLinkButton linked={linked} onLinked={onLinked} />
      ) : null}
      {onResize ? (
        <DiagonalResizeHandle
          width={width}
          height={height}
          clampWidth={clampWidth}
          clampHeight={clampHeight}
          lockAspect={lockAspect}
          onResize={onResize}
        />
      ) : null}
    </div>
  );
}

export function AssetFocusChrome({
  selected,
  align,
  onAlign,
  linkEditor,
}: {
  selected: boolean;
  align?: MockAlign;
  onAlign?: (align: MockAlign) => void;
  linkEditor?: ReactNode;
}) {
  if (!selected) return null;
  return (
    <div
      className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 flex-col items-center gap-1"
      data-asset-chrome
      onMouseDown={(event) => event.stopPropagation()}
    >
      {onAlign ? (
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-md">
          <AlignButtons value={align} onChange={onAlign} />
        </div>
      ) : null}
      {linkEditor}
    </div>
  );
}

export function LinkPhraseHandle({
  title,
  url,
  onTitle,
  onUrl,
}: {
  title: string;
  url: string;
  onTitle: (value: string) => void;
  onUrl: (value: string) => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  return (
    <div
      className="flex min-w-[12rem] max-w-[16rem] flex-col gap-1.5 rounded-md border border-border bg-card px-2 py-2 shadow-md"
      data-asset-chrome
      onMouseDown={(event) => event.stopPropagation()}
    >
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkPhrase}
        <input
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkUrl}
        <input
          value={url}
          onChange={(event) => onUrl(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
    </div>
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
  const copy = serviceMessages[serviceLocale].pagestorm;
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
  selected = false,
  linked = true,
  width,
  height,
  presentation = "art",
  beta = false,
  card,
  onResize,
  onLinked,
  onAlign,
}: {
  asset: MockGameAsset;
  align: MockAlign;
  mode?: "edit" | "preview";
  selected?: boolean;
  linked?: boolean;
  width?: number;
  height?: number;
  presentation?: CardPresentation;
  beta?: boolean;
  card?: CodexCard | null;
  onResize?: (size: { width: number; height: number }) => void;
  onLinked?: (linked: boolean) => void;
  onAlign?: (align: MockAlign) => void;
}) {
  const px = width ?? defaultAssetWidth(asset.kind);
  const py = height ?? (asset.kind === "card" ? Math.round(px * 1.56) : px);
  const figure = (
    <figure className="relative" style={{ width: px }}>
      <AssetBody
        asset={asset}
        presentation={presentation}
        beta={beta}
        card={card}
        width={px}
      />
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

  return (
    <div className={alignRowClass(align)}>
      <div className="flex items-start gap-1">
        <div className="relative">
          {figure}
          {mode === "edit" ? (
            <AssetFocusChrome
              selected={selected}
              align={align}
              onAlign={onAlign}
            />
          ) : null}
        </div>
        {mode === "edit" && (onResize || onLinked) ? (
          <AssetSideRail
            linked={linked}
            onLinked={onLinked}
            width={px}
            height={py}
            clampWidth={(next) => clampAssetWidth(asset.kind, next)}
            clampHeight={(next) => clampAssetWidth(asset.kind, next)}
            lockAspect
            onResize={onResize}
          />
        ) : null}
      </div>
    </div>
  );
}

function YoutubeThumb({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <span
      className="relative block w-24 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 sm:w-32"
      aria-label={title}
    >
      <Image
        src={youtubeThumbnailUrl(videoId)}
        alt=""
        width={160}
        height={90}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video h-auto w-full object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-7 w-9 items-center justify-center rounded-lg bg-red-600/90 text-white shadow-lg">
          <Play aria-hidden className="h-3.5 w-3.5 fill-current" />
        </span>
      </span>
    </span>
  );
}

export function YoutubePlayerFigure({
  videoId,
  title,
  align,
  mode = "edit",
  selected = false,
  onTitle,
  onUrl,
  onAlign,
}: {
  videoId: string;
  title: string;
  align: MockAlign;
  mode?: "edit" | "preview";
  selected?: boolean;
  onTitle?: (title: string) => void;
  onUrl?: (url: string) => void;
  onAlign?: (align: MockAlign) => void;
}) {
  const href = youtubeWatchUrl(videoId);
  const aquaTitle = (
    <span className="sts-text-aqua min-w-0 self-center font-semibold">{title}</span>
  );
  const inner = (
    <div className="flex items-center gap-2">
      <YoutubeThumb videoId={videoId} title={title} />
      {aquaTitle}
    </div>
  );

  if (mode === "preview") {
    return (
      <div className={alignRowClass(align)}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 no-underline"
        >
          <YoutubeThumb videoId={videoId} title={title} />
          {aquaTitle}
        </a>
      </div>
    );
  }

  return (
    <div className={alignRowClass(align)}>
      <div className="relative">
        {inner}
        <AssetFocusChrome
          selected={selected}
          align={align}
          onAlign={onAlign}
          linkEditor={
            selected && onTitle && onUrl ? (
              <LinkPhraseHandle
                title={title}
                url={href}
                onTitle={onTitle}
                onUrl={onUrl}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

export function OgBookmarkFigure({
  bookmark,
  align,
  mode = "edit",
  selected = false,
  onTitle,
  onUrl,
  onAlign,
}: {
  bookmark: MockOgBookmark;
  align: MockAlign;
  mode?: "edit" | "preview";
  selected?: boolean;
  onTitle?: (title: string) => void;
  onUrl?: (url: string) => void;
  onAlign?: (align: MockAlign) => void;
}) {
  const title = bookmark.title.trim() || bookmark.url;
  const aquaTitle = (
    <span className="sts-text-aqua font-semibold">{title}</span>
  );

  if (mode === "preview") {
    return (
      <div className={alignRowClass(align)}>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="no-underline"
        >
          {aquaTitle}
        </a>
      </div>
    );
  }

  return (
    <div className={alignRowClass(align)}>
      <div className="relative">
        {aquaTitle}
        <AssetFocusChrome
          selected={selected}
          align={align}
          onAlign={onAlign}
          linkEditor={
            selected && onTitle && onUrl ? (
              <LinkPhraseHandle
                title={bookmark.title}
                url={bookmark.url}
                onTitle={onTitle}
                onUrl={onUrl}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
