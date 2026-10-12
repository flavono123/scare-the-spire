"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview-client";
import { SitePathHoverTip } from "./site-path-hover-tip";

const previewCache = new Map<string, LinkPreview>();

function anchorPreview(anchor: HTMLAnchorElement): LinkPreview {
  return {
    title: anchor.dataset.ogTitle || anchor.textContent?.trim() || anchor.href,
    description: anchor.dataset.ogDescription || "",
    image: anchor.dataset.ogImage || "",
  };
}

export function ExternalLinkOgTip({
  editor,
  enabled,
}: {
  editor: Editor;
  enabled: boolean;
}) {
  const [tip, setTip] = useState<{
    preview: LinkPreview;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = editor.view.dom;
    let active: HTMLAnchorElement | null = null;

    const hide = () => {
      active = null;
      setTip(null);
    };
    const show = (anchor: HTMLAnchorElement, preview: LinkPreview) => {
      if (active !== anchor) return;
      const rect = anchor.getBoundingClientRect();
      setTip({
        preview,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      });
    };
    const onOver = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest?.("a.pagestorm-inline-link");
      if (!(anchor instanceof HTMLAnchorElement) || !root.contains(anchor)) return;
      active = anchor;
      const stored = anchorPreview(anchor);
      show(anchor, stored);
      if (anchor.dataset.ogTitle || previewCache.has(anchor.href)) {
        const cached = previewCache.get(anchor.href);
        if (cached) show(anchor, cached);
        return;
      }
      void fetchLinkPreview(anchor.href).then((preview) => {
        if (preview.title) previewCache.set(anchor.href, preview);
        show(anchor, preview.title ? preview : stored);
      }).catch(() => undefined);
    };
    const onOut = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a.pagestorm-inline-link");
      if (!(anchor instanceof HTMLAnchorElement) || active !== anchor) return;
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) return;
      hide();
    };
    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
    };
  }, [editor, enabled]);

  if (!enabled || !tip) return null;

  return (
    <span
      className="pointer-events-none fixed"
      style={{
        left: tip.rect.left,
        top: tip.rect.top,
        width: tip.rect.width,
        height: tip.rect.height,
      }}
    >
      <PortaledHoverTipLayer>
        <SitePathHoverTip
          imageUrl={tip.preview.image || undefined}
          title={tip.preview.title}
          description={tip.preview.description}
        />
      </PortaledHoverTipLayer>
    </span>
  );
}
