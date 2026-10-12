"use client";

import type { Mark } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { LinkPreview } from "@/lib/link-preview";

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
