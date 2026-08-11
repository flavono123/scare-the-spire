"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import Image from "@/components/ui/static-image";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { HistoryRunBlock } from "@/lib/chemical-types";
import {
  HISTORY_COURSE_RELIC_IMAGE,
  historyRunPrimaryLabel,
  historyRunShortCode,
} from "@/lib/history-run-reference";
import { isCoverSpec, type CoverSpec } from "@/lib/run-cover-types";

function coverSpecFromAttr(value: unknown): CoverSpec | null {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return isCoverSpec(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isCoverSpec(value) ? value : null;
}

function blockFromNode(node: NodeViewProps["node"]): HistoryRunBlock {
  return {
    type: "history-run",
    runId: (node.attrs.runId as string) || "",
    snapshot: {
      title: (node.attrs.title as string) || null,
      character: (node.attrs.character as string) || "",
      startTime: typeof node.attrs.startTime === "number" ? node.attrs.startTime : null,
      ascension: typeof node.attrs.ascension === "number" ? node.attrs.ascension : 0,
      win: node.attrs.win === true,
      totalFloors: typeof node.attrs.totalFloors === "number" ? node.attrs.totalFloors : 0,
      runTime: typeof node.attrs.runTime === "number" ? node.attrs.runTime : null,
      build: (node.attrs.build as string) || "",
      seed: (node.attrs.seed as string) || "",
      coverSpec: coverSpecFromAttr(node.attrs.coverSpec),
    },
  };
}

function HistoryRunReferenceNodeView({ node }: NodeViewProps) {
  const serviceLocale = useServiceLocale();
  const block = blockFromNode(node);

  return (
    <NodeViewWrapper
      as="span"
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/5 px-1.5 py-0.5 align-baseline text-xs font-semibold text-amber-100"
      data-history-run-reference=""
    >
      <Image
        src={HISTORY_COURSE_RELIC_IMAGE}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="truncate">
        {historyRunPrimaryLabel(block, serviceLocale)}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-amber-300/50">
        #{historyRunShortCode(block.runId)}
      </span>
    </NodeViewWrapper>
  );
}

/**
 * Optional atom installed only by editors that support History Course links.
 */
export const HistoryRunReferenceExtension = Node.create({
  name: "history-run-reference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      runId: { default: "" },
      title: { default: "" },
      character: { default: "" },
      startTime: { default: null },
      ascension: { default: 0 },
      win: { default: false },
      totalFloors: { default: 0 },
      runTime: { default: null },
      build: { default: "" },
      seed: { default: "" },
      coverSpec: {
        default: null,
        parseHTML: (element) => coverSpecFromAttr(element.getAttribute("data-cover-spec")),
        renderHTML: (attributes) => {
          const cover = coverSpecFromAttr(attributes.coverSpec);
          return cover ? { "data-cover-spec": JSON.stringify(cover) } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-history-run-reference]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const block = blockFromNode(node);
    const cover = coverSpecFromAttr(node.attrs.coverSpec);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-history-run-reference": "",
        class: "font-semibold text-amber-100",
        ...(cover ? { "data-cover-spec": JSON.stringify(cover) } : {}),
      }),
      `${historyRunPrimaryLabel(block, "ko")} #${historyRunShortCode(block.runId)}`,
    ];
  },

  renderText({ node }) {
    return historyRunPrimaryLabel(blockFromNode(node), "ko");
  },

  addNodeView() {
    return ReactNodeViewRenderer(HistoryRunReferenceNodeView, { as: "span" });
  },
});
