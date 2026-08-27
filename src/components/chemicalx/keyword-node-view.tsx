"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
import { useEntityMap } from "./entity-context";

export function KeywordNodeView({ node }: NodeViewProps) {
  const { text, keyword, description, entityId, entityType } = node.attrs;
  const entityMap = useEntityMap();
  const entity = entityId && entityType ? entityMap.get(`${entityType}:${entityId}`) : undefined;
  const title = keyword || text;

  return (
    <NodeViewWrapper
      as="span"
      className="spire-gold font-semibold cursor-help"
    >
      {entity ? (
        <EntityPreview entity={entity}>{text}</EntityPreview>
      ) : (
        <KeywordHoverTip title={title} description={description ?? ""}>
          {text}
        </KeywordHoverTip>
      )}
    </NodeViewWrapper>
  );
}
