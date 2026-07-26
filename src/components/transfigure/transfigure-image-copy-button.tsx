"use client";

import { useCallback, useState, type RefObject } from "react";
import {
  Check,
  ClipboardCopy,
  Download,
  LoaderCircle,
} from "lucide-react";

type ActionStatus = "idle" | "working" | "success";

interface TransfigureImageCopyButtonProps {
  fileName: string;
  targetRef: RefObject<HTMLElement | null>;
  labels: {
    copy: string;
    copying: string;
    copied: string;
    copySuccess: string;
    copyFailed: string;
    copyUnsupported: string;
    download: string;
    downloading: string;
    downloaded: string;
    downloadSuccess: string;
    downloadFailed: string;
  };
}

function renderTargetPng(target: HTMLElement): Promise<Blob> {
  return Promise.all([
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
}

function safeDownloadName(fileName: string): string {
  const cleanName = fileName
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleanName.toLowerCase().endsWith(".png")
    ? cleanName
    : `${cleanName || "transfigure"}.png`;
}

export function TransfigureImageCopyButton({
  fileName,
  targetRef,
  labels,
}: TransfigureImageCopyButtonProps) {
  const [copyStatus, setCopyStatus] = useState<ActionStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>("idle");
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "status";
  } | null>(null);

  const handleCopy = useCallback(() => {
    const target = targetRef.current;
    if (
      !target
      || !window.isSecureContext
      || !navigator.clipboard?.write
      || !("ClipboardItem" in window)
    ) {
      setFeedback({ message: labels.copyUnsupported, tone: "error" });
      return;
    }

    setCopyStatus("working");
    setDownloadStatus("idle");
    setFeedback(null);
    const blobPromise = renderTargetPng(target);

    void navigator.clipboard.write([
      new ClipboardItem({ "image/png": blobPromise }),
    ]).then(
      () => {
        setCopyStatus("success");
        setFeedback({ message: labels.copySuccess, tone: "status" });
      },
      () => {
        setCopyStatus("idle");
        setFeedback({ message: labels.copyFailed, tone: "error" });
      },
    );
  }, [
    labels.copyFailed,
    labels.copySuccess,
    labels.copyUnsupported,
    targetRef,
  ]);
  const handleDownload = useCallback(async () => {
    const target = targetRef.current;
    if (!target) {
      setFeedback({ message: labels.downloadFailed, tone: "error" });
      return;
    }

    setCopyStatus("idle");
    setDownloadStatus("working");
    setFeedback(null);
    try {
      const blob = await renderTargetPng(target);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeDownloadName(fileName);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadStatus("success");
      setFeedback({ message: labels.downloadSuccess, tone: "status" });
    } catch {
      setDownloadStatus("idle");
      setFeedback({ message: labels.downloadFailed, tone: "error" });
    }
  }, [
    fileName,
    labels.downloadFailed,
    labels.downloadSuccess,
    targetRef,
  ]);
  const busy = copyStatus === "working" || downloadStatus === "working";

  return (
    <div className="mt-3 flex w-full flex-col items-center gap-1.5">
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-yellow-300/35 bg-yellow-500/15 px-4 py-2 text-sm font-semibold text-yellow-100 shadow-[0_0_18px_rgba(239,200,81,0.08)] transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-yellow-200/55 hover:bg-yellow-500/25 hover:shadow-[0_6px_22px_rgba(239,200,81,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
          data-transfigure-copy-image
        >
          {copyStatus === "working" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : copyStatus === "success" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          )}
          {copyStatus === "working"
            ? labels.copying
            : copyStatus === "success"
              ? labels.copied
              : labels.copy}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-yellow-300/20 bg-black/25 px-4 py-2 text-sm font-semibold text-yellow-100/90 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-yellow-200/40 hover:bg-yellow-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
          data-transfigure-download-image
        >
          {downloadStatus === "working" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : downloadStatus === "success" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {downloadStatus === "working"
            ? labels.downloading
            : downloadStatus === "success"
              ? labels.downloaded
              : labels.download}
        </button>
      </div>
      {feedback && (
        <span
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={feedback.tone === "error"
            ? "max-w-72 text-center text-xs text-red-300"
            : "max-w-72 text-center text-xs text-yellow-100/75"}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
