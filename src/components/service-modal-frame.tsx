"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

export function ServiceModalFrame({
  title,
  titleId,
  closeLabel,
  onClose,
  closeOnBackdrop = true,
  showAccentDot = false,
  headerTrailing,
  children,
  overlayClassName,
  panelClassName,
  titleClassName,
  bodyClassName,
  dialogRef,
  panelDataAttribute,
}: {
  title: ReactNode;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  showAccentDot?: boolean;
  headerTrailing?: ReactNode;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  dialogRef?: Ref<HTMLDivElement>;
  panelDataAttribute?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-3 sm:py-6",
        overlayClassName,
      )}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={(node) => {
          panelRef.current = node;
          assignRef(dialogRef, node);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        {...(panelDataAttribute ? { [panelDataAttribute]: "" } : {})}
        className={cn(
          "flex w-full flex-col rounded-t-2xl border border-b-0 border-yellow-500/20 bg-[#08080f] shadow-[0_-18px_60px_rgba(0,0,0,0.6)] outline-none sm:rounded-xl sm:border-b sm:shadow-2xl",
          panelClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            {showAccentDot ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[#d4a843] shadow-[0_0_8px_rgba(212,168,67,0.8)]" />
            ) : null}
            <h2
              id={titleId}
              className={cn("font-service text-sm font-semibold text-foreground", titleClassName)}
            >
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {headerTrailing}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
              title={closeLabel}
            >
              <X size={16} aria-hidden="true" />
              <span className="sr-only">{closeLabel}</span>
            </button>
          </div>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-3 sm:p-4", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
