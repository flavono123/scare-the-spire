"use client";

/**
 * 2D effects drawn into an offscreen canvas and shown as an <img>. A <canvas>
 * in the page is always a composited layer, and every card painted over it
 * gets its own layer whose raster scale Chrome fixes after a few scale
 * changes, so the same time could give different pixels depending on the
 * frames before. An <img> is painted like any other element; window.__sim.seek
 * waits for these images to decode before a frame is captured.
 */

import { useLayoutEffect, useRef, type CSSProperties } from "react";

export const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SOFTWARE_2D: CanvasRenderingContext2DSettings = { willReadFrequently: true };

interface CanvasImageProps {
  /** Backing size in pixels. */
  width: number;
  height: number;
  /** Draw on a cleared context; return false when nothing was drawn. */
  draw: (context: CanvasRenderingContext2D) => boolean;
  className?: string;
  style?: CSSProperties;
  dataAttribute?: string;
}

export function CanvasImage({ width, height, draw, className, style, dataAttribute }: CanvasImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Redraw synchronously on every render so a seek's frame is in the image before paint.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    const pixelWidth = Math.max(1, Math.round(width));
    const pixelHeight = Math.max(1, Math.round(height));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext("2d", SOFTWARE_2D);
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const source = draw(context) ? canvas.toDataURL() : BLANK_IMAGE;
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
  });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={BLANK_IMAGE}
      alt=""
      draggable={false}
      className={className}
      style={style}
      {...(dataAttribute ? { [dataAttribute]: "" } : {})}
    />
  );
}
