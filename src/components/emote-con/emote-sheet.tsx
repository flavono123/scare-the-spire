"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { EmoteWheel } from "@/components/emote-con/emote-wheel";
import type { EmoteId } from "@/lib/emote-con";
import { serviceMessages } from "@/messages/service";

/**
 * Full-width sheet for the reaction wheel.
 * The old like-wheel failed on phones because a 220px popup used drag
 * selection. This sheet keeps the game wedges, sizes the ring to the
 * viewport, and uses separate tap targets.
 */
export function EmoteSheet({
  locale,
  onClose,
  onPick,
}: {
  locale: "ko" | "en";
  onClose: () => void;
  onPick: (id: EmoteId) => void;
}) {
  const copy = serviceMessages[locale].emoteCon;
  const closeLabel = serviceMessages[locale].codex.common.close;
  const onCloseRef = useRef(onClose);
  const [wheelSize, setWheelSize] = useState(288);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const update = () => {
      const available = window.innerWidth - 32;
      setWheelSize(Math.min(336, Math.max(220, available)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.make}
        data-emote-con-sheet=""
        className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border/80 bg-zinc-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">{copy.label}</p>
            <p className="text-[11px] text-muted-foreground">{copy.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <EmoteWheel size={wheelSize} locale={locale} onPick={onPick} />
      </div>
    </div>,
    document.body,
  );
}
