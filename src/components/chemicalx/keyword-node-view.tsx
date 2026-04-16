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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {text}
      {hover && description && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 bg-[#0a0a1a]/95 border border-yellow-500/30 rounded px-2 py-1.5 text-left z-50 pointer-events-none shadow-xl">
          <span className="font-bold text-yellow-400 text-[10px] block">{text}</span>
          <span className="text-[9px] text-gray-300 font-normal leading-relaxed not-italic">{description}</span>
        </span>
      )}
    </NodeViewWrapper>
  );
}
