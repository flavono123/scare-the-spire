"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type Editor, type NodeViewProps } from "@tiptap/react";
import { ChevronRight, GripVertical } from "lucide-react";
import { startPagestormBlockDrag } from "./block-drag";
import type { MouseEvent } from "react";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

export function pagestormPosInClosedDetails(doc: PMNode, pos: number): boolean {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const current = $pos.node(depth);
    if (current.type.name === "details" && current.attrs.open === false) return true;
  }
  return false;
}

/** Close or open the details around the selection. Closing leaves the summary so hidden edit chrome unmounts. */
export function setPagestormDetailsOpen(editor: Editor, open: boolean): boolean {
  const { $from } = editor.state.selection;
  let detailsDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "details") {
      detailsDepth = depth;
      break;
    }
  }
  if (detailsDepth < 0) return false;
  const detailsPos = $from.before(detailsDepth);
  const detailsNode = $from.node(detailsDepth);
  const tr = editor.state.tr.setNodeMarkup(detailsPos, undefined, {
    ...detailsNode.attrs,
    open,
  });
  if (!open) {
    const summaryPos = Math.min(detailsPos + 2, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(summaryPos)));
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function DetailsView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
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
      {editor.isEditable ? (
        <button
          type="button"
          contentEditable={false}
          draggable
          className="pagestorm-details-drag"
          aria-label={copy.dragBlock}
          data-pagestorm-drag-handle=""
          onMouseDown={(event) => event.preventDefault()}
          onDragStart={(event) => {
            const pos = getPos();
            if (typeof pos !== "number") return;
            startPagestormBlockDrag(editor.view, pos, event);
          }}
        >
          <GripVertical aria-hidden className="h-3.5 w-3.5" />
        </button>
      ) : null}
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
          const nextOpen = !open;
          if (!nextOpen && setPagestormDetailsOpen(editor, false)) return;
          if (nextOpen) {
            const pos = getPos();
            if (typeof pos === "number") {
              const current = editor.state.doc.nodeAt(pos);
              if (current) {
                editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
                  ...current.attrs,
                  open: true,
                }));
                return;
              }
            }
          }
          updateAttributes({ open: nextOpen });
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
  draggable: true,
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
