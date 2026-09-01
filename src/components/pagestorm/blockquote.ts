import { findParentNode } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { findWrapping, liftTarget } from "@tiptap/pm/transform";

function isListName(name: string): boolean {
  return name === "bulletList" || name === "orderedList";
}

function wrapOrLiftList(
  editor: Editor,
  list: { pos: number; node: { nodeSize: number } },
  wrap: boolean,
): boolean {
  const { state } = editor;
  const $from = state.doc.resolve(list.pos);
  const $to = state.doc.resolve(list.pos + list.node.nodeSize);
  const range = $from.blockRange($to);
  if (!range) return false;
  if (wrap) {
    const wrapping = findWrapping(range, state.schema.nodes.blockquote);
    if (!wrapping) return false;
    editor.view.dispatch(state.tr.wrap(range, wrapping).scrollIntoView());
    return true;
  }
  const target = liftTarget(range);
  if (target == null) return false;
  editor.view.dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
}

/**
 * Wrap a list in a blockquote instead of trying to wrap the inner paragraph.
 * `listItem` cannot contain `blockquote`, so the default toggle no-ops.
 * Quote → list already nests the list inside the quote; this matches that.
 */
export function togglePagestormBlockquote(editor: Editor): boolean {
  const { state } = editor;
  const list = findParentNode((node) => isListName(node.type.name))(state.selection);
  const quote = findParentNode((node) => node.type.name === "blockquote")(state.selection);

  if (list && !quote) {
    return wrapOrLiftList(editor, list, true);
  }

  if (list && quote && quote.depth < list.depth) {
    return wrapOrLiftList(editor, list, false);
  }

  return editor.chain().focus().toggleBlockquote().run();
}
