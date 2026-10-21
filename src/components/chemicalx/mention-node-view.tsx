"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { useEntityLinks, useEntityMap } from "./entity-context";
import { selectAtomOnClick } from "@/components/editor/editor-link";

export function MentionNodeView({ editor, getPos, node }: NodeViewProps) {
  const selectOnClick = (event: React.MouseEvent<HTMLElement>) => selectAtomOnClick(editor, getPos, event);
  const entityMap = useEntityMap();
  const entityLinks = useEntityLinks();
  const { id, label, entityType } = node.attrs;
  const entity = entityMap.get(`${entityType}:${id}`);

  if (entity) {
    return (
      <NodeViewWrapper
      onClick={selectOnClick} as="span" className="inline">
        <EntityPreview entity={entity} disableLink={!entityLinks} editorLink>
          {label}
        </EntityPreview>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      onClick={selectOnClick} as="span" className="spire-gold font-semibold inline">
      {label}
    </NodeViewWrapper>
  );
}
