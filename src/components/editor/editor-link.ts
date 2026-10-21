import type { Editor } from "@tiptap/core";
import type { MouseEvent } from "react";

/**
 * Link rule shared by every editor: a plain click never leaves the page (it
 * places the caret or selects the atom, and the link bubble offers "open").
 * A modifier click, or the bubble, opens the page in a new tab so the draft
 * stays put. Viewers keep in-site links in this tab.
 */
export const NEW_TAB_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export function isModifiedClick(event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey;
}

export function preventPlainClick(event: MouseEvent<HTMLElement>) {
  if (!isModifiedClick(event)) event.preventDefault();
}

/** Props for an `<a>` rendered inside an editable document. */
export const EDITOR_ANCHOR_PROPS = {
  ...NEW_TAB_LINK_PROPS,
  onClick: preventPlainClick,
} as const;

/**
 * Select an atom node view on a plain click while editing, so the link bubble
 * can offer "open". ProseMirror does not select atoms whose view is a link.
 */
export function selectAtomOnClick(
  editor: Editor,
  getPos: () => number | undefined,
  event: MouseEvent<HTMLElement>,
) {
  if (!editor.isEditable || isModifiedClick(event)) return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  editor.chain().setNodeSelection(pos).focus(undefined, { scrollIntoView: false }).run();
}
