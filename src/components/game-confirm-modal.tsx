"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

const PANEL_SRC = "/images/sts2/ui/confirm/popup_vertical.png";
const CANCEL_SRC = "/images/sts2/ui/confirm/popup_cancel_button.png";
const CONFIRM_SRC = "/images/sts2/ui/confirm/popup_confirm_button.png";
const CANCEL_OUTLINE_SRC = "/images/sts2/ui/confirm/popup_cancel_button_outline.png";
const CONFIRM_OUTLINE_SRC = "/images/sts2/ui/confirm/popup_confirm_button_outline.png";

const PopupYesNoButton = forwardRef<
  HTMLButtonElement,
  {
    variant: "cancel" | "confirm";
    label: string;
    imageSrc: string;
    outlineSrc: string;
    labelOutline: string;
    onClick: () => void;
  }
>(function PopupYesNoButton(
  { variant, label, imageSrc, outlineSrc, labelOutline, onClick },
  ref,
) {
  // Game pivots: No ~ left edge, Yes ~ right edge → scale reads as inward tilt.
  const origin = variant === "cancel" ? "left center" : "right center";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "group/popup-btn relative h-[4.5rem] w-[9.5rem] shrink-0 bg-transparent p-0",
        "focus-visible:outline-none sm:h-[5rem] sm:w-[10.5rem]",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 block transition-transform duration-500 ease-out motion-reduce:transition-none",
          "group-hover/popup-btn:scale-[1.025] group-focus-visible/popup-btn:scale-[1.025]",
          "group-active/popup-btn:scale-[0.975]",
          "motion-reduce:group-hover/popup-btn:scale-100 motion-reduce:group-focus-visible/popup-btn:scale-100",
        )}
        style={{ transformOrigin: origin }}
      >
        {/* Idle outline: dark half-transparent; hover: gold additive (NPopupYesNoButton) */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-[-4%] opacity-50 transition-opacity duration-150",
            "group-hover/popup-btn:opacity-100 group-focus-visible/popup-btn:opacity-100",
          )}
        >
          <Image
            src={outlineSrc}
            alt=""
            fill
            unoptimized
            className={cn(
              "object-contain brightness-0",
              "group-hover/popup-btn:mix-blend-screen group-focus-visible/popup-btn:mix-blend-screen",
              "group-hover/popup-btn:[filter:brightness(0)_saturate(100%)_invert(72%)_sepia(79%)_saturate(1200%)_hue-rotate(4deg)_brightness(1.05)]",
              "group-focus-visible/popup-btn:[filter:brightness(0)_saturate(100%)_invert(72%)_sepia(79%)_saturate(1200%)_hue-rotate(4deg)_brightness(1.05)]",
            )}
          />
        </span>
        <Image
          src={imageSrc}
          alt=""
          aria-hidden
          fill
          unoptimized
          className={cn(
            "pointer-events-none object-contain transition-[filter] duration-150",
            "group-hover/popup-btn:brightness-110 group-hover/popup-btn:saturate-125",
            "group-focus-visible/popup-btn:brightness-110 group-focus-visible/popup-btn:saturate-125",
            "group-active/popup-btn:brightness-95 group-active/popup-btn:saturate-90",
          )}
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center px-4",
            "font-game-title text-[1.15rem] font-bold leading-none text-[#fff6e2]",
            "sm:text-[1.25rem]",
          )}
          style={{
            textShadow: "3px 2px 0 rgba(0,0,0,0.13)",
            WebkitTextStroke: `1.5px ${labelOutline}`,
            paintOrder: "stroke fill",
          }}
        >
          {label}
        </span>
      </span>
    </button>
  );
});

/**
 * Game GENERIC_POPUP chrome (vertical_popup + abandon_run yes/no ribbons).
 * Hover/focus mirrors NPopupYesNoButton: gold additive outline + scale 1.025
 * from the outer-edge pivot (reads as a slight inward tilt).
 */
export function GameConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        className="relative w-[min(100%,22rem)] sm:w-[26rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-[716/816] w-full">
          <Image
            src={PANEL_SRC}
            alt=""
            aria-hidden
            fill
            unoptimized
            className="pointer-events-none object-contain"
          />

          <div className="absolute inset-[12%_10%_14%] flex flex-col items-center">
            <h2
              id={titleId}
              className="mt-[8%] max-w-[90%] text-center font-game-title text-[1.35rem] font-bold leading-snug text-[#efc851] sm:text-[1.7rem]"
              style={{
                WebkitTextStroke: "1px rgba(84, 63, 0, 0.85)",
                textShadow: "3px 2px 0 rgba(0,0,0,0.2)",
              }}
            >
              {title}
            </h2>
            {body && (
              <p
                id={bodyId}
                className="mt-[14%] max-w-[88%] text-center font-game-text text-[0.95rem] leading-relaxed text-white sm:text-base"
              >
                {body}
              </p>
            )}
          </div>

          <div className="absolute inset-x-[-4%] bottom-[7%] flex items-end justify-between gap-2 px-1 sm:inset-x-[-2%] sm:bottom-[8%]">
            <PopupYesNoButton
              ref={cancelRef}
              variant="cancel"
              label={cancelLabel}
              imageSrc={CANCEL_SRC}
              outlineSrc={CANCEL_OUTLINE_SRC}
              labelOutline="rgba(89, 18, 0, 1)"
              onClick={onCancel}
            />
            <PopupYesNoButton
              variant="confirm"
              label={confirmLabel}
              imageSrc={CONFIRM_SRC}
              outlineSrc={CONFIRM_OUTLINE_SRC}
              labelOutline="rgba(31, 71, 0, 1)"
              onClick={onConfirm}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
