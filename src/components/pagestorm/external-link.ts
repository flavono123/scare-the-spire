"use client";

import type { Mark } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { LinkPreview } from "@/lib/link-preview";
import { fetchLinkPreview } from "@/lib/link-preview-client";

export const EXTERNAL_LINK_ATTRS = {
  target: "_blank",
  rel: "noopener noreferrer",
  class: "pagestorm-inline-link",
} as const;

/**
 * Insert an off-site link labelled `fallback` (usually the host name), then
 * swap the label for the page's Open Graph title once it arrives.
 */
export function insertExternalLink(editor: Editor, href: string, fallback: string) {
  editor.chain().focus().insertContent({
    type: "text",
    text: fallback,
    marks: [{ type: "link", attrs: { href, ...EXTERNAL_LINK_ATTRS } }],
  })
    // Links are inclusive while autolink is on; without this the next
    // keystrokes extend the label and the title swap no longer finds it.
    .unsetMark("link")
    .run();
  void fetchLinkPreview(href).then((preview) => {
    if (editor.isDestroyed || !preview.title) return;
    replaceExternalLinkLabel(editor, href, fallback, preview);
  }).catch(() => undefined);
}

export function replaceExternalLinkLabel(
  editor: Editor,
  href: string,
  previousText: string,
  preview: LinkPreview,
) {
  const label = preview.title.trim() || previousText;
  const { state } = editor;
  let tr = state.tr;
  const ranges: Array<{ from: number; to: number; marks: readonly Mark[] }> = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || node.text !== previousText) return;
    const mark = node.marks.find((item) => item.type.name === "link" && item.attrs.href === href);
    if (!mark) return;
    ranges.push({ from: pos, to: pos + node.nodeSize, marks: node.marks });
  });
  for (const range of ranges.reverse()) {
    const link = range.marks.find((mark) => mark.type.name === "link");
    if (!link) continue;
    const marks = range.marks.map((mark) => mark.type.name === "link" ? link : mark);
    tr = tr.replaceWith(range.from, range.to, state.schema.text(label, marks));
  }
  if (tr.docChanged) editor.view.dispatch(tr);
}
