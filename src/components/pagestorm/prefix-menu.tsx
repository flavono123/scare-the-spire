"use client";

import { PluginKey } from "@tiptap/pm/state";
import {
  BraceKeywordSuggestion,
  findBraceKeywordMatch,
} from "@/components/chemicalx/brace-keyword-suggestion";
import { MentionList } from "@/components/chemicalx/mention-list";
import { suggestionPopupRender } from "@/components/editor/suggestion-popup";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { rankPagestormReferences } from "@/lib/pagestorm-reference";
import { findPagestormEntity } from "./entities-context";

export const pagestormBracePluginKey = new PluginKey("pagestorm-brace-portrait");

export function createPagestormBraceSuggestion(options: {
  getEntities: () => EntityInfo[];
  getSts1Entities: () => EntityInfo[];
  onPick: (payload: { entity: EntityInfo; range: { from: number; to: number } }) => void;
}) {
  return BraceKeywordSuggestion.configure({
    suggestion: {
      pluginKey: pagestormBracePluginKey,
      char: "",
      allowSpaces: false,
      allowedPrefixes: null,
      // `display{query` like comments: the text before the brace stays visible.
      findSuggestionMatch: findBraceKeywordMatch,
      items: ({ query }) => {
        const sts2 = options.getEntities();
        const sts1 = options.getSts1Entities();
        const trimmed = query.trim();
        if (!trimmed) return sts2.filter((entity) => entity.imageUrl).slice(0, 8);
        return rankPagestormReferences(trimmed, sts2, sts1);
      },
      command: ({ range, props }) => {
        const item = props as unknown as EntityInfo;
        const entity = findPagestormEntity(
          options.getEntities(),
          item.type ?? (item as { entityType?: EntityInfo["type"] }).entityType,
          String(item.id ?? ""),
        ) ?? item;
        if (!entity?.id) return;
        options.onPick({ entity, range });
      },
      render: suggestionPopupRender({
        component: MentionList,
        pluginKey: pagestormBracePluginKey,
        name: "pagestorm-brace",
        commitKeys: ["}"],
      }),
    },
  });
}
