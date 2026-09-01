"use client";

import { useMemo, useRef, useState } from "react";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion } from "@tiptap/suggestion";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { NavDropdownItem } from "@/lib/site-nav-items";
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
import { TIPTAP_SEED } from "./tiptap-seed";
import {
  GameAssetNode,
  OgBookmarkNode,
  ToyboxEmbedNode,
  YoutubePlayerNode,
  gameAssetAttrs,
} from "./tiptap-nodes";
import { PagestormFormatChrome, PagestormStickyToolbar } from "./toolbar";
import type { PagestormToyboxPost } from "./toybox-samples";
import "./pagestorm-mock-editor.css";

type PendingCard = {
  entity: EntityInfo;
  range?: { from: number; to: number };
};

export function TiptapPagestormMock(_props?: { chrome?: "toolbar" | "bubble" }) {
  const { entities } = useCommentEntities();
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestormEditor;
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const [compendiumMajor, setCompendiumMajor] = useState<ReturnType<typeof majorFromCodexHref> | "closed">("closed");
  const [toyboxHref, setToyboxHref] = useState<string | null | "closed">("closed");
  const [pendingCard, setPendingCard] = useState<PendingCard | null>(null);

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

  const editor = useEditor({
    immediatelyRender: false,
    content: TIPTAP_SEED,
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
    },
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

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
    return <p className="p-4 text-sm text-muted-foreground">에디터 준비 중…</p>;
  }

  return (
    <PagestormEntitiesProvider entities={entities}>
      <div className="rounded-lg border border-border bg-card/20">
        <PagestormStickyToolbar
          editor={editor}
          onCompendium={onCompendium}
          onToybox={onToybox}
        />
        <BubbleMenu editor={editor} className="pagestorm-mock-bubble">
          <PagestormFormatChrome
            editor={editor}
            onCompendium={onCompendium}
            onToybox={onToybox}
          />
        </BubbleMenu>
        <FloatingMenu editor={editor} className="pagestorm-mock-bubble">
          <PagestormFormatChrome
            editor={editor}
            onCompendium={onCompendium}
            onToybox={onToybox}
          />
        </FloatingMenu>
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
