"use client";

import { useEffect, useRef } from "react";
import {
  composeTokenDuotoneRgba,
  hexToRgb255,
} from "@/lib/duotone-pixels";
import { cn } from "@/lib/utils";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function drawToImageData(
  image: HTMLImageElement,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function DuotoneCharacterToken({
  iconUrl,
  iconOutlineUrl,
  shadowHex,
  highlightHex,
  size = 56,
  className,
}: {
  iconUrl: string;
  iconOutlineUrl: string;
  shadowHex: string;
  highlightHex: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelSize = Math.round(size * dpr);
    canvas.width = pixelSize;
    canvas.height = pixelSize;

    void Promise.all([loadImage(iconUrl), loadImage(iconOutlineUrl)])
      .then(([fillImage, outlineImage]) => {
        if (cancelled || !canvasRef.current) return;
        const fill = drawToImageData(fillImage, pixelSize, pixelSize);
        const outline = drawToImageData(outlineImage, pixelSize, pixelSize);
        const composed = composeTokenDuotoneRgba(
          fill.data,
          outline.data,
          hexToRgb255(shadowHex),
          hexToRgb255(highlightHex),
        );
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, pixelSize, pixelSize);
        ctx.putImageData(new ImageData(composed, pixelSize, pixelSize), 0, 0);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.warn("Failed to compose duotone token:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [highlightHex, iconOutlineUrl, iconUrl, shadowHex, size]);

  return (
    <canvas
      ref={canvasRef}
      data-duotone-token
      className={cn("h-14 w-14", className)}
      style={{ width: size, height: size }}
    />
  );
}
