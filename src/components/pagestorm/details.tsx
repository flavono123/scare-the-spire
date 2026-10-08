"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import type { MouseEvent } from "react";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

function DetailsView({ node, updateAttributes, editor }: NodeViewProps) {
  const open = node.attrs.open !== false;
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  return (
    <NodeViewWrapper
      className="pagestorm-details"
      data-open={open ? "true" : "false"}
      data-pagestorm-details=""
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        if (editor.isEditable) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest("[data-details-summary]")) return;
        event.preventDefault();
        updateAttributes({ open: !open });
      }}
    >
      <button
        type="button"
        contentEditable={false}
        className="pagestorm-details-toggle"
        aria-expanded={open}
        aria-label={open ? copy.detailsCollapse : copy.detailsExpand}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          updateAttributes({ open: !open });
        }}
      >
        <ChevronRight
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagestormDetails: {
      insertPagestormDetails: (summary: string) => ReturnType;
    };
  }
}

export const PagestormDetails = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute("open"),
        renderHTML: (attributes) => (attributes.open ? { open: "open" } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes, { class: "pagestorm-details" }), 0];
  },
  addCommands() {
    return {
      insertPagestormDetails: (summary) => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: { open: true },
        content: [
          {
            type: "detailsSummary",
            content: [{ type: "text", text: summary }],
          },
          {
            type: "detailsContent",
            content: [{ type: "paragraph" }],
          },
        ],
      }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(DetailsView);
  },
});

export const PagestormDetailsSummary = Node.create({
  name: "detailsSummary",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "summary" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes, { "data-details-summary": "" }), 0];
  },
});

export const PagestormDetailsContent = Node.create({
  name: "detailsContent",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-details-content]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-details-content": "" }), 0];
  },
});
