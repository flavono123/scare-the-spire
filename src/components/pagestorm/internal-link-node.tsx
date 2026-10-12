"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { SitePathHoverTip } from "./site-path-hover-tip";

function PagestormInternalLinkView({ editor, node, selected }: NodeViewProps) {
  const href = String(node.attrs.href ?? "");
  const label = String(node.attrs.label ?? href);
  const title = String(node.attrs.title ?? label);
  const preview = String(node.attrs.preview ?? "");
  const imageUrl = String(node.attrs.ogImage ?? "");
  const imageAlt = String(node.attrs.ogImageAlt ?? "");
  const [hovered, setHovered] = useState(false);
  const showTip = hovered || selected;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="relative inline"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <a
          href={href}
          className="pagestorm-internal-link"
          onClick={(event) => {
            if (editor.isEditable) event.preventDefault();
          }}
        >
          {label}
        </a>
        {showTip && (title || preview || imageUrl) ? (
          <PortaledHoverTipLayer pin="top-left">
            <SitePathHoverTip
              imageUrl={imageUrl || undefined}
              imageAlt={imageAlt}
              title={title}
              description={preview}
            />
          </PortaledHoverTipLayer>
        ) : null}
      </span>
    </NodeViewWrapper>
  );
}

export function pagestormInternalLinkContent(entry: {
  href: string;
  label: string;
  title: string;
  preview: string;
  ogImage?: string;
  ogImageAlt?: string;
}) {
  return {
    type: "pagestormInternalLink",
    attrs: {
      href: entry.href,
      label: entry.label,
      title: entry.title,
      preview: entry.preview,
      ogImage: entry.ogImage ?? "",
      ogImageAlt: entry.ogImageAlt ?? "",
    },
  };
}

export const PagestormInternalLink = Node.create({
  name: "pagestormInternalLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: "" },
      label: { default: "" },
      title: { default: "" },
      preview: { default: "" },
      ogImage: { default: "" },
      ogImageAlt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-pagestorm-internal-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: node.attrs.href,
        "data-pagestorm-internal-link": "",
        class: "pagestorm-internal-link",
      }),
      node.attrs.label as string,
    ];
  },

  renderText({ node }) {
    return String(node.attrs.label ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(PagestormInternalLinkView, { as: "span" });
  },
});
