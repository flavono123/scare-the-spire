"use client";

import { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function KeywordNodeView({ node }: NodeViewProps) {
  const { text, description } = node.attrs;
  const [hover, setHover] = useState(false);

  return (
    <NodeViewWrapper
      as="span"
      className="relative inline spire-gold font-semibold cursor-help"
      style={{ overflow: "visible" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {text}
      {hover && description && (
        <span className="absolute top-full left-0 mt-1 w-48 bg-[#0a0a1a] border border-yellow-500/30 rounded px-2.5 py-2 text-left z-[100] pointer-events-none shadow-xl">
          <span className="font-bold text-yellow-400 text-xs block">{text}</span>
          <span className="text-[11px] text-gray-300 font-normal leading-relaxed block mt-0.5">{description}</span>
        </span>
      )}
    </NodeViewWrapper>
  );
}
