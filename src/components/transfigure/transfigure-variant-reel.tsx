"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Matches the Wither patch previewreel cadence. */
export const TRANSFIGURE_VARIANT_REEL_INTERVAL_MS = 3200;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

interface TransfigureVariantReelProps {
  count: number;
  renderSlide: (index: number) => ReactNode;
  slideLabel: (index: number) => string;
  className?: string;
  slideClassName?: string;
  intervalMs?: number;
  showPips?: boolean;
  /** Stretch slides to a fixed-height parent (pagestorm embeds). */
  fill?: boolean;
}

/**
 * Crossfade reel over a post's variants, starting at the representative.
 * Slides mount lazily (active + next) and the timer only runs while the reel
 * is on screen, not hovered/focused, and motion is allowed.
 */
export function TransfigureVariantReel({
  count,
  renderSlide,
  slideLabel,
  className,
  slideClassName,
  intervalMs = TRANSFIGURE_VARIANT_REEL_INTERVAL_MS,
  showPips = true,
  fill = false,
}: TransfigureVariantReelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState<readonly number[]>(
    () => (count > 1 ? [0, 1] : [0]),
  );
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  );
  const safeActive = active < count ? active : 0;

  const goTo = useCallback((index: number) => {
    if (count < 1) return;
    const next = ((index % count) + count) % count;
    activeRef.current = next;
    setActive(next);
    setMounted((current) => {
      const merged = new Set(current);
      merged.add(next);
      merged.add((next + 1) % count);
      return merged.size === current.length ? current : [...merged];
    });
  }, [count]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || count <= 1) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    if (count <= 1 || paused || !visible || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      goTo(activeRef.current + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [count, goTo, intervalMs, paused, reducedMotion, visible]);

  if (count <= 1) {
    return (
      <div className={cn("relative flex w-full justify-center", className, slideClassName)}>
        {renderSlide(0)}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full", fill && "flex h-full flex-col", className)}
      data-transfigure-variant-reel=""
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={cn("relative w-full", fill && "min-h-0 flex-1")}>
        {Array.from({ length: count }, (_, index) => {
          const isActive = index === safeActive;
          if (!isActive && !mounted.includes(index)) return null;
          return (
            <div
              key={index}
              data-transfigure-variant-slide={index}
              aria-hidden={isActive ? undefined : true}
              inert={!isActive}
              className={cn(
                "flex w-full justify-center transition-opacity duration-300 motion-reduce:transition-none",
                isActive
                  ? "relative opacity-100"
                  : "pointer-events-none absolute inset-0 opacity-0",
                fill && "h-full *:w-full",
                slideClassName,
              )}
            >
              {renderSlide(index)}
            </div>
          );
        })}
      </div>
      {showPips && (
        <div
          className={cn(
            "flex items-center justify-center gap-1.5",
            fill ? "h-4 shrink-0" : "mt-2",
          )}
          data-transfigure-variant-pips=""
        >
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={slideLabel(index)}
              aria-current={index === safeActive ? "true" : undefined}
              onClick={() => goTo(index)}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300",
                index === safeActive
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-primary/30 hover:bg-primary/60",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
