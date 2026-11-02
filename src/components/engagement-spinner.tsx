"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "@/components/ui/static-image";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

export function EngagementSpinner({ size = 16 }: { size?: number }) {
  return (
    <Image
      src="/images/sts2/icons/star_icon.webp"
      alt=""
      width={size}
      height={size}
      className="animate-[spin_2s_linear_infinite]"
    />
  );
}

export function EngagementUnavailableIcon({ size = 16 }: { size?: number }) {
  const serviceLocale = useServiceLocale();
  const label = serviceMessages[serviceLocale].comments.unavailableTitle;
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  // The tooltip takes up layout even while transparent, and on touch it is
  // always shown, so an icon at a screen edge must not push the page wider.
  const alignTooltip = useCallback(() => {
    const root = rootRef.current;
    const tooltip = tooltipRef.current;
    if (!root || !tooltip) return;
    const { left, width } = root.getBoundingClientRect();
    const center = left + width / 2;
    const halfTooltip = tooltip.offsetWidth / 2;
    if (center + halfTooltip > document.documentElement.clientWidth) root.dataset.tooltipAlign = "end";
    else if (center - halfTooltip < 0) root.dataset.tooltipAlign = "start";
    else delete root.dataset.tooltipAlign;
  }, []);

  useEffect(() => {
    alignTooltip();
    window.addEventListener("resize", alignTooltip);
    return () => window.removeEventListener("resize", alignTooltip);
  }, [alignTooltip]);

  return (
    <span
      ref={rootRef}
      className="engagement-unavailable-icon"
      tabIndex={0}
      aria-label={label}
      onPointerEnter={alignTooltip}
      onFocus={alignTooltip}
    >
      <Image
        src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="engagement-unavailable-icon__image object-contain"
      />
      <span ref={tooltipRef} className="engagement-unavailable-icon__tooltip">
        {label}
      </span>
    </span>
  );
}
