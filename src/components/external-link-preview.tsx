"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { SitePathHoverTip } from "@/components/pagestorm/site-path-hover-tip";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { cachedLinkPreview, type LinkPreview } from "@/lib/link-preview-client";

/**
 * Open Graph card (image, title, description) on hover over an off-site
 * link, the same card Pagestorm shows. Touch screens skip it: a tap opens
 * the link.
 */
export function ExternalLinkHoverPreview({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const coarsePointer = useCoarsePointer();
  const [hovered, setHovered] = useState(false);
  const [preview, setPreview] = useState<{ href: string; value: LinkPreview } | null>(null);
  const loaded = preview?.href === href ? preview.value : null;

  useEffect(() => {
    if (!hovered || loaded) return;
    let alive = true;
    void cachedLinkPreview(href).then((value) => {
      if (alive) setPreview({ href, value });
    });
    return () => {
      alive = false;
    };
  }, [hovered, href, loaded]);

  return (
    <span
      className="relative inline"
      onMouseEnter={() => {
        if (!coarsePointer) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && loaded?.title ? (
        <PortaledHoverTipLayer pin="top-left">
          <SitePathHoverTip
            imageUrl={loaded.image || undefined}
            title={loaded.title}
            description={loaded.description}
          />
        </PortaledHoverTipLayer>
      ) : null}
    </span>
  );
}
