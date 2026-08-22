"use client";

import { useCallback, useState, type RefObject } from "react";
import {
  Check,
  ClipboardCopy,
  Download,
  LoaderCircle,
} from "lucide-react";

type ActionStatus = "idle" | "working" | "success";

const embeddedBorderImageCache = new Map<string, Promise<string>>();

interface TransfigureImageCopyButtonProps {
  fileName: string;
  targetRef: RefObject<HTMLElement | null>;
  labels: {
    copy: string;
    copying: string;
    copied: string;
    copyFailed: string;
    copyUnsupported: string;
    download: string;
    downloading: string;
    downloaded: string;
    downloadFailed: string;
  };
}

function readCssUrl(value: string): string | null {
  const match = value.match(/^url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)$/);
  return match?.[1] ?? match?.[2] ?? match?.[3]?.trim() ?? null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function embedBorderImage(url: string): Promise<string> {
  const cached = embeddedBorderImageCache.get(url);
  if (cached) return cached;

  const embedded = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Border image request failed: ${response.status}`);
      }
      return response.blob();
    })
    .then(blobToDataUrl);
  embeddedBorderImageCache.set(url, embedded);
  void embedded.catch(() => embeddedBorderImageCache.delete(url));
  return embedded;
}

async function inlineTargetBorderImages(target: HTMLElement): Promise<() => void> {
  const elements = [
    target,
    ...Array.from(target.querySelectorAll<HTMLElement>("*")),
  ];
  const restorations = await Promise.all(elements.map(async (element) => {
    const source = getComputedStyle(element).borderImageSource;
    const url = readCssUrl(source);
    if (!url || url.startsWith("data:")) return null;

    const originalValue = element.style.getPropertyValue("border-image-source");
    const originalPriority = element.style.getPropertyPriority("border-image-source");
    const embedded = await embedBorderImage(url);
    element.style.setProperty("border-image-source", `url("${embedded}")`);

    return () => {
      if (originalValue) {
        element.style.setProperty(
          "border-image-source",
          originalValue,
          originalPriority,
        );
      } else {
        element.style.removeProperty("border-image-source");
      }
    };
  }));

  return () => {
    for (const restore of restorations) restore?.();
  };
}

async function renderTargetPng(target: HTMLElement): Promise<Blob> {
  const [{ toBlob }] = await Promise.all([
    import("html-to-image"),
    document.fonts?.ready ?? Promise.resolve(),
  ]);
  const restoreBorderImages = await inlineTargetBorderImages(target);
  try {
    const blob = await toBlob(target, {
      cacheBust: true,
      pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      preferredFontFormat: "woff2",
    });
    if (!blob) throw new Error("PNG rendering returned no data");
    return blob;
  } finally {
    restoreBorderImages();
  }
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopy = useCallback(() => {
    const target = targetRef.current;
    if (
      !target
      || !window.isSecureContext
      || !navigator.clipboard?.write
      || !("ClipboardItem" in window)
    ) {
      setErrorMessage(labels.copyUnsupported);
      return;
    }

    setCopyStatus("working");
    setDownloadStatus("idle");
    setErrorMessage(null);
    const blobPromise = renderTargetPng(target);

    void navigator.clipboard.write([
      new ClipboardItem({ "image/png": blobPromise }),
    ]).then(
      () => {
        setCopyStatus("success");
      },
      () => {
        setCopyStatus("idle");
        setErrorMessage(labels.copyFailed);
      },
    );
  }, [
    labels.copyFailed,
    labels.copyUnsupported,
    targetRef,
  ]);
  const handleDownload = useCallback(async () => {
    const target = targetRef.current;
    if (!target) {
      setErrorMessage(labels.downloadFailed);
      return;
    }

    setCopyStatus("idle");
    setDownloadStatus("working");
    setErrorMessage(null);
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
    } catch {
      setDownloadStatus("idle");
      setErrorMessage(labels.downloadFailed);
    }
  }, [
    fileName,
    labels.downloadFailed,
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
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.08)] transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/55 hover:bg-primary/25 hover:shadow-[0_6px_22px_rgba(239,200,81,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
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
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-black/25 px-4 py-2 text-sm font-semibold text-primary/90 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
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
      {errorMessage && (
        <span
          role="alert"
          aria-live="polite"
          className="max-w-72 text-center text-xs text-red-300"
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}
