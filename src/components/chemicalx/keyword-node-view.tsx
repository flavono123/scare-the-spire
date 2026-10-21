"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
import { useEntityLinks, useEntityMap } from "./entity-context";
import { selectAtomOnClick } from "@/components/editor/editor-link";

export function KeywordNodeView({ editor, getPos, node }: NodeViewProps) {
  const selectOnClick = (event: React.MouseEvent<HTMLElement>) => selectAtomOnClick(editor, getPos, event);
  const { text, keyword, description, entityId, entityType } = node.attrs;
  const entityMap = useEntityMap();
  const entityLinks = useEntityLinks();
  const entity = entityId && entityType ? entityMap.get(`${entityType}:${entityId}`) : undefined;
  const title = keyword || text;

  return (
    <NodeViewWrapper
      onClick={selectOnClick}
      as="span"
      className="spire-gold font-semibold cursor-help"
    >
      {entity ? (
        <EntityPreview entity={entity} disableLink={!entityLinks} editorLink>{text}</EntityPreview>
      ) : (
        <KeywordHoverTip title={title} description={description ?? ""}>
          {text}
        </KeywordHoverTip>
      )}
    </NodeViewWrapper>
  );
}
