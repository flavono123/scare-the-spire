"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { GameLocale } from "@/lib/i18n";
import {
  drawBitmapText,
  loadSts1BitmapPage,
  measureBitmapText,
  sts1BitmapPack,
  sts1BitmapRole,
  type Sts1BitmapRoleName,
} from "@/lib/sts1/bitmap-font";

export function Sts1BitmapText({
  text,
  role,
  gameLocale,
  color,
  className,
}: {
  text: string;
  role: Sts1BitmapRoleName;
  gameLocale: GameLocale;
  color: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pack = sts1BitmapPack(gameLocale, role);
  const roleData = sts1BitmapRole(gameLocale, role);
  const metrics = useMemo(
    () => (roleData ? measureBitmapText(roleData, text) : { width: 1, height: 1, originX: 0, originY: 0 }),
    [roleData, text],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roleData || !text) return;
    canvas.width = Math.ceil(metrics.width);
    canvas.height = Math.ceil(metrics.height);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, canvas.width, canvas.height);
    let cancelled = false;
    void loadSts1BitmapPage(pack.page).then((page) => {
      if (cancelled || canvasRef.current !== canvas) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBitmapText(context, page, roleData, text, color, metrics.originX, metrics.originY);
    });
    return () => {
      cancelled = true;
    };
  }, [color, metrics, pack.page, roleData, text]);

  if (!text || !roleData) return null;
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: `${metrics.width / roleData.size}em`,
        height: `${metrics.height / roleData.size}em`,
        display: "inline-block",
        verticalAlign: "middle",
      }}
      aria-hidden
    />
  );
}
