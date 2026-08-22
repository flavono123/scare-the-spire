"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

const ASSETS = {
  large: {
    trackCenter: "/images/sts2/ui/scrollbar/track_center.png",
    trackEdge: "/images/sts2/ui/scrollbar/track_edge.png",
    train: "/images/sts2/ui/scrollbar/train.png",
    railWidth: 28,
    edgeHeight: 18,
    trainWidth: 36,
    trainHeight: 55,
  },
  small: {
    trackCenter: "/images/sts2/ui/scrollbar/small_track_center.png",
    trackEdge: "/images/sts2/ui/scrollbar/small_track_edge.png",
    // Small train in the atlas is a white silhouette; use the gold large train scaled down.
    train: "/images/sts2/ui/scrollbar/train.png",
    railWidth: 18,
    edgeHeight: 12,
    trainWidth: 22,
    trainHeight: 34,
  },
} as const;

export type GameScrollAreaSize = keyof typeof ASSETS;

/** Pure mapping used by the self-check — keep in sync with thumb placement. */
export function gameScrollThumbTopPx(input: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  trackHeight: number;
  trainHeight: number;
}): number {
  const maxScroll = input.scrollHeight - input.clientHeight;
  if (maxScroll <= 0 || input.trackHeight <= input.trainHeight) return 0;
  const travel = input.trackHeight - input.trainHeight;
  const ratio = Math.min(1, Math.max(0, input.scrollTop / maxScroll));
  return ratio * travel;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

export function GameScrollArea({
  children,
  className,
  scrollerClassName,
  scrollerRef,
  scrollerStyle,
  size = "large",
  "aria-label": ariaLabel,
  dataTestId,
}: {
  children: ReactNode;
  className?: string;
  scrollerClassName?: string;
  scrollerRef?: Ref<HTMLDivElement>;
  scrollerStyle?: CSSProperties;
  size?: GameScrollAreaSize;
  "aria-label"?: string;
  dataTestId?: string;
}) {
  const assets = ASSETS[size];
  const scrollerNodeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
  } | null>(null);
  const [metrics, setMetrics] = useState({
    overflow: false,
    thumbTop: 0,
    trackHeight: 0,
  });

  useEffect(() => {
    const scroller = scrollerNodeRef.current;
    const track = trackRef.current;
    if (!scroller) return;

    const update = () => {
      const trackHeight = track?.clientHeight ?? scroller.clientHeight;
      const overflow = scroller.scrollHeight - scroller.clientHeight > 4;
      setMetrics({
        overflow,
        trackHeight,
        thumbTop: gameScrollThumbTopPx({
          scrollTop: scroller.scrollTop,
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          trackHeight,
          trainHeight: assets.trainHeight,
        }),
      });
    };

    update();
    const raf = window.requestAnimationFrame(update);
    scroller.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(scroller);
    if (track) resizeObserver.observe(track);
    const mutationObserver = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(update);
    mutationObserver?.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [assets.trainHeight]);

  const scrollFromThumbTop = (thumbTop: number) => {
    const scroller = scrollerNodeRef.current;
    if (!scroller) return;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const travel = Math.max(0, metrics.trackHeight - assets.trainHeight);
    if (maxScroll <= 0 || travel <= 0) return;
    const ratio = Math.min(1, Math.max(0, thumbTop / travel));
    scroller.scrollTop = ratio * maxScroll;
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const track = trackRef.current;
    const scroller = scrollerNodeRef.current;
    if (!track || !scroller || !metrics.overflow) return;

    const rect = track.getBoundingClientRect();
    const y = event.clientY - rect.top - assets.trainHeight / 2;
    scrollFromThumbTop(y);
  };

  const onTrainPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const scroller = scrollerNodeRef.current;
    if (!scroller) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scroller.scrollTop,
    };
  };

  const onTrainPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const scroller = scrollerNodeRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !scroller) return;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const travel = Math.max(0, metrics.trackHeight - assets.trainHeight);
    if (maxScroll <= 0 || travel <= 0) return;
    const delta = event.clientY - drag.startY;
    scroller.scrollTop = Math.min(
      maxScroll,
      Math.max(0, drag.startScrollTop + (delta / travel) * maxScroll),
    );
  };

  const onTrainPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const railStyle = {
    "--game-scroll-rail-width": `${assets.railWidth}px`,
    "--game-scroll-edge-height": `${assets.edgeHeight}px`,
    "--game-scroll-train-width": `${assets.trainWidth}px`,
    "--game-scroll-train-height": `${assets.trainHeight}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative flex min-h-0",
        metrics.overflow && "pr-[calc(var(--game-scroll-rail-width)+0.35rem)]",
        className,
      )}
      style={railStyle}
    >
      <div
        ref={(node) => {
          scrollerNodeRef.current = node;
          assignRef(scrollerRef, node);
        }}
        data-testid={dataTestId}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          scrollerClassName,
        )}
        style={scrollerStyle}
      >
        {children}
      </div>

      <div
          ref={trackRef}
          role="scrollbar"
          aria-label={ariaLabel}
          aria-orientation="vertical"
          aria-hidden={!metrics.overflow}
          className={cn(
            "absolute bottom-1 right-0 top-1 w-[var(--game-scroll-rail-width)] select-none",
            !metrics.overflow && "pointer-events-none opacity-0",
          )}
          onPointerDown={onTrackPointerDown}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[var(--game-scroll-edge-height)]"
          >
            <Image
              src={assets.trackEdge}
              alt=""
              width={assets.railWidth}
              height={assets.edgeHeight}
              className="h-full w-full object-fill"
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-[var(--game-scroll-edge-height)] top-[var(--game-scroll-edge-height)]"
            style={{
              backgroundImage: `url(${assets.trackCenter})`,
              backgroundRepeat: "repeat-y",
              backgroundSize: "100% auto",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--game-scroll-edge-height)]"
          >
            <Image
              src={assets.trackEdge}
              alt=""
              width={assets.railWidth}
              height={assets.edgeHeight}
              className="h-full w-full scale-y-[-1] object-fill"
            />
          </div>

          <button
            type="button"
            aria-label={ariaLabel}
            tabIndex={metrics.overflow ? 0 : -1}
            disabled={!metrics.overflow}
            className="absolute left-1/2 z-10 w-[var(--game-scroll-train-width)] -translate-x-1/2 cursor-grab touch-none active:cursor-grabbing disabled:pointer-events-none"
            style={{
              top: metrics.thumbTop,
              height: assets.trainHeight,
            }}
            onPointerDown={onTrainPointerDown}
            onPointerMove={onTrainPointerMove}
            onPointerUp={onTrainPointerUp}
            onPointerCancel={onTrainPointerUp}
          >
            <Image
              src={assets.train}
              alt=""
              width={assets.trainWidth}
              height={assets.trainHeight}
              className="h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]"
            />
          </button>
      </div>
    </div>
  );
}
