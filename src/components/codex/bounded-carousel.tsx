"use client";

import {
  Children,
  type ReactNode,
  type WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "@/components/ui/static-image";

interface BoundedCarouselFrameProps {
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  children: ReactNode;
  className?: string;
}

export function BoundedCarouselFrame({
  canMovePrevious,
  canMoveNext,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  children,
  className = "",
}: BoundedCarouselFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {canMovePrevious && (
        <button
          type="button"
          aria-label={previousLabel}
          onClick={onPrevious}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
        >
          <Image
            src="/images/sts2/ui/settings_tiny_left_arrow.png"
            alt=""
            width={32}
            height={32}
            className="object-contain"
          />
        </button>
      )}

      {canMoveNext && (
        <button
          type="button"
          aria-label={nextLabel}
          onClick={onNext}
          className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
        >
          <Image
            src="/images/sts2/ui/settings_tiny_right_arrow.png"
            alt=""
            width={32}
            height={32}
            className="object-contain"
          />
        </button>
      )}

      <div className="mx-7 sm:mx-10">{children}</div>
    </div>
  );
}

interface ScrollableBoundedCarouselProps {
  previousLabel: string;
  nextLabel: string;
  children: ReactNode;
  dataTestId?: string;
  className?: string;
  scrollerClassName?: string;
}

export function ScrollableBoundedCarousel({
  previousLabel,
  nextLabel,
  children,
  dataTestId,
  className,
  scrollerClassName = "",
}: ScrollableBoundedCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const childCount = Children.count(children);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const update = () => {
      setCanScrollPrevious(element.scrollLeft > 4);
      setCanScrollNext(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      );
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [childCount]);

  const scrollBy = (direction: -1 | 1) => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.7,
      behavior: "smooth",
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) return;

    const atStart = element.scrollLeft <= 1;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

    event.preventDefault();
    element.scrollLeft += delta;
  };

  return (
    <BoundedCarouselFrame
      canMovePrevious={canScrollPrevious}
      canMoveNext={canScrollNext}
      onPrevious={() => scrollBy(-1)}
      onNext={() => scrollBy(1)}
      previousLabel={previousLabel}
      nextLabel={nextLabel}
      className={className}
    >
      <div
        ref={scrollerRef}
        data-testid={dataTestId}
        onWheel={handleWheel}
        className={`flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${scrollerClassName}`}
      >
        {children}
      </div>
    </BoundedCarouselFrame>
  );
}
