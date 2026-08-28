"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { hexToRgb01 } from "@/lib/dev-character-palettes";

export function DuotoneSvgFilter({
  id,
  shadowHex,
  highlightHex,
}: {
  id: string;
  shadowHex: string;
  highlightHex: string;
}) {
  const shadow = hexToRgb01(shadowHex);
  const highlight = hexToRgb01(highlightHex);

  return (
    <svg
      aria-hidden
      focusable="false"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`${shadow.r} ${highlight.r}`} />
          <feFuncG type="table" tableValues={`${shadow.g} ${highlight.g}`} />
          <feFuncB type="table" tableValues={`${shadow.b} ${highlight.b}`} />
          <feFuncA type="identity" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

export function useDuotoneFilterStyle(filterId: string): CSSProperties {
  const [url, setUrl] = useState(`#${filterId}`);

  useEffect(() => {
    setUrl(`${window.location.pathname}${window.location.search}#${filterId}`);
  }, [filterId]);

  return { filter: `url("${url}")` };
}
