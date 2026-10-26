"use client";

import { useEffect, useState } from "react";
import { RichText } from "@/components/rich-text";
import { ExternalLinkHoverPreview } from "@/components/external-link-preview";
import { cachedLinkPreview } from "@/lib/link-preview-client";
import {
  isSafeLinkHref,
  isTitledLinkUrl,
  normalizeLinkTitle,
  splitTextUrls,
} from "@/lib/link-reference";
import { EXTERNAL_PROSE_LINK_CLASS } from "@/lib/service-link-classes";

/** A stored link block: off-site, so it opens in a new tab. */
export function LinkBlockAnchor({ href, title }: { href: string; title: string }) {
  if (!isSafeLinkHref(href) || !title.trim()) return null;
  return (
    <ExternalLinkHoverPreview href={href}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={EXTERNAL_PROSE_LINK_CLASS}
      >
        {title}
      </a>
    </ExternalLinkHoverPreview>
  );
}

/**
 * A bare URL typed into text. Titled hosts (see isTitledLinkUrl) show their
 * page title once it loads, so posts written before link blocks read the
 * same as new ones.
 */
function BareUrlAnchor({ href }: { href: string }) {
  const titled = isTitledLinkUrl(href);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!titled) return;
    let alive = true;
    void cachedLinkPreview(href).then((preview) => {
      if (alive && preview.title) setTitle(normalizeLinkTitle(preview.title, href));
    });
    return () => {
      alive = false;
    };
  }, [href, titled]);

  return (
    <ExternalLinkHoverPreview href={href}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${EXTERNAL_PROSE_LINK_CLASS} break-all`}
      >
        {title ?? href}
      </a>
    </ExternalLinkHoverPreview>
  );
}

/** RichText with bare http(s) URLs turned into off-site links. */
export function LinkifiedRichText({ text }: { text: string }) {
  const segments = splitTextUrls(text);
  if (segments.length === 1 && segments[0]?.kind === "text") {
    return <RichText text={text} />;
  }
  return (
    <>
      {segments.map((segment, index) => (
        segment.kind === "url"
          ? <BareUrlAnchor key={index} href={segment.href} />
          : <RichText key={index} text={segment.text} />
      ))}
    </>
  );
}
