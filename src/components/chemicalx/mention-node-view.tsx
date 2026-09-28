"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { useEntityLinks, useEntityMap } from "./entity-context";

export function MentionNodeView({ node }: NodeViewProps) {
  const entityMap = useEntityMap();
  const entityLinks = useEntityLinks();
  const { id, label, entityType } = node.attrs;
  const entity = entityMap.get(`${entityType}:${id}`);

  if (entity) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <EntityPreview entity={entity} disableLink={!entityLinks}>
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
