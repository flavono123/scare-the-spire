"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DefragmentComposer } from "@/components/defragment/defragment-composer";
import { DefragmentOverlayBodyEditor } from "@/components/defragment/defragment-overlay-body";
import Image from "@/components/ui/static-image";
import { insertChemicalPost } from "@/hooks/use-chemical-posts";
import { insertComboPost } from "@/hooks/use-combo-posts";
import {
  overlayBodyForSave,
  upsertDefragmentBody,
} from "@/hooks/use-defragment-bodies";
import { insertDefragmentPost } from "@/hooks/use-defragment-posts";
import { insertThisOrThatPost } from "@/hooks/use-this-or-that-posts";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import {
  insertTransfigurePost,
  type SaveTransfigurePostInput,
} from "@/hooks/use-transfigure-posts";
import type { PostBlock } from "@/lib/chemical-types";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_TOKEN_SRC,
  feedItemFromPost,
  type DefragmentFeedItem,
  type DefragmentFederatedService,
  type DefragmentFeedService,
} from "@/lib/defragment";
import type { GameLocale } from "@/lib/i18n";
import type { ThisOrThatResourceRef } from "@/lib/this-or-that";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";
import { useServiceLocale } from "@/hooks/use-service-locale";

const ComboEditor = dynamic(
  () => import("@/components/combo/combo-editor").then((mod) => mod.ComboEditor),
  { ssr: false },
);
const ChemicalXEditor = dynamic(
  () => import("@/components/chemicalx/chemicalx-editor").then((mod) => mod.ChemicalXEditor),
  { ssr: false },
);
const ThisOrThatComposerForm = dynamic(
  () => import("@/components/this-or-that/composer-form").then((mod) => mod.ThisOrThatComposerForm),
  { ssr: false },
);
const TransfigureComposerModal = dynamic(
  () => import("@/components/transfigure/transfigure-composer-modal").then(
    (mod) => mod.TransfigureComposerModal,
  ),
  { ssr: false },
);

const WRITE_TYPES: DefragmentFeedService[] = [
  "defragment",
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
];

export interface DefragmentWritePlaceholders {
  defragment: string;
  combo: string;
  chemicalX: string;
  thisOrThat: string;
}

export function DefragmentWritePanel({
  entities,
  gameLocale,
  placeholders,
  upgradeLabel,
  profileNickname,
  typeLabels,
  onCreated,
  onUnavailable,
  ensureUser,
  userId,
  authReady,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  placeholders: DefragmentWritePlaceholders;
  upgradeLabel: string;
  profileNickname: string;
  typeLabels: Record<DefragmentFeedService, string>;
  onCreated: (item: DefragmentFeedItem) => void;
  onUnavailable: () => void;
  ensureUser: () => Promise<string | null>;
  userId: string | null;
  authReady: boolean;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [writeType, setWriteType] = useState<DefragmentFeedService>("defragment");
  const [overlayBlocks, setOverlayBlocks] = useState<PostBlock[]>([]);
  const [transfigureOpen, setTransfigureOpen] = useState(false);
  const [totSubmitting, setTotSubmitting] = useState(false);
  const totResources = useThisOrThatEntities(gameLocale);

  const readNickname = useCallback(() => {
    return nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
  }, [copy.defaultNickname, profileNickname]);

  const saveOverlay = useCallback(async (
    service: DefragmentFederatedService,
    sourceId: string,
    nickname: string,
    activeUserId: string,
  ) => {
    const parsed = overlayBodyForSave(overlayBlocks);
    if (parsed === "invalid") throw new Error("defragment overlay body invalid");
    if (!parsed) return;
    await upsertDefragmentBody({
      service,
      sourceId,
      blocks: parsed.blocks,
      nickname,
      activeUserId,
    });
  }, [overlayBlocks]);

  const handleNativeSubmit = useCallback(async (input: {
    title: string;
    blocks: PostBlock[];
    nickname: string;
  }) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    try {
      const post = await insertDefragmentPost({
        title: input.title,
        blocks: input.blocks,
        nickname: readNickname(),
        activeUserId,
      });
      if (!post) return;
      onCreated(feedItemFromPost("defragment", post));
    } catch {
      onUnavailable();
    }
  }, [ensureUser, onCreated, onUnavailable, readNickname, userId]);

  const handleComboSubmit = useCallback(async (blocks: PostBlock[], _nickname: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const nickname = readNickname();
    if (overlayBodyForSave(overlayBlocks) === "invalid") {
      throw new Error("defragment overlay body invalid");
    }
    try {
      const post = await insertComboPost({ blocks, nickname, activeUserId });
      if (!post) return;
      await saveOverlay("combo", post.id, nickname, activeUserId);
      onCreated(feedItemFromPost("combo", post));
    } catch (error) {
      onUnavailable();
      throw error;
    }
  }, [ensureUser, onCreated, onUnavailable, overlayBlocks, readNickname, saveOverlay, userId]);

  const handleChemicalSubmit = useCallback(async (blocks: PostBlock[], _nickname: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const nickname = readNickname();
    if (overlayBodyForSave(overlayBlocks) === "invalid") {
      throw new Error("defragment overlay body invalid");
    }
    try {
      const post = await insertChemicalPost(blocks, nickname, activeUserId);
      if (!post) return;
      await saveOverlay("chemical_x", post.id, nickname, activeUserId);
      onCreated(feedItemFromPost("chemical_x", post));
    } catch (error) {
      onUnavailable();
      throw error;
    }
  }, [ensureUser, onCreated, onUnavailable, overlayBlocks, readNickname, saveOverlay, userId]);

  const handleTotSubmit = useCallback(async (input: {
    left: ThisOrThatResourceRef;
    right: ThisOrThatResourceRef;
    reason: string;
  }) => {
    setTotSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return false;
      const nickname = readNickname();
      if (overlayBodyForSave(overlayBlocks) === "invalid") return false;
      const post = await insertThisOrThatPost({
        ...input,
        nickname,
        activeUserId,
      });
      if (!post) return false;
      await saveOverlay("this_or_that", post.id, nickname, activeUserId);
      onCreated(feedItemFromPost("this_or_that", post));
      return true;
    } catch {
      onUnavailable();
      return false;
    } finally {
      setTotSubmitting(false);
    }
  }, [ensureUser, onCreated, onUnavailable, overlayBlocks, readNickname, saveOverlay, userId]);

  const handleTransfigureSubmit = useCallback(async (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const nickname = readNickname();
    if (overlayBodyForSave(overlayBlocks) === "invalid") {
      throw new Error("defragment overlay body invalid");
    }
    try {
      const post = await insertTransfigurePost({
        ...input,
        nickname,
        activeUserId,
      });
      if (!post) return;
      await saveOverlay("transfigure", post.id, nickname, activeUserId);
      onCreated(feedItemFromPost("transfigure", post));
      setTransfigureOpen(false);
    } catch (error) {
      onUnavailable();
      throw error;
    }
  }, [ensureUser, onCreated, onUnavailable, overlayBlocks, readNickname, saveOverlay, userId]);

  const overlay = writeType !== "defragment" ? (
    <DefragmentOverlayBodyEditor
      entities={entities}
      placeholder={placeholders.defragment}
      draftKey={`sts-defragment-overlay:${writeType}`}
      onBlocksChange={setOverlayBlocks}
    />
  ) : null;

  const typeChips = useMemo(() => WRITE_TYPES.map((service) => {
    const selected = writeType === service;
    return (
      <button
        key={service}
        type="button"
        data-defragment-type-chip={service}
        aria-pressed={selected}
        onClick={() => {
          setWriteType(service);
          setOverlayBlocks([]);
          setTransfigureOpen(false);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
          selected
            ? "border-yellow-400/50 bg-yellow-500/15 text-yellow-100"
            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-yellow-400/30 hover:text-zinc-200",
        )}
      >
        <Image
          src={service === "defragment"
            ? DEFRAGMENT_TOKEN_SRC
            : DEFRAGMENT_FEED_SERVICE_META[service].tokenSrc}
          alt=""
          width={14}
          height={14}
          className="size-3.5 object-contain"
        />
        {typeLabels[service]}
      </button>
    );
  }), [typeLabels, writeType]);

  return (
    <div className="space-y-3" data-defragment-write-panel>
      <div className="overflow-visible rounded-lg border border-border bg-card/30 px-3 py-2">
        <input
          key={profileNickname}
          ref={nicknameInputRef}
          type="text"
          defaultValue={profileNickname}
          placeholder={copy.nicknamePlaceholder}
          maxLength={20}
          className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">{typeChips}</div>

      {writeType === "defragment" && (
        <DefragmentComposer
          entities={entities}
          placeholder={placeholders.defragment}
          profileNickname={readNickname()}
          submitLabel={copy.submit}
          draftKey="sts-defragment-draft"
          hideNickname
          onSubmit={handleNativeSubmit}
        />
      )}

      {writeType === "combo" && (
        <>
          <ComboEditor
            entities={entities}
            placeholder={placeholders.combo}
            profileNickname={readNickname()}
            serviceLocale={serviceLocale}
            hideNickname
            draftKey="sts-defragment-combo-draft"
            onSubmit={handleComboSubmit}
          />
          {overlay}
        </>
      )}

      {writeType === "chemical_x" && (
        <>
          <ChemicalXEditor
            entities={entities}
            placeholder={placeholders.chemicalX}
            profileNickname={readNickname()}
            hideNickname
            draftKey="sts-defragment-chemical-draft"
            onSubmit={handleChemicalSubmit}
          />
          {overlay}
        </>
      )}

      {writeType === "this_or_that" && (
        <>
          <div className="overflow-visible rounded-lg border border-border bg-card/30">
            <ThisOrThatComposerForm
              entities={totResources.entities}
              gameLocale={gameLocale}
              placeholder={placeholders.thisOrThat}
              authReady={authReady && !totResources.loading && !totResources.error}
              storageUnavailable={Boolean(totResources.error)}
              submitting={totSubmitting}
              onSubmit={handleTotSubmit}
            />
          </div>
          {overlay}
        </>
      )}

      {writeType === "transfigure" && (
        <>
          <button
            type="button"
            onClick={() => setTransfigureOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-300/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-100"
          >
            <Image
              src={DEFRAGMENT_FEED_SERVICE_META.transfigure.tokenSrc}
              alt=""
              width={16}
              height={16}
              className="object-contain"
            />
            {copy.openTransfigure}
          </button>
          {overlay}
          {transfigureOpen && (
            <TransfigureComposerModal
              entities={entities}
              gameLocale={gameLocale}
              profileNickname={readNickname()}
              serviceLocale={serviceLocale}
              upgradeLabel={upgradeLabel}
              hideNickname
              onSubmit={handleTransfigureSubmit}
              onClose={() => setTransfigureOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
