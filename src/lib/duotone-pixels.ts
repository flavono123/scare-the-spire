import { hexToRgb01 } from "@/lib/dev-character-palettes";

export interface Rgb255 {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb255(hex: string): Rgb255 {
  const rgb = hexToRgb01(hex);
  return {
    r: Math.round(rgb.r * 255),
    g: Math.round(rgb.g * 255),
    b: Math.round(rgb.b * 255),
  };
}

export function luminance01(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function lerpDuotoneChannel(t: number, shadow: number, highlight: number): number {
  return Math.round(shadow + (highlight - shadow) * t);
}

/** Remap RGB in place from Rec.709 luminance; keep alpha. */
export function remapDuotoneRgba(
  data: Uint8ClampedArray,
  shadow: Rgb255,
  highlight: Rgb255,
): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const t = luminance01(data[i], data[i + 1], data[i + 2]);
    data[i] = lerpDuotoneChannel(t, shadow.r, highlight.r);
    data[i + 1] = lerpDuotoneChannel(t, shadow.g, highlight.g);
    data[i + 2] = lerpDuotoneChannel(t, shadow.b, highlight.b);
  }
}
