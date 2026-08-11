"use client";

import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

/** Read-only ownership chip for index cards. Not a delete/edit control. */
export function OwnPostMark({ className }: { className?: string }) {
  const serviceLocale = useServiceLocale();
  const label = serviceMessages[serviceLocale].ownPostLabel;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-[#d4a843]/35 px-1.5 py-px text-[10px] font-semibold leading-none text-[#d4a843]/90",
        className,
      )}
    >
      {label}
    </span>
  );
}
