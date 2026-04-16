"use client";

import { useState, useRef, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { createPortal } from "react-dom";

export function KeywordNodeView({ node }: NodeViewProps) {
  const { text, description } = node.attrs;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!ref.current || !description) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 4 });
  }, [description]);

  const hide = useCallback(() => setPos(null), []);

  return (
    <NodeViewWrapper
      as="span"
      className="spire-gold font-semibold cursor-help"
    >
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide}>
        {text}
      </span>
      {pos && description && createPortal(
        <div
          className="fixed w-fit max-w-48 bg-[#0a0a1a] border border-yellow-500/30 rounded px-2.5 py-2 text-left z-[200] pointer-events-none shadow-xl"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="font-bold text-yellow-400 text-xs">{text}</div>
          <div className="text-[11px] text-gray-300 leading-relaxed mt-0.5">{description}</div>
        </div>,
        document.body,
      )}
    </NodeViewWrapper>
  );
}
