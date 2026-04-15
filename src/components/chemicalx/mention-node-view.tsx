"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { useEntityMap } from "./entity-context";

export function MentionNodeView({ node }: NodeViewProps) {
  const entityMap = useEntityMap();
  const { id, label, entityType } = node.attrs;
  const entity = entityMap.get(`${entityType}:${id}`);

  if (entity) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <EntityPreview entity={entity}>
          {label}
        </EntityPreview>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="spire-gold font-semibold inline">
      {label}
    </NodeViewWrapper>
  );
}
