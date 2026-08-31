"use client";

import dynamic from "next/dynamic";
import { PagestormEditorShell } from "./shell";
import {
  pagestormEditorVariant,
  type PagestormEditorVariantId,
} from "./variants";

const loading = () => <p className="text-sm text-muted-foreground">목 로딩…</p>;

const editors = {
  "tiptap-toolbar": dynamic(
    async () => {
      const mod = await import("./tiptap-mock");
      return function TiptapToolbarMock() {
        return <mod.TiptapPagestormMock chrome="toolbar" />;
      };
    },
    { ssr: false, loading },
  ),
  "tiptap-bubble": dynamic(
    async () => {
      const mod = await import("./tiptap-mock");
      return function TiptapBubbleMock() {
        return <mod.TiptapPagestormMock chrome="bubble" />;
      };
    },
    { ssr: false, loading },
  ),
  blocknote: dynamic(
    async () => {
      const mod = await import("./blocknote-mock");
      return mod.BlockNotePagestormMock;
    },
    { ssr: false, loading },
  ),
  lexical: dynamic(
    async () => {
      const mod = await import("./lexical-mock");
      return mod.LexicalPagestormMock;
    },
    { ssr: false, loading },
  ),
  vanilla: dynamic(
    async () => {
      const mod = await import("./vanilla-mock");
      return mod.VanillaPagestormMock;
    },
    { ssr: false, loading },
  ),
} satisfies Record<PagestormEditorVariantId, ReturnType<typeof dynamic>>;

export default function PagestormEditorVariantPage({
  variantId,
}: {
  variantId: PagestormEditorVariantId;
}) {
  const variant = pagestormEditorVariant(variantId);
  const Editor = editors[variantId];
  return (
    <PagestormEditorShell variantId={variantId}>
      <section className="rounded-lg border border-border bg-card/20 p-4">
        <h2 className="font-game-title text-lg">{variant.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{variant.engine}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{variant.chrome}</p>
      </section>
      <Editor />
    </PagestormEditorShell>
  );
}
