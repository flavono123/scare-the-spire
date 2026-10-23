"use client";

import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { ExternalLink } from "lucide-react";
import { useCallback, useMemo } from "react";
import { entityCompendiumHref, type EntityInfo } from "@/components/patch-note-renderer";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import {
  EXTERNAL_LINK_TEXT_CLASS,
  INTERNAL_LINK_TEXT_CLASS,
  isExternalHref,
} from "@/lib/service-link-classes";
import { isYouTubeVideoId, youtubeWatchUrl } from "@/lib/youtube-reference";
import { isSafeLinkHref } from "@/lib/link-reference";
import { serviceMessages } from "@/messages/service";
import { EDITOR_SUGGESTION_Z_INDEX } from "./suggestion-popup";
import { isModifiedClick, NEW_TAB_LINK_PROPS } from "./editor-link";

export type EditorLinkTarget = {
  href: string;
  label: string;
  kind: "entity" | "internal" | "external";
};

export type ResolveLinkEntity = (type: string, id: string) => EntityInfo | undefined;

/** The link behind a selected atom (internal link, YouTube chip, keyword, mention). */
export function selectedLinkTarget(
  editor: Editor,
  resolveEntity?: ResolveLinkEntity,
): EditorLinkTarget | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;
  const { node } = selection;
  const attrs = node.attrs as Record<string, unknown>;
  const text = (key: string) => String(attrs[key] ?? "");

  switch (node.type.name) {
    case "pagestormInternalLink": {
      const href = text("href");
      if (!href) return null;
      return { href, label: text("title") || text("label") || href, kind: "internal" };
    }
    case "link-reference": {
      const href = text("href");
      if (!isSafeLinkHref(href)) return null;
      return { href, label: text("title") || href, kind: "external" };
    }
    case "youtube-reference": {
      const videoId = text("videoId");
      if (!isYouTubeVideoId(videoId)) return null;
      return { href: youtubeWatchUrl(videoId), label: text("title") || "YouTube", kind: "external" };
    }
    case "custom-keyword":
    case "pagestormMention":
    case "entity-mention": {
      const id = node.type.name === "entity-mention" ? text("id") : text("entityId");
      const entity = id ? resolveEntity?.(text("entityType"), id) : undefined;
      const href = entity ? entityCompendiumHref(entity) : null;
      if (!entity || !href) return null;
      return { href, label: entity.nameKo, kind: "entity" };
    }
    default:
      return null;
  }
}

/** "Open in new tab" control shared by the link bubble and link sheets. */
export function LinkOpenAction({ href }: { href: string }) {
  const copy = serviceMessages[useServiceLocale()].editorLink;
  return (
    <a
      href={href}
      {...NEW_TAB_LINK_PROPS}
      title={copy.modifierHint}
      data-editor-link-open=""
      className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground pointer-coarse:px-2.5 pointer-coarse:py-1.5"
    >
      <ExternalLink className="h-3 w-3" aria-hidden />
      {copy.open}
    </a>
  );
}

const LABEL_CLASS: Record<EditorLinkTarget["kind"], string> = {
  entity: "spire-gold font-game-title",
  internal: INTERNAL_LINK_TEXT_CLASS,
  external: EXTERNAL_LINK_TEXT_CLASS,
};

const BUBBLE_ABOVE = { placement: "top", offset: 8, flip: true, shift: { padding: 8 } } as const;
// Entity hover cards open above the atom, so their bubble sits below it.
const BUBBLE_BELOW = { placement: "bottom", offset: 8, flip: true, shift: { padding: 8 } } as const;

/**
 * Second step of the editor link rule: selecting a linked atom shows where it
 * goes and an explicit "open in new tab". Entity atoms on touch screens skip
 * it because their tap preview already opens the page.
 */
export function EditorLinkBubble({
  editor,
  resolveEntity,
}: {
  editor: Editor;
  resolveEntity?: ResolveLinkEntity;
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const coarsePointer = useCoarsePointer();
  const target = useEditorState({
    editor,
    selector: ({ editor: current }) => selectedLinkTarget(current, resolveEntity),
  });
  const shouldShow = useCallback(({ editor: current }: { editor: Editor }) => {
    if (!current.isEditable) return false;
    const next = selectedLinkTarget(current, resolveEntity);
    return Boolean(next && !(next.kind === "entity" && coarsePointer));
  }, [coarsePointer, resolveEntity]);
  const options = target?.kind === "entity" ? BUBBLE_BELOW : BUBBLE_ABOVE;
  const href = useMemo(() => {
    if (!target) return "";
    return isExternalHref(target.href) || target.kind === "internal"
      ? target.href
      : localizeHrefWithGameLocale(target.href, serviceLocale, gameLocale);
  }, [gameLocale, serviceLocale, target]);

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      shouldShow={shouldShow}
      options={options}
      style={{ zIndex: EDITOR_SUGGESTION_Z_INDEX }}
      data-editor-link-bubble=""
    >
      {target ? (
        <div
          className="flex max-w-[min(22rem,calc(100vw-1rem))] items-center gap-2 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className={`min-w-0 truncate font-semibold ${LABEL_CLASS[target.kind]}`}>
            {target.label}
          </span>
          <LinkOpenAction href={href} />
        </div>
      ) : null}
    </BubbleMenu>
  );
}

/**
 * Link marks inside an editable document: a plain click only places the caret
 * (browsers would otherwise follow `target=_blank` even while editing), and
 * ⌘/Ctrl-click opens the link in a new tab. Node-view anchors handle their
 * own clicks with EDITOR_ANCHOR_PROPS.
 */
export const EditorLinkClicks = Extension.create({
  name: "editorLinkClicks",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("editor-link-clicks"),
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              if (!view.editable) return false;
              const anchor = event.target instanceof Element
                ? event.target.closest("a[href]")
                : null;
              if (!(anchor instanceof HTMLAnchorElement) || !view.dom.contains(anchor)) return false;
              if (anchor.closest(".react-renderer")) return false;
              event.preventDefault();
              if (isModifiedClick(event)) {
                window.open(anchor.href, "_blank", "noopener,noreferrer");
              }
              return true;
            },
          },
        },
      }),
    ];
  },
});
