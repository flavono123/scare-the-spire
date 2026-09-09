"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { CardTile } from "@/components/codex/card-tile";
import { CARD_ASPECT } from "@/lib/sts2-card-style";

type FittedCardTileProps = Omit<ComponentProps<typeof CardTile>, "width">;

/** Size a CardTile to its parent's width instead of a fixed game-pixel width. */
export function FittedCardTile(props: FittedCardTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden" style={{ aspectRatio: CARD_ASPECT }}>
      {width > 0 ? <CardTile {...props} width={width} /> : null}
    </div>
  );
}
