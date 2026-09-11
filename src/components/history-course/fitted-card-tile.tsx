"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { CardTile } from "@/components/codex/card-tile";
import { CARD_ASPECT } from "@/lib/sts2-card-style";

type FittedCardTileProps = Omit<ComponentProps<typeof CardTile>, "width">;

/** Size a CardTile to its parent's width instead of a fixed game-pixel width. */
export function FittedCardTile(props: FittedCardTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // Layout width, not the transformed bounding rect. `appearFromZero`
      // scales the parent to 0, which would otherwise measure as 0px and
      // keep Pomander upgrades postage-stamp sized.
      const next = Math.round(el.clientWidth);
      if (next > 0 && next !== widthRef.current) {
        widthRef.current = next;
        setWidth(next);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full overflow-visible"
      style={{ aspectRatio: CARD_ASPECT }}
    >
      {width > 0 ? <CardTile {...props} width={width} /> : null}
    </div>
  );
}
