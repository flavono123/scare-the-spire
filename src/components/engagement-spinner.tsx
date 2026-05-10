"use client";

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

  return (
    <span
      className="engagement-unavailable-icon"
      tabIndex={0}
      aria-label={label}
    >
      <Image
        src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="engagement-unavailable-icon__image object-contain"
      />
      <span className="engagement-unavailable-icon__tooltip">
        {label}
      </span>
    </span>
  );
}
