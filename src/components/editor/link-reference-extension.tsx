"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Link2, LoaderCircle } from "lucide-react";
import { EXTERNAL_LINK_TEXT_CLASS } from "@/lib/service-link-classes";
import { selectAtomOnClick } from "./editor-link";

function LinkReferenceNodeView({ editor, getPos, node }: NodeViewProps) {
  const selectOnClick = (event: React.MouseEvent<HTMLElement>) => selectAtomOnClick(editor, getPos, event);
  const title = (node.attrs.title as string) || (node.attrs.pendingLabel as string);
  const pending = !(node.attrs.title as string);

  return (
    <NodeViewWrapper
      onClick={selectOnClick}
      as="span"
      className={`mx-0.5 inline-flex max-w-full items-center gap-1 align-baseline font-semibold ${EXTERNAL_LINK_TEXT_CLASS}`}
      data-link-reference=""
    >
      {pending ? (
        <LoaderCircle
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{title}</span>
    </NodeViewWrapper>
  );
}

/**
 * Off-site link pasted into a short post, labelled with its page title.
 * Stored as a `link` block. RichContentEditor installs it only when a
 * service passes `linkReferences`.
 */
export const LinkReferenceExtension = Node.create({
  name: "link-reference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: { default: "" },
      title: { default: "" },
      pendingLabel: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-link-reference]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-link-reference": "",
        class: `${EXTERNAL_LINK_TEXT_CLASS} font-semibold`,
      }),
      (node.attrs.title || node.attrs.pendingLabel) as string,
    ];
  },

  renderText({ node }) {
    return (node.attrs.title || node.attrs.pendingLabel) as string;
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkReferenceNodeView, { as: "span" });
  },
});
