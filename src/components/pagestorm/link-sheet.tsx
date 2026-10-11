"use client";

import { getMarkRange } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { normalizeHttpUrl } from "./markdown-blocks";

function currentLink(editor: Editor): { from: number; to: number; title: string; url: string } | null {
  const type = editor.state.schema.marks.link;
  if (!type) return null;
  const { from, to, empty, $from } = editor.state.selection;
  if (!empty && !editor.isActive("link")) {
    return { from, to, title: editor.state.doc.textBetween(from, to, " "), url: "" };
  }
  const range = getMarkRange($from, type);
  if (!range) return null;
  const mark = type.isInSet(editor.state.doc.resolve(Math.min(range.from + 1, range.to)).marks());
  return {
    from: range.from,
    to: range.to,
    title: editor.state.doc.textBetween(range.from, range.to, " "),
    url: String(mark?.attrs.href ?? ""),
  };
}

function applyPagestormLink(editor: Editor, title: string, url: string) {
  const href = normalizeHttpUrl(url);
  const range = currentLink(editor);
  const from = range?.from ?? editor.state.selection.from;
  const to = range?.to ?? editor.state.selection.to;
  if (!href) {
    if (editor.isActive("link")) editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().insertContentAt({ from, to }, {
    type: "text",
    text: title.trim() || href,
    marks: [{
      type: "link",
      attrs: {
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "pagestorm-inline-link",
      },
    }],
  }).run();
}

export function PagestormLinkSheet({
  editor,
  frameRef,
  armed,
  onClose,
}: {
  editor: Editor;
  frameRef: RefObject<HTMLElement | null>;
  armed: boolean;
  onClose: () => void;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      link: currentLink(current),
      from: current.state.selection.from,
    }),
  });
  const link = snapshot?.link ?? null;
  const anchorFrom = link?.from ?? snapshot?.from ?? editor.state.selection.from;
  const sheetRef = useRef<HTMLDivElement>(null);
  const appliedRef = useRef(false);
  const [hiddenFor, setHiddenFor] = useState<number | null>(null);
  const open = (armed || link != null) && hiddenFor !== anchorFrom;
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const source = link ?? {
    from: anchorFrom,
    to: anchorFrom,
    title: "",
    url: "",
  };
  const key = `${source.from}:${source.to}:${source.url}:${source.title}`;
  const [seen, setSeen] = useState(key);
  const [title, setTitle] = useState(source.title);
  const [url, setUrl] = useState(source.url);
  if (seen !== key) {
    setSeen(key);
    setTitle(source.title);
    setUrl(source.url);
  }

  const commit = useCallback(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    applyPagestormLink(editor, title, url);
    setHiddenFor(anchorFrom);
    onClose();
  }, [anchorFrom, editor, onClose, title, url]);

  useEffect(() => {
    if (!open) {
      appliedRef.current = false;
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      if (event.target instanceof Node && sheet.contains(event.target)) return;
      commit();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [commit, open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const anchor = anchorFrom;
      let left = 0;
      let bottom = 0;
      try {
        const coords = editor.view.coordsAtPos(anchor);
        left = coords.left;
        bottom = coords.bottom;
      } catch {
        return;
      }
      const frameRect = frame.getBoundingClientRect();
      setPoint({
        x: Math.max(8, Math.min(left - frameRect.left, frame.clientWidth - 200)),
        y: Math.max(8, bottom - frameRect.top + 6),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorFrom, editor, frameRef, open]);

  if (!open || !point) return null;

  return (
    <div
      ref={sheetRef}
      className="pagestorm-link-sheet"
      style={{ left: point.x, top: point.y }}
      data-pagestorm-link-sheet=""
      onMouseDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        commit();
      }}
    >
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkPhrase}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
      <label className="block text-[10px] font-medium text-muted-foreground">
        {copy.linkUrl}
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
        />
      </label>
    </div>
  );
}
