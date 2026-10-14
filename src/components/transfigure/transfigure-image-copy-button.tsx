"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  Check,
  ClipboardCopy,
  Download,
  LoaderCircle,
} from "lucide-react";
import { GameUiHoverTip, GAME_UI_HOVER_TIP_NAV_DELAY_MS } from "@/components/game-ui-hover-tip";
import { imageCaptureInsets } from "@/lib/image-capture-frame";
import {
  elementMatchesImageCaptureSnapshot,
  imageCaptureSnapshotFromHref,
  imageCaptureSnapshotsEqual,
  type ImageCaptureSnapshot,
} from "@/lib/image-capture-snapshot";

type ActionStatus = "idle" | "working" | "success";

const STATUS_RESET_MS = 2000;

const embeddedBorderImageCache = new Map<string, Promise<string>>();

interface TransfigureImageCopyButtonProps {
  fileName: string;
  targetRef: RefObject<HTMLElement | null>;
  /** `icons` is the compact Compendium control. `panel` is the Transfigure pair. */
  layout?: "panel" | "icons";
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForStableCaptureSnapshot(): Promise<ImageCaptureSnapshot> {
  const started = performance.now();
  let previous = imageCaptureSnapshotFromHref(window.location.href);
  let lastChange = started;
  while (performance.now() - started < 2500) {
    await delay(50);
    const next = imageCaptureSnapshotFromHref(window.location.href);
    if (!imageCaptureSnapshotsEqual(previous, next)) {
      previous = next;
      lastChange = performance.now();
    }
    const elapsed = performance.now() - started;
    const quiet = performance.now() - lastChange;
    // Locale detection and the version subscription can both move the URL
    // shortly after the click. One settled read is the snapshot for every
    // element in the tile.
    if (elapsed >= 600 && quiet >= 200) return previous;
  }
  return previous;
}

function stampedTiles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-card-tile][data-game-locale]"));
}

async function waitForMatchingCaptureNode(
  target: HTMLElement,
  snapshot: ImageCaptureSnapshot,
): Promise<HTMLElement> {
  const started = performance.now();
  while (performance.now() - started < 4000) {
    const candidates = [captureNode(target), ...stampedTiles()];
    const match = candidates.find((node) => elementMatchesImageCaptureSnapshot(
      node.dataset.gameLocale,
      node.dataset.version,
      snapshot,
    ));
    if (match) return match;
    if (stampedTiles().length === 0 && !captureNode(target).dataset.gameLocale) {
      return captureNode(target);
    }
    await delay(50);
  }
  throw new Error("Image capture snapshot did not settle");
}

function captureNode(target: HTMLElement): HTMLElement {
  if (target.matches("[data-card-tile], [data-relic-inspect-slab]")) return target;
  return target.querySelector<HTMLElement>("[data-card-tile], [data-relic-inspect-slab]") ?? target;
}

function isCaptureChrome(node: Node): boolean {
  return node instanceof Element && Boolean(
    node.closest("[data-hover-tip-layer], [data-side-tips], [data-card-side-tips]"),
  );
}

function expandCaptureFrame(node: HTMLElement): () => void {
  const root = node.getBoundingClientRect();
  const descendants = Array.from(node.querySelectorAll<HTMLElement>("*"))
    .filter((element) => !isCaptureChrome(element))
    .map((element) => element.getBoundingClientRect());
  const insets = imageCaptureInsets(root, descendants);
  const computed = getComputedStyle(node);
  const padding = (property: string) => Number.parseFloat(computed.getPropertyValue(property)) || 0;
  const previous = {
    boxSizing: node.style.boxSizing,
    width: node.style.width,
    height: node.style.height,
    paddingTop: node.style.paddingTop,
    paddingRight: node.style.paddingRight,
    paddingBottom: node.style.paddingBottom,
    paddingLeft: node.style.paddingLeft,
    marginTop: node.style.marginTop,
    marginRight: node.style.marginRight,
    marginBottom: node.style.marginBottom,
    marginLeft: node.style.marginLeft,
  };
  node.style.boxSizing = "border-box";
  node.style.width = `${node.offsetWidth + insets.left + insets.right}px`;
  node.style.height = `${node.offsetHeight + insets.top + insets.bottom}px`;
  node.style.paddingTop = `${padding("padding-top") + insets.top}px`;
  node.style.paddingRight = `${padding("padding-right") + insets.right}px`;
  node.style.paddingBottom = `${padding("padding-bottom") + insets.bottom}px`;
  node.style.paddingLeft = `${padding("padding-left") + insets.left}px`;
  // html-to-image clips to the border box. The tile's negative margin shifts
  // that box, which cuts off the cost orb sitting in the top-left padding.
  node.style.marginTop = "0";
  node.style.marginRight = "0";
  node.style.marginBottom = "0";
  node.style.marginLeft = "0";
  return () => {
    node.style.boxSizing = previous.boxSizing;
    node.style.width = previous.width;
    node.style.height = previous.height;
    node.style.paddingTop = previous.paddingTop;
    node.style.paddingRight = previous.paddingRight;
    node.style.paddingBottom = previous.paddingBottom;
    node.style.paddingLeft = previous.paddingLeft;
    node.style.marginTop = previous.marginTop;
    node.style.marginRight = previous.marginRight;
    node.style.marginBottom = previous.marginBottom;
    node.style.marginLeft = previous.marginLeft;
  };
}

function withSelectedVersion(fileName: string, version: string): string {
  if (!version || fileName.includes(version)) return fileName;
  const stem = fileName.replace(/\.png$/i, "");
  return `${stem}-v${version}.png`;
}

async function renderTargetPng(target: HTMLElement): Promise<{ blob: Blob; snapshot: ImageCaptureSnapshot }> {
  const [{ toBlob }, snapshot] = await Promise.all([
    import("html-to-image"),
    waitForStableCaptureSnapshot(),
    document.fonts?.ready ?? Promise.resolve(),
  ]);
  const node = await waitForMatchingCaptureNode(target, snapshot);
  const previousOverflow = node.style.overflow;
  node.style.overflow = "visible";
  const restoreFrame = expandCaptureFrame(node);
  const restoreBorderImages = await inlineTargetBorderImages(node);
  try {
    const blob = await toBlob(node, {
      cacheBust: false,
      pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      preferredFontFormat: "woff2",
      filter: (domNode) => !isCaptureChrome(domNode),
    });
    if (!blob) throw new Error("PNG rendering returned no data");
    return { blob, snapshot };
  } finally {
    restoreBorderImages();
    restoreFrame();
    node.style.overflow = previousOverflow;
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
  layout = "panel",
  labels,
}: TransfigureImageCopyButtonProps) {
  const [copyStatus, setCopyStatus] = useState<ActionStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (copyStatus !== "success") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), STATUS_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (downloadStatus !== "success") return;
    const timer = window.setTimeout(() => setDownloadStatus("idle"), STATUS_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [downloadStatus]);

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
    const blobPromise = renderTargetPng(target).then((rendered) => rendered.blob);

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
      const rendered = await renderTargetPng(target);
      const url = URL.createObjectURL(rendered.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeDownloadName(withSelectedVersion(fileName, rendered.snapshot.version));
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
  const copyLabel = copyStatus === "working"
    ? labels.copying
    : copyStatus === "success"
      ? labels.copied
      : labels.copy;
  const downloadLabel = downloadStatus === "working"
    ? labels.downloading
    : downloadStatus === "success"
      ? labels.downloaded
      : labels.download;
  const copyIcon = copyStatus === "working" ? (
    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
  ) : copyStatus === "success" ? (
    <Check className="h-4 w-4" aria-hidden="true" />
  ) : (
    <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
  );
  const downloadIcon = downloadStatus === "working" ? (
    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
  ) : downloadStatus === "success" ? (
    <Check className="h-4 w-4" aria-hidden="true" />
  ) : (
    <Download className="h-4 w-4" aria-hidden="true" />
  );

  if (layout === "icons") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <GameUiHoverTip label={copyLabel} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
            <button
              type="button"
              onClick={handleCopy}
              disabled={busy}
              aria-label={copyLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary transition-colors hover:border-primary/55 hover:bg-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 disabled:cursor-wait disabled:opacity-65"
              data-transfigure-copy-image
              data-compendium-copy-image
            >
              {copyIcon}
            </button>
          </GameUiHoverTip>
          <GameUiHoverTip label={downloadLabel} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              aria-label={downloadLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-black/25 text-primary/90 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 disabled:cursor-wait disabled:opacity-65"
              data-transfigure-download-image
              data-compendium-download-image
            >
              {downloadIcon}
            </button>
          </GameUiHoverTip>
        </div>
        {errorMessage && (
          <span role="alert" aria-live="polite" className="max-w-72 text-center text-xs text-red-300">
            {errorMessage}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex w-full flex-col items-center gap-1.5">
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.08)] transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/55 hover:bg-primary/25 hover:shadow-[0_6px_22px_rgba(239,200,81,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 active:translate-y-0 disabled:cursor-wait disabled:opacity-65 motion-reduce:transform-none"
          data-transfigure-copy-image
          data-compendium-copy-image
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
          data-compendium-download-image
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
