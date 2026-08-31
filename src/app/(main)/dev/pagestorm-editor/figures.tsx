"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { youtubeEmbedUrl } from "@/lib/youtube-reference";
import { AlignButtons, mockButtonClass } from "./insert-bar";
import {
  clampAssetWidth,
  clampPlayerWidth,
  defaultAssetWidth,
  defaultPlayerWidth,
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

function ResizeHandle({
  width,
  clamp,
  onResize,
}: {
  width: number;
  clamp: (width: number) => number;
  onResize: (width: number) => void;
}) {
  const origin = useRef({ x: 0, width: 0 });
  return (
    <button
      type="button"
      data-asset-chrome
      aria-label="크기 조절"
      className="absolute -right-1.5 bottom-8 h-3.5 w-3.5 cursor-ew-resize rounded-sm border border-primary bg-background"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        origin.current = { x: event.clientX, width };
        const move = (next: MouseEvent) => {
          onResize(clamp(origin.current.width + next.clientX - origin.current.x));
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    />
  );
}

export function EditBlockChrome({
  align,
  onAlign,
  linked,
  onLinked,
}: {
  align: MockAlign;
  onAlign: (align: MockAlign) => void;
  linked?: boolean;
  onLinked?: (linked: boolean) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1 pb-2"
      data-asset-chrome
      onMouseDown={(event) => event.stopPropagation()}
    >
      <AlignButtons value={align} onChange={onAlign} />
      {onLinked ? (
        <button
          type="button"
          className={mockButtonClass(linked)}
          onClick={() => onLinked(!linked)}
        >
          {linked ? "발행 시 링크" : "링크 없음"}
        </button>
      ) : null}
    </div>
  );
}

export function GameAssetFigure({
  asset,
  align,
  mode = "edit",
  linked = true,
  width,
  onResize,
}: {
  asset: MockGameAsset;
  align: MockAlign;
  mode?: "edit" | "preview";
  linked?: boolean;
  width?: number;
  onResize?: (width: number) => void;
}) {
  const card = asset.kind === "card";
  const px = width ?? defaultAssetWidth(asset.kind);
  const figure = (
    <figure className="relative" style={{ width: px }}>
      <Image
        src={asset.imageUrl}
        alt={asset.name}
        width={px}
        height={card ? Math.round(px * 1.56) : px}
        className="pointer-events-none h-auto w-full select-none"
        draggable={false}
      />
      <figcaption className="mt-1 text-center font-game-title text-xs spire-gold">
        {asset.name}
      </figcaption>
      {mode === "edit" && onResize ? (
        <ResizeHandle
          width={px}
          clamp={(next) => clampAssetWidth(asset.kind, next)}
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
  onResize,
}: {
  videoId: string;
  title: string;
  align: MockAlign;
  mode?: "edit" | "preview";
  width?: number;
  onResize?: (width: number) => void;
}) {
  const px = width ?? defaultPlayerWidth();
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
          <ResizeHandle
            width={px}
            clamp={clampPlayerWidth}
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
  onResize,
}: {
  bookmark: MockOgBookmark;
  align: MockAlign;
  mode?: "edit" | "preview";
  linked?: boolean;
  width?: number;
  onResize?: (width: number) => void;
}) {
  const px = width ?? defaultPlayerWidth();
  const card = (
    <span
      className="relative flex overflow-hidden rounded-md border border-border bg-card/40"
      style={{ width: px, maxWidth: "100%" }}
    >
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
        <ResizeHandle
          width={px}
          clamp={clampPlayerWidth}
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
