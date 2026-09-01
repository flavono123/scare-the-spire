"use client";

import { useEffect, useRef } from "react";
import { hexToRgb255, remapDuotoneRgba } from "@/lib/duotone-pixels";
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

export function DuotoneCharacterToken({
  iconUrl,
  shadowHex,
  highlightHex,
  size = 56,
  className,
}: {
  iconUrl: string;
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

    void loadImage(iconUrl)
      .then((fillImage) => {
        if (cancelled || !canvasRef.current) return;
        const srcWidth = fillImage.naturalWidth || fillImage.width;
        const srcHeight = fillImage.naturalHeight || fillImage.height;
        const source = document.createElement("canvas");
        source.width = srcWidth;
        source.height = srcHeight;
        const sourceCtx = source.getContext("2d", { willReadFrequently: true });
        if (!sourceCtx) return;
        sourceCtx.drawImage(fillImage, 0, 0);
        const fill = sourceCtx.getImageData(0, 0, srcWidth, srcHeight);
        remapDuotoneRgba(fill.data, hexToRgb255(shadowHex), hexToRgb255(highlightHex));
        sourceCtx.putImageData(fill, 0, 0);

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, pixelSize, pixelSize);
        if (srcWidth < 1 || srcHeight < 1) return;
        const scale = Math.min(pixelSize / srcWidth, pixelSize / srcHeight);
        const drawWidth = Math.max(1, srcWidth * scale);
        const drawHeight = Math.max(1, srcHeight * scale);
        ctx.drawImage(
          source,
          (pixelSize - drawWidth) / 2,
          (pixelSize - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) console.warn("Failed to compose duotone token:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [highlightHex, iconUrl, shadowHex, size]);

  return (
    <canvas
      ref={canvasRef}
      data-duotone-token
      className={cn("h-14 w-14", className)}
    />
  );
}
