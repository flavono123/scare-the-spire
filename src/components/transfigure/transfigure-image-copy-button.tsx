"use client";

import { useCallback, useState, type RefObject } from "react";
import { Check, ClipboardCopy, LoaderCircle, TriangleAlert } from "lucide-react";

type CopyStatus = "idle" | "copying" | "copied" | "failed" | "unsupported";

interface TransfigureImageCopyButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  labels: {
    copy: string;
    copying: string;
    copied: string;
    success: string;
    failed: string;
    unsupported: string;
  };
}

export function TransfigureImageCopyButton({
  targetRef,
  labels,
}: TransfigureImageCopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  const handleCopy = useCallback(() => {
    const target = targetRef.current;
    if (
      !target
      || !window.isSecureContext
      || !navigator.clipboard?.write
      || !("ClipboardItem" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    setStatus("copying");
    const blobPromise = Promise.all([
      import("html-to-image"),
      document.fonts?.ready ?? Promise.resolve(),
    ]).then(async ([{ toBlob }]) => {
      const blob = await toBlob(target, {
        cacheBust: true,
        pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        preferredFontFormat: "woff2",
      });
      if (!blob) throw new Error("PNG rendering returned no data");
      return blob;
    });

    void navigator.clipboard.write([
      new ClipboardItem({ "image/png": blobPromise }),
    ]).then(
      () => setStatus("copied"),
      () => setStatus("failed"),
    );
  }, [targetRef]);

  const label = status === "copying"
    ? labels.copying
    : status === "copied"
      ? labels.success
      : status === "unsupported"
        ? labels.unsupported
        : status === "failed"
          ? labels.failed
          : labels.copy;
  const Icon = status === "copying"
    ? LoaderCircle
    : status === "copied"
      ? Check
      : status === "failed" || status === "unsupported"
        ? TriangleAlert
        : ClipboardCopy;

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleCopy}
        disabled={status === "copying"}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-yellow-300/35 bg-yellow-500/15 px-4 py-2 text-sm font-semibold text-yellow-100 shadow-[0_0_18px_rgba(239,200,81,0.08)] transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-yellow-200/55 hover:bg-yellow-500/25 hover:shadow-[0_6px_22px_rgba(239,200,81,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
        data-transfigure-copy-image
      >
        <Icon
          className={status === "copying" ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          aria-hidden="true"
        />
        {status === "copying"
          ? labels.copying
          : status === "copied"
            ? labels.copied
            : labels.copy}
      </button>
      {status !== "idle" && status !== "copying" && (
        <span
          role={status === "failed" || status === "unsupported" ? "alert" : "status"}
          aria-live="polite"
          className={status === "failed" || status === "unsupported"
            ? "max-w-72 text-center text-xs text-red-300"
            : "max-w-72 text-center text-xs text-yellow-100/75"}
        >
          {label}
        </span>
      )}
    </div>
  );
}
