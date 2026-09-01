"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { NavDropdownItem } from "@/lib/site-nav-items";
import { parseYouTubeVideoId, resolveYouTubeReference } from "@/lib/youtube-reference";
import { serviceMessages } from "@/messages/service";
import {
  PagestormColor,
  PagestormJitter,
  PagestormSine,
} from "./color-marks";
import { PagestormEntitiesProvider } from "./entities-context";
import {
  CardBraceConfirmModal,
  CompendiumPickerModal,
  ToyboxPickerModal,
  majorFromCodexHref,
  type CompendiumInsertPayload,
} from "./pickers";
import { createPagestormBraceSuggestion, pagestormBracePluginKey } from "./prefix-menu";
import { assetFromEntity } from "./sample";
import {
  GameAssetNode,
  OgBookmarkNode,
  ToyboxEmbedNode,
  YoutubePlayerNode,
  gameAssetAttrs,
} from "./tiptap-nodes";
import { PagestormStickyToolbar } from "./toolbar";
import type { PagestormToyboxPost } from "./toybox-samples";
import "./pagestorm-editor.css";

type PendingCard = {
  entity: EntityInfo;
  range?: { from: number; to: number };
};

const EMPTY_DOC = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

export function PagestormEditor() {
  const { entities } = useCommentEntities();
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const entitiesRef = useRef(entities);
  const [compendiumMajor, setCompendiumMajor] = useState<ReturnType<typeof majorFromCodexHref> | "closed">("closed");
  const [toyboxHref, setToyboxHref] = useState<string | null | "closed">("closed");
  const [pendingCard, setPendingCard] = useState<PendingCard | null>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  /* eslint-disable react-hooks/refs -- suggestion getters run on keystroke, not render */
  const brace = useMemo(
    () => createPagestormBraceSuggestion({
      getEntities: () => entitiesRef.current,
      onPick: ({ entity, range }) => {
        const current = editorRef.current;
        if (current) exitSuggestion(current.view, pagestormBracePluginKey);
        if (entity.type === "card") {
          setPendingCard({ entity, range });
          return;
        }
        insertEntity(entity, { presentation: "art", beta: false }, range);
      },
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const editor = useEditor({
    immediatelyRender: false,
    content: EMPTY_DOC,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      PagestormColor,
      PagestormSine,
      PagestormJitter,
      GameAssetNode,
      YoutubePlayerNode,
      OgBookmarkNode,
      ToyboxEmbedNode,
      brace,
    ],
    editorProps: {
      attributes: {
        class: "pagestorm-mock-editor",
      },
      handlePaste: (_view, event) => {
        const pastedText = event.clipboardData?.getData("text/plain").trim() ?? "";
        const videoId = parseYouTubeVideoId(pastedText);
        if (!videoId) return false;
        const pendingLabel = copy.youtubePending;
        event.preventDefault();
        const current = editorRef.current;
        if (!current) return true;
        current.chain().focus().insertContent([
          {
            type: "youtubePlayer",
            attrs: { videoId, title: pendingLabel, align: "center" },
          },
          { type: "paragraph" },
        ]).run();
        void resolveYouTubeReference(pastedText)
          .then((reference) => {
            const current = editorRef.current;
            if (!current || current.isDestroyed) return;
            current.view.state.doc.descendants((node, position) => {
              if (
                node.type.name === "youtubePlayer"
                && node.attrs.videoId === videoId
                && node.attrs.title === pendingLabel
              ) {
                current.view.dispatch(current.view.state.tr.setNodeMarkup(position, undefined, {
                  ...node.attrs,
                  videoId: reference.videoId,
                  title: reference.title,
                }));
              }
            });
          })
          .catch(() => undefined);
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  function insertEntity(
    entity: EntityInfo,
    options: { presentation: CompendiumInsertPayload["presentation"]; beta: boolean },
    range?: { from: number; to: number },
  ) {
    const current = editorRef.current;
    if (!current) return;
    const chain = current.chain().focus();
    if (range) chain.deleteRange(range);
    chain.insertContent([
      { type: "gameAsset", attrs: gameAssetAttrs(assetFromEntity(entity), options) },
      { type: "paragraph" },
    ]).run();
  }

  function insertToybox(post: PagestormToyboxPost) {
    const current = editorRef.current;
    if (!current) return;
    current.chain().focus().insertContent([
      {
        type: "toyboxEmbed",
        attrs: {
          postId: post.id,
          service: post.service,
          align: "center",
          linked: true,
          width: 576,
          height: post.service === "/this-or-that" ? 320 : 280,
        },
      },
      { type: "paragraph" },
    ]).run();
  }

  function onCompendium(item: NavDropdownItem) {
    setCompendiumMajor(majorFromCodexHref(item.href));
  }

  function onToybox(item: NavDropdownItem) {
    setToyboxHref(item.href.replace(/^\/(?:en)(?=\/)/, ""));
  }

  if (!editor) {
    return <p className="p-4 text-sm text-muted-foreground">{copy.editorLoading}</p>;
  }

  return (
    <PagestormEntitiesProvider entities={entities}>
      <div className="overflow-visible rounded-lg border border-border bg-card">
        <PagestormStickyToolbar
          editor={editor}
          onCompendium={onCompendium}
          onToybox={onToybox}
        />
        <EditorContent editor={editor} />
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {copy.braceHint}
        </p>
      </div>
      {compendiumMajor !== "closed" ? (
        <CompendiumPickerModal
          entities={entities}
          initialMajor={compendiumMajor}
          onClose={() => setCompendiumMajor("closed")}
          onInsert={(payload) => {
            insertEntity(payload.entity, payload);
            setCompendiumMajor("closed");
          }}
        />
      ) : null}
      {toyboxHref !== "closed" ? (
        <ToyboxPickerModal
          initialServiceHref={toyboxHref}
          onClose={() => setToyboxHref("closed")}
          onInsert={(post) => {
            insertToybox(post);
            setToyboxHref("closed");
          }}
        />
      ) : null}
      {pendingCard ? (
        <CardBraceConfirmModal
          entity={pendingCard.entity}
          onClose={() => setPendingCard(null)}
          onInsert={(payload) => {
            insertEntity(payload.entity, payload, pendingCard.range);
            setPendingCard(null);
          }}
        />
      ) : null}
    </PagestormEntitiesProvider>
  );
}
