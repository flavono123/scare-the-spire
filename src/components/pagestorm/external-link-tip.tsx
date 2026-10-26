"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { cachedLinkPreview, type LinkPreview } from "@/lib/link-preview-client";
import { SitePathHoverTip } from "./site-path-hover-tip";

function anchorPreview(anchor: HTMLAnchorElement): LinkPreview {
  return {
    title: anchor.dataset.ogTitle || anchor.textContent?.trim() || anchor.href,
    description: anchor.dataset.ogDescription || "",
    image: anchor.dataset.ogImage || "",
  };
}

/**
 * Open Graph preview on hover over an off-site link, while editing and while
 * reading. Misses are cached too so moving across a link does not refetch.
 */
export function ExternalLinkOgTip({ editor }: { editor: Editor }) {
  const [tip, setTip] = useState<{
    preview: LinkPreview;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);

  useEffect(() => {
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
      if (anchor.dataset.ogTitle) return;
      void cachedLinkPreview(anchor.href).then((preview) => {
        show(anchor, preview.title ? preview : stored);
      });
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
  }, [editor]);

  if (!tip) return null;

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
