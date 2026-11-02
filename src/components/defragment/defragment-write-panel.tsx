"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DecisionsDecisionsComposerValues } from "@/components/decisions-decisions/decisions-decisions-composer";
import type { FavoriteTournamentComposerValues } from "@/components/this-or-that/favorite-tournament-composer";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DefragmentOverlayBodyEditor } from "@/components/defragment/defragment-overlay-body";
import Image from "@/components/ui/static-image";
import { insertChemicalPost } from "@/hooks/use-chemical-posts";
import { insertComboPost } from "@/hooks/use-combo-posts";
import {
  overlayBodyForSave,
  upsertDefragmentBody,
} from "@/hooks/use-defragment-bodies";
import { insertDecisionsDecisionsPost } from "@/hooks/use-decisions-decisions-posts";
import { insertFavoriteTournamentPost } from "@/hooks/use-favorite-tournament-posts";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import { insertPagestormPost } from "@/hooks/use-pagestorm-posts";
import { insertThisOrThatPost } from "@/hooks/use-this-or-that-posts";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import {
  insertTransfigurePost,
  type SaveTransfigurePostInput,
} from "@/hooks/use-transfigure-posts";
import type { DecisionsDecisionsGameCopy } from "@/lib/borrowed-game-copy";
import type { PostBlock } from "@/lib/chemical-types";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_WRITE_SERVICES,
  feedItemFromPost,
  type DefragmentFeedItem,
  type DefragmentWriteService,
} from "@/lib/defragment";
import { isDatabaseRejection, submitDefragmentPost } from "@/lib/defragment-submit";
import type { GameLocale } from "@/lib/i18n";
import type { ThisOrThatResourceRef } from "@/lib/this-or-that";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { PagestormEditorSaveInput } from "@/components/pagestorm/pagestorm-editor";

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
const DecisionsDecisionsComposer = dynamic(
  () => import("@/components/decisions-decisions/decisions-decisions-composer").then(
    (mod) => mod.DecisionsDecisionsComposer,
  ),
  { ssr: false },
);
const FavoriteTournamentComposer = dynamic(
  () => import("@/components/this-or-that/favorite-tournament-composer").then(
    (mod) => mod.FavoriteTournamentComposer,
  ),
  { ssr: false },
);
const PagestormEditor = dynamic(
  () => import("@/components/pagestorm/pagestorm-editor").then((mod) => mod.PagestormEditor),
  { ssr: false },
);

const PRIMARY_DRAFT_KEYS: Partial<Record<DefragmentWriteService, string>> = {
  combo: "sts-defragment-combo-draft",
  chemical_x: "sts-defragment-chemical-draft",
};

function overlayDraftKey(service: DefragmentWriteService) {
  return `sts-defragment-overlay:${service}`;
}

function clearOverlayDraft(service: DefragmentWriteService) {
  sessionStorage.removeItem(overlayDraftKey(service));
}

/**
 * The editor clears its own draft after a save, but this panel can unmount it
 * first, and a draft left behind would post the same text again after a reload.
 */
function clearPrimaryDraft(service: DefragmentWriteService) {
  const key = PRIMARY_DRAFT_KEYS[service];
  if (key) sessionStorage.removeItem(key);
}

type FeedPost = Parameters<typeof feedItemFromPost>[1];

/** A saved post whose overlay failed: only the overlay may be sent again. */
interface PendingOverlay {
  service: DefragmentWriteService;
  sourceId: string;
  nickname: string;
  activeUserId: string;
}

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
  decisionsCopy,
  onCreated,
  onClose,
  ensureUser,
  userId,
  authReady,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  placeholders: DefragmentWritePlaceholders;
  upgradeLabel: string;
  profileNickname: string;
  typeLabels: Record<DefragmentWriteService, string>;
  decisionsCopy: DecisionsDecisionsGameCopy;
  onCreated: (item: DefragmentFeedItem) => void;
  onClose: () => void;
  ensureUser: () => Promise<string | null>;
  userId: string | null;
  authReady: boolean;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [writeType, setWriteType] = useState<DefragmentWriteService>("combo");
  const [overlayBlocks, setOverlayBlocks] = useState<PostBlock[]>([]);
  const [transfigureOpen, setTransfigureOpen] = useState(false);
  const [totSubmitting, setTotSubmitting] = useState(false);
  const [pagestormTitle, setPagestormTitle] = useState("");
  const [pagestormSubmitting, setPagestormSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeRevealRequest, setNoticeRevealRequest] = useState(0);
  const [pendingOverlay, setPendingOverlay] = useState<PendingOverlay | null>(null);
  const [retryingOverlay, setRetryingOverlay] = useState(false);
  const totResources = useThisOrThatEntities(gameLocale);
  const decisionsCatalog = useDecisionsDecisionsCatalog(gameLocale, { includeLegacy: true });

  const readNickname = useCallback(() => {
    return nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
  }, [copy.defaultNickname, profileNickname]);

  const overlayInvalid = overlayBodyForSave(overlayBlocks) === "invalid";
  const visibleNotice = notice === copy.overlayBodyInvalid && !overlayInvalid ? null : notice;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setNoticeRevealRequest((request) => request + 1);
  }, []);

  // A long composer can push the notice below the visible part of the panel.
  // Every refused attempt reveals it, even when the message has not changed.
  useEffect(() => {
    noticeRef.current?.scrollIntoView({ block: "nearest" });
  }, [noticeRevealRequest]);

  const saveOverlay = useCallback(async (
    service: DefragmentWriteService,
    sourceId: string,
    nickname: string,
    activeUserId: string,
  ) => {
    const parsed = overlayBodyForSave(overlayBlocks);
    if (!parsed) return;
    if (parsed === "invalid") throw new Error("defragment overlay body invalid");
    await upsertDefragmentBody({
      service,
      sourceId,
      blocks: parsed.blocks,
      nickname,
      activeUserId,
    });
  }, [overlayBlocks]);

  /** Resolves true once the post exists, whether or not its overlay followed. */
  const submitPost = useCallback(async <TPost extends FeedPost>(
    service: DefragmentWriteService,
    insertPost: (author: { nickname: string; activeUserId: string }) => Promise<TPost | null>,
  ): Promise<boolean> => {
    setNotice(null);
    const nickname = readNickname();
    const outcome = await submitDefragmentPost<TPost>({
      overlayInvalid,
      resolveUserId: async () => userId ?? await ensureUser(),
      insertPost: (activeUserId) => insertPost({ nickname, activeUserId }),
      saveOverlay: (post, activeUserId) => saveOverlay(service, post.id, nickname, activeUserId),
    });

    switch (outcome.kind) {
      case "overlay-invalid":
        showNotice(copy.overlayBodyInvalid);
        return false;
      case "post-failed":
        showNotice(outcome.rejected ? copy.postRejected : copy.postSaveFailed);
        return false;
      case "overlay-failed":
        // The post stays in the feed and its draft goes, so a reload cannot post it twice.
        onCreated(feedItemFromPost(service, outcome.post));
        clearPrimaryDraft(service);
        setPendingOverlay({
          service,
          sourceId: outcome.post.id,
          nickname,
          activeUserId: outcome.activeUserId,
        });
        showNotice(outcome.rejected ? copy.overlayRejected : copy.overlaySaveFailed);
        return true;
      case "saved":
        onCreated(feedItemFromPost(service, outcome.post));
        clearPrimaryDraft(service);
        clearOverlayDraft(service);
        onClose();
        return true;
    }
  }, [
    copy.overlayBodyInvalid,
    copy.overlayRejected,
    copy.overlaySaveFailed,
    copy.postRejected,
    copy.postSaveFailed,
    ensureUser,
    onClose,
    onCreated,
    overlayInvalid,
    readNickname,
    saveOverlay,
    showNotice,
    userId,
  ]);

  const handleRetryOverlay = useCallback(async () => {
    if (!pendingOverlay || retryingOverlay) return;
    if (overlayInvalid) {
      showNotice(copy.overlayBodyInvalid);
      return;
    }
    setRetryingOverlay(true);
    setNotice(null);
    try {
      await saveOverlay(
        pendingOverlay.service,
        pendingOverlay.sourceId,
        pendingOverlay.nickname,
        pendingOverlay.activeUserId,
      );
      clearOverlayDraft(pendingOverlay.service);
      onClose();
    } catch (error) {
      showNotice(isDatabaseRejection(error) ? copy.overlayRejected : copy.overlaySaveFailed);
    } finally {
      setRetryingOverlay(false);
    }
  }, [
    copy.overlayBodyInvalid,
    copy.overlayRejected,
    copy.overlaySaveFailed,
    onClose,
    overlayInvalid,
    pendingOverlay,
    retryingOverlay,
    saveOverlay,
    showNotice,
  ]);

  const handleSkipOverlay = useCallback(() => {
    if (pendingOverlay) clearOverlayDraft(pendingOverlay.service);
    onClose();
  }, [onClose, pendingOverlay]);

  const handleComboSubmit = useCallback(async (blocks: PostBlock[]) => {
    const saved = await submitPost("combo", (author) => insertComboPost({ blocks, ...author }));
    return saved ? undefined : false as const;
  }, [submitPost]);

  const handleChemicalSubmit = useCallback(async (blocks: PostBlock[]) => {
    const saved = await submitPost("chemical_x", ({ nickname, activeUserId }) => (
      insertChemicalPost(blocks, nickname, activeUserId)
    ));
    return saved ? undefined : false as const;
  }, [submitPost]);

  const handleTotSubmit = useCallback(async (input: {
    left: ThisOrThatResourceRef;
    right: ThisOrThatResourceRef;
    reason: string;
  }) => {
    setTotSubmitting(true);
    try {
      return await submitPost("this_or_that", (author) => (
        insertThisOrThatPost({ ...input, ...author })
      ));
    } finally {
      setTotSubmitting(false);
    }
  }, [submitPost]);

  const handleTransfigureOpen = useCallback(() => {
    // The modal covers the overlay editor, so refuse a bad overlay before it opens.
    if (overlayInvalid) {
      showNotice(copy.overlayBodyInvalid);
      return;
    }
    setNotice(null);
    setTransfigureOpen(true);
  }, [copy.overlayBodyInvalid, overlayInvalid, showNotice]);

  const handleTransfigureSubmit = useCallback(async (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => {
    const saved = await submitPost("transfigure", (author) => (
      insertTransfigurePost({ ...input, ...author })
    ));
    // The editor inside the modal reports a rejected promise as a failed save.
    if (!saved) throw new Error("transfigure post was not saved");
    setTransfigureOpen(false);
  }, [submitPost]);

  const handleDecisionsSubmit = useCallback(async (
    values: DecisionsDecisionsComposerValues,
  ) => submitPost("decisions_decisions", (author) => (
    insertDecisionsDecisionsPost({ ...values, ...author })
  )), [submitPost]);

  const handleFavoriteTournamentSubmit = useCallback(async (
    values: FavoriteTournamentComposerValues,
  ) => submitPost("favorite_tournament", (author) => (
    insertFavoriteTournamentPost({ ...values, ...author })
  )), [submitPost]);

  const handlePagestormSubmit = useCallback(async (
    input: PagestormEditorSaveInput,
  ) => {
    setPagestormSubmitting(true);
    try {
      const saved = await submitPost("pagestorm", (author) => (
        insertPagestormPost({ ...input, ...author })
      ));
      if (saved) setPagestormTitle("");
    } finally {
      setPagestormSubmitting(false);
    }
  }, [submitPost]);

  const overlay = (
    <DefragmentOverlayBodyEditor
      key={writeType}
      entities={entities}
      placeholder={placeholders.defragment}
      draftKey={overlayDraftKey(writeType)}
      onBlocksChange={setOverlayBlocks}
    />
  );

  const typeChips = useMemo(() => DEFRAGMENT_WRITE_SERVICES.map((service) => {
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
          setPagestormTitle("");
          setNotice(null);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
          selected
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-primary/30 hover:text-zinc-200",
        )}
      >
        <Image
          src={DEFRAGMENT_FEED_SERVICE_META[service].tokenSrc}
          alt=""
          width={14}
          height={14}
          className="size-3.5 object-contain"
        />
        {typeLabels[service]}
      </button>
    );
  }), [typeLabels, writeType]);

  // After a saved post with a failed overlay only the overlay stays open, so
  // the post cannot be sent a second time.
  const composerType = pendingOverlay ? null : writeType;

  return (
    <div className="space-y-3" data-defragment-write-panel>
      {!pendingOverlay && (
        <>
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
        </>
      )}

      {composerType === "combo" && (
        <ComboEditor
          entities={entities}
          placeholder={placeholders.combo}
          profileNickname={readNickname()}
          serviceLocale={serviceLocale}
          hideNickname
          draftKey={PRIMARY_DRAFT_KEYS.combo}
          onSubmit={async (blocks) => handleComboSubmit(blocks)}
        />
      )}

      {composerType === "chemical_x" && (
        <ChemicalXEditor
          entities={entities}
          placeholder={placeholders.chemicalX}
          profileNickname={readNickname()}
          hideNickname
          draftKey={PRIMARY_DRAFT_KEYS.chemical_x}
          onSubmit={async (blocks) => handleChemicalSubmit(blocks)}
        />
      )}

      {composerType === "this_or_that" && (
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
      )}

      {composerType === "transfigure" && (
        <>
          <button
            type="button"
            onClick={handleTransfigureOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
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

      {composerType === "decisions_decisions" && (
        <DecisionsDecisionsComposer
          entities={decisionsCatalog.entities}
          entityMap={decisionsCatalog.entityMap}
          stamps={decisionsCatalog.stamps}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          presetLabels={decisionsCopy.presetLabels}
          submitLabel={serviceMessages[serviceLocale].decisionsDecisions.submit}
          profileNickname={readNickname()}
          hideNickname
          onSubmit={handleDecisionsSubmit}
        />
      )}

      {composerType === "favorite_tournament" && (
        <FavoriteTournamentComposer
          entities={decisionsCatalog.entities}
          entityMap={decisionsCatalog.entityMap}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          presetLabels={decisionsCopy.presetLabels}
          submitLabel={serviceMessages[serviceLocale].favoriteTournament.submit}
          profileNickname={readNickname()}
          hideNickname
          onSubmit={handleFavoriteTournamentSubmit}
        />
      )}

      {composerType === "pagestorm" && (
        <PagestormEditor
          mode="edit"
          title={pagestormTitle}
          onTitleChange={setPagestormTitle}
          nickname={readNickname()}
          submitLabel={serviceMessages[serviceLocale].pagestorm.submit}
          submitting={pagestormSubmitting}
          onSubmit={handlePagestormSubmit}
        />
      )}

      {overlay}

      {visibleNotice && (
        <p
          ref={noticeRef}
          role="alert"
          data-defragment-write-notice
          className="text-xs text-red-300"
        >
          {visibleNotice}
        </p>
      )}

      {pendingOverlay && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={retryingOverlay}
            onClick={handleSkipOverlay}
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {copy.overlaySkip}
          </button>
          <button
            type="button"
            disabled={retryingOverlay}
            onClick={() => { void handleRetryOverlay(); }}
            className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {copy.overlayRetry}
          </button>
        </div>
      )}
    </div>
  );
}
