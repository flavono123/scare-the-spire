"use client";

import { ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import type { ComponentType } from "react";

/**
 * ReactNodeViewRenderer for views that mark themselves when selected. Since
 * Tiptap 3.31 `selected` follows node selections only; these views also stay
 * marked while a text or select-all range spans the whole node.
 */
export function spannedNodeViewRenderer(
  View: ComponentType<NodeViewProps>,
  options?: Parameters<typeof ReactNodeViewRenderer>[1],
) {
  function SpannedNodeView(props: NodeViewProps) {
    const spanned = useEditorState({
      editor: props.editor,
      selector: ({ editor }) => {
        const pos = props.getPos();
        if (typeof pos !== "number") return false;
        const { from, to } = editor.state.selection;
        return from <= pos && to >= pos + props.node.nodeSize;
      },
    });
    return <View {...props} selected={props.selected || spanned} />;
  }
  return ReactNodeViewRenderer(SpannedNodeView, options);
}
