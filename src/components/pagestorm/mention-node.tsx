"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
import { usePagestormEntityMap } from "./entities-context";

function hasRichPreview(entity: { cardData?: unknown; relicData?: unknown; potionData?: unknown; powerData?: unknown; monsterData?: unknown; eventData?: unknown; characterData?: unknown; ancientData?: unknown; enchantmentData?: unknown }): boolean {
  return Boolean(
    entity.cardData
    || entity.relicData
    || entity.potionData
    || entity.powerData
    || entity.monsterData
    || entity.eventData
    || entity.characterData
    || entity.ancientData
    || entity.enchantmentData,
  );
}

function PagestormMentionView({ node }: NodeViewProps) {
  const entityMap = usePagestormEntityMap();
  const text = String(node.attrs.text ?? "");
  const entity = entityMap.get(`${node.attrs.entityType}:${node.attrs.entityId}`);
  if (entity && hasRichPreview(entity)) {
    return (
      <NodeViewWrapper as="span" className="inline font-semibold spire-gold">
        <EntityPreview entity={entity}>{text}</EntityPreview>
      </NodeViewWrapper>
    );
  }
  if (entity?.href) {
    const description = String(node.attrs.description ?? "") || entity.nameEn;
    return (
      <NodeViewWrapper as="span" className="inline">
        <KeywordHoverTip title={entity.nameKo} description={description}>
          <a href={entity.href} className="font-game-title font-semibold spire-gold no-underline">
            {text}
          </a>
        </KeywordHoverTip>
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper as="span" className="inline font-semibold spire-gold">
      {text}
    </NodeViewWrapper>
  );
}

export const PagestormMention = Node.create({
  name: "pagestormMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: "" },
      keyword: { default: "" },
      description: { default: "" },
      entityId: { default: "" },
      entityType: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-pagestorm-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-pagestorm-mention": "",
        "data-entity-id": node.attrs.entityId,
        "data-entity-type": node.attrs.entityType,
        class: "spire-gold font-semibold",
      }),
      node.attrs.text as string,
    ];
  },

  renderText({ node }) {
    return String(node.attrs.text ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(PagestormMentionView, { as: "span" });
  },
});
