"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { SaveTransfigurePostInput } from "@/hooks/use-transfigure-posts";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  findTransfigureEntity,
  getTransfigureCardKeywords,
  getTransfigureInitialBlocks,
  getTransfigureSourceCost,
  getTransfigureSourceText,
  getTransfigureUpgradeCardKeywords,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceText,
  isTransfigureChanged,
  isTransfigureResourceType,
  transfigureCardKeywordsEqual,
  transfigureBlocksSignature,
  type TransfigureCardKeywords,
  type TransfigurePost,
} from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { TransfigureAssetEditor } from "./transfigure-asset-editor";
import { TransfigureResourcePicker } from "./transfigure-resource-picker";

interface TransfigureEditorProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  initialPost?: TransfigurePost | null;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  upgradeLabel: string;
  onSubmit: (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => Promise<void>;
}

const LEGACY_TRANSFIGURE_DRAFT_PREFIXES = [
  "sts-transfigure-draft:",
  "sts-transfigure-edit-draft:",
] as const;

function removeTransfigureDrafts(prefixes: readonly string[]) {
  if (typeof window === "undefined") return;
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      sessionStorage.removeItem(key);
    }
  }
}

export function TransfigureEditor({
  entities,
  gameLocale,
  initialPost,
  profileNickname,
  serviceLocale,
  upgradeLabel,
  onSubmit,
}: TransfigureEditorProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const [draftSessionId] = useState(() => globalThis.crypto.randomUUID());
  const draftSessionPrefix = `sts-transfigure-composer:${draftSessionId}:`;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const initialEntity = useMemo(
    () => initialPost
      ? findTransfigureEntity(entities, {
        type: initialPost.resource_type,
        id: initialPost.resource_id,
      }) ?? null
      : null,
    [entities, initialPost],
  );
  const [selected, setSelected] = useState<EntityInfo | null>(initialEntity);
  const [postTitle, setPostTitle] = useState(
    initialPost?.title
      ?? (initialEntity
        ? copy.defaultTitle.replace("{name}", initialEntity.nameKo)
        : ""),
  );
  const [previewBlocks, setPreviewBlocks] = useState<PostBlock[]>(
    initialPost?.content ?? [],
  );
  const [previewUpgradeBlocks, setPreviewUpgradeBlocks] = useState<PostBlock[] | null>(
    initialPost?.upgraded_content
      ?? (initialEntity
        ? getTransfigureUpgradeInitialBlocks(initialEntity, entities)
        : null),
  );
  const [transformedName, setTransformedName] = useState(
    initialPost?.transformed_name ?? "",
  );
  const [transformedCost, setTransformedCost] = useState(
    initialPost?.transformed_cost ?? "",
  );
  const [cardKeywords, setCardKeywords] = useState<TransfigureCardKeywords | null>(
    () => initialPost
      ? {
        top: initialPost.card_top_keywords,
        bottom: initialPost.card_bottom_keywords,
      }
      : (initialEntity ? getTransfigureCardKeywords(initialEntity) : null),
  );
  const [transformedUpgradeCost, setTransformedUpgradeCost] = useState(
    initialPost?.transformed_upgrade_cost ?? "",
  );
  const [upgradedCardKeywords, setUpgradedCardKeywords] = useState<
    TransfigureCardKeywords | null
  >(
    () => initialPost?.upgraded_content
      ? {
        top: initialPost.upgraded_card_top_keywords,
        bottom: initialPost.upgraded_card_bottom_keywords,
      }
      : (initialEntity
        ? getTransfigureUpgradeCardKeywords(initialEntity)
        : null),
  );
  const [showUpgrade, setShowUpgrade] = useState(
    initialPost?.show_upgrade ?? false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    message: string;
    tone: "error" | "status";
  } | null>(null);

  useEffect(() => {
    removeTransfigureDrafts(LEGACY_TRANSFIGURE_DRAFT_PREFIXES);
    return () => removeTransfigureDrafts([draftSessionPrefix]);
  }, [draftSessionPrefix]);

  const sourceEntities = useMemo(
    () => entities.filter((entity) => getTransfigureSourceText(entity) != null),
    [entities],
  );
  const sourceText = useMemo(
    () => selected ? getTransfigureSourceText(selected) : null,
    [selected],
  );
  const sourceBlocks = useMemo(
    () => selected ? getTransfigureInitialBlocks(selected, entities) : [],
    [entities, selected],
  );
  const editorInitialBlocks = useMemo(
    () => initialPost?.content ?? sourceBlocks,
    [initialPost, sourceBlocks],
  );
  const sourceCost = useMemo(
    () => selected ? getTransfigureSourceCost(selected) : null,
    [selected],
  );
  const sourceCardKeywords = useMemo(
    () => selected ? getTransfigureCardKeywords(selected) : null,
    [selected],
  );
  const sourceUpgradeText = useMemo(
    () => selected ? getTransfigureUpgradeSourceText(selected) : null,
    [selected],
  );
  const sourceUpgradeBlocks = useMemo(
    () => selected
      ? getTransfigureUpgradeInitialBlocks(selected, entities)
      : null,
    [entities, selected],
  );
  const editorInitialUpgradeBlocks = useMemo(
    () => initialPost?.upgraded_content ?? sourceUpgradeBlocks,
    [initialPost, sourceUpgradeBlocks],
  );
  const sourceUpgradeCost = useMemo(
    () => selected ? getTransfigureUpgradeSourceCost(selected) : null,
    [selected],
  );
  const sourceUpgradedCardKeywords = useMemo(
    () => selected ? getTransfigureUpgradeCardKeywords(selected) : null,
    [selected],
  );
  const hasUpdateDiff = useCallback((
    blocks: PostBlock[],
    upgradedBlocks: PostBlock[] | null,
    title: string,
    nickname: string,
  ) => {
    if (!initialPost) return true;
    const initialUpgradeBlocks = initialPost.upgraded_content ?? sourceUpgradeBlocks;
    return (
      title !== (initialPost.title ?? "").trim()
      || nickname !== initialPost.nickname.trim()
      || transformedName.trim() !== (initialPost.transformed_name ?? "").trim()
      || transformedCost.trim() !== (initialPost.transformed_cost ?? "").trim()
      || transformedUpgradeCost.trim()
        !== (initialPost.transformed_upgrade_cost ?? "").trim()
      || !transfigureCardKeywordsEqual(cardKeywords, {
        top: initialPost.card_top_keywords,
        bottom: initialPost.card_bottom_keywords,
      })
      || !transfigureCardKeywordsEqual(upgradedCardKeywords, {
        top: initialPost.upgraded_card_top_keywords,
        bottom: initialPost.upgraded_card_bottom_keywords,
      })
      || showUpgrade !== (initialPost.show_upgrade ?? false)
      || transfigureBlocksSignature(blocks)
        !== transfigureBlocksSignature(initialPost.content)
      || (
        upgradedBlocks == null
          ? initialUpgradeBlocks != null
          : (
            initialUpgradeBlocks == null
            || transfigureBlocksSignature(upgradedBlocks)
              !== transfigureBlocksSignature(initialUpgradeBlocks)
          )
      )
    );
  }, [
    initialPost,
    cardKeywords,
    showUpgrade,
    sourceUpgradeBlocks,
    transformedCost,
    transformedName,
    transformedUpgradeCost,
    upgradedCardKeywords,
  ]);

  const handleSelect = useCallback((entity: EntityInfo) => {
    setSelected(entity);
    setPostTitle(copy.defaultTitle.replace("{name}", entity.nameKo));
    setPreviewBlocks(getTransfigureInitialBlocks(entity, entities));
    setPreviewUpgradeBlocks(getTransfigureUpgradeInitialBlocks(entity, entities));
    setTransformedName("");
    setTransformedCost("");
    setTransformedUpgradeCost("");
    setCardKeywords(getTransfigureCardKeywords(entity));
    setUpgradedCardKeywords(getTransfigureUpgradeCardKeywords(entity));
    setShowUpgrade(false);
    setSaveFeedback(null);
  }, [copy.defaultTitle, entities]);

  const handleSubmit = useCallback(async (
    blocks: PostBlock[],
    upgradedBlocks: PostBlock[] | null,
  ) => {
    if (
      !selected
      || !sourceText
      || !isTransfigureResourceType(selected.type)
      || !isTransfigureChanged({
        blocks,
        sourceText,
        sourceBlocks,
        transformedName,
        sourceName: selected.nameKo,
        transformedCost,
        sourceCost,
        upgradedBlocks,
        sourceUpgradeText,
        sourceUpgradeBlocks,
        transformedUpgradeCost,
        sourceUpgradeCost,
        cardKeywords,
        sourceCardKeywords,
        upgradedCardKeywords,
        sourceUpgradedCardKeywords,
        showUpgrade,
      })
    ) {
      setSaveFeedback({
        message: initialPost ? copy.noChanges : copy.changeRequired,
        tone: "error",
      });
      throw new Error("transfigure content is unchanged");
    }

    const title = postTitle.trim()
      || copy.defaultTitle.replace("{name}", selected.nameKo);
    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    if (!hasUpdateDiff(blocks, upgradedBlocks, title, nickname)) {
      setSaveFeedback({ message: copy.noChanges, tone: "error" });
      throw new Error("transfigure post is unchanged");
    }
    setSaveFeedback(null);
    await onSubmit({
      title,
      blocks,
      nickname,
      resource: { type: selected.type, id: selected.id },
      sourceText,
      sourceBlocks,
      sourceGameLocale: gameLocale,
      sourceName: selected.nameKo,
      sourceCost,
      sourceUpgradeText,
      sourceUpgradeBlocks,
      sourceUpgradeCost,
      sourceCardKeywords,
      sourceUpgradedCardKeywords,
      transformedName,
      transformedCost,
      cardKeywords,
      upgradedBlocks,
      transformedUpgradeCost,
      upgradedCardKeywords,
      showUpgrade,
    });
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    copy.defaultTitle,
    copy.noChanges,
    gameLocale,
    hasUpdateDiff,
    initialPost,
    onSubmit,
    postTitle,
    profileNickname,
    selected,
    sourceBlocks,
    cardKeywords,
    sourceCost,
    sourceText,
    sourceUpgradeBlocks,
    sourceUpgradeCost,
    sourceUpgradeText,
    sourceCardKeywords,
    sourceUpgradedCardKeywords,
    transformedCost,
    transformedName,
    transformedUpgradeCost,
    upgradedCardKeywords,
    showUpgrade,
  ]);
  const canSubmitBlocks = useCallback(
    (blocks: PostBlock[], upgradedBlocks: PostBlock[] | null) => (
      sourceText != null
      && selected != null
      && isTransfigureChanged({
        blocks,
        sourceText,
        sourceBlocks,
        transformedName,
        sourceName: selected.nameKo,
        transformedCost,
        sourceCost,
        upgradedBlocks,
        sourceUpgradeText,
        sourceUpgradeBlocks,
        transformedUpgradeCost,
        sourceUpgradeCost,
        cardKeywords,
        sourceCardKeywords,
        upgradedCardKeywords,
        sourceUpgradedCardKeywords,
        showUpgrade,
      })
    ),
    [
      selected,
      cardKeywords,
      sourceBlocks,
      sourceCost,
      sourceText,
      sourceUpgradeBlocks,
      sourceUpgradeCost,
      sourceUpgradeText,
      sourceCardKeywords,
      sourceUpgradedCardKeywords,
      transformedCost,
      transformedName,
      transformedUpgradeCost,
      upgradedCardKeywords,
      showUpgrade,
    ],
  );
  const hasChanges = canSubmitBlocks(
    previewBlocks,
    previewUpgradeBlocks,
  );
  const descriptionsValid = (
    blocksToPlainText(previewBlocks).trim().length >= 2
    && (
      previewUpgradeBlocks == null
      || blocksToPlainText(previewUpgradeBlocks).trim().length >= 2
    )
  );
  const requestSubmit = useCallback(async () => {
    if (!descriptionsValid) {
      setSaveFeedback({ message: copy.invalidDescription, tone: "error" });
      return;
    }
    if (!hasChanges) {
      setSaveFeedback({
        message: initialPost ? copy.noChanges : copy.changeRequired,
        tone: "error",
      });
      return;
    }
    const title = postTitle.trim()
      || (selected
        ? copy.defaultTitle.replace("{name}", selected.nameKo)
        : "");
    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    if (!hasUpdateDiff(
      previewBlocks,
      previewUpgradeBlocks,
      title,
      nickname,
    )) {
      setSaveFeedback({ message: copy.noChanges, tone: "error" });
      return;
    }
    setSaveFeedback({ message: copy.saving, tone: "status" });
    setSubmitting(true);
    try {
      await handleSubmit(previewBlocks, previewUpgradeBlocks);
    } catch {
      setSaveFeedback({ message: copy.saveFailed, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    copy.defaultTitle,
    copy.invalidDescription,
    copy.noChanges,
    copy.saveFailed,
    copy.saving,
    descriptionsValid,
    handleSubmit,
    hasChanges,
    hasUpdateDiff,
    initialPost,
    postTitle,
    previewBlocks,
    previewUpgradeBlocks,
    profileNickname,
    selected,
  ]);

  return (
    <div className="space-y-3" data-transfigure-editor>
      {!initialPost && (
        <TransfigureResourcePicker
          entities={sourceEntities}
          selected={selected}
          serviceLocale={serviceLocale}
          defaultOpen
          onSelect={handleSelect}
        />
      )}

      {selected && sourceText && isTransfigureResourceType(selected.type) && (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-yellow-500/20 bg-[#080b14]/80">
            <div className="border-b border-white/10 px-3 py-2">
              <label className="block">
                <span className="spire-gold mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {copy.titleLabel}
                </span>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(event) => {
                    setPostTitle(event.target.value);
                    setSaveFeedback(null);
                  }}
                  placeholder={copy.titlePlaceholder}
                  maxLength={80}
                  data-transfigure-title-input
                  className="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600"
                />
              </label>
            </div>

            <div className="px-3 py-2">
              <input
                key={`${initialPost?.id ?? "new"}:${profileNickname}`}
                ref={nicknameInputRef}
                type="text"
                defaultValue={initialPost?.nickname ?? profileNickname}
                onChange={() => setSaveFeedback(null)}
                placeholder={copy.defaultNickname}
                maxLength={20}
                className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
              />
            </div>

          </div>

          <section className="rounded-xl border border-yellow-500/15 bg-black/20 p-3 lg:sticky lg:top-0">
            <TransfigureAssetEditor
              draftKey={`${draftSessionPrefix}${gameLocale}:${selected.type}:${selected.id}`}
              entities={entities}
              entity={selected}
              gameLocale={gameLocale}
              blocks={previewBlocks}
              initialBlocks={editorInitialBlocks}
              initialUpgradeBlocks={editorInitialUpgradeBlocks}
              nameLabel={copy.nameLabel}
              costLabel={copy.costLabel}
              descriptionLabel={copy.descriptionLabel}
              addTopKeywordLabel={copy.addTopKeyword}
              addBottomKeywordLabel={copy.addBottomKeyword}
              removeKeywordLabel={copy.removeKeyword}
              serviceLocale={serviceLocale}
              sourceText={sourceText}
              sourceUpgradeText={sourceUpgradeText}
              sourceUpgradeCost={sourceUpgradeCost}
              submitLabel={initialPost ? copy.saveChanges : copy.submit}
              transformedName={transformedName}
              transformedCost={transformedCost}
              cardKeywords={cardKeywords}
              transformedUpgradeCost={transformedUpgradeCost}
              upgradedCardKeywords={upgradedCardKeywords}
              upgradedBlocks={previewUpgradeBlocks}
              upgradeLabel={upgradeLabel}
              showUpgrade={showUpgrade}
              onBlocksChange={(blocks) => {
                if (
                  transfigureBlocksSignature(blocks)
                  !== transfigureBlocksSignature(previewBlocks)
                ) {
                  setSaveFeedback(null);
                }
                setPreviewBlocks(blocks);
              }}
              onCardKeywordsChange={(keywords) => {
                setCardKeywords(keywords);
                setSaveFeedback(null);
              }}
              onCostChange={(value) => {
                setTransformedCost(value);
                setSaveFeedback(null);
              }}
              onUpgradeBlocksChange={(blocks) => {
                if (
                  blocks == null
                    ? previewUpgradeBlocks != null
                    : (
                      previewUpgradeBlocks == null
                      || transfigureBlocksSignature(blocks)
                        !== transfigureBlocksSignature(previewUpgradeBlocks)
                    )
                ) {
                  setSaveFeedback(null);
                }
                setPreviewUpgradeBlocks(blocks);
              }}
              onUpgradeCardKeywordsChange={(keywords) => {
                setUpgradedCardKeywords(keywords);
                setSaveFeedback(null);
              }}
              onUpgradeCostChange={(value) => {
                setTransformedUpgradeCost(value);
                setSaveFeedback(null);
              }}
              onShowUpgradeChange={(checked) => {
                setShowUpgrade(checked);
                setSaveFeedback(null);
              }}
              onNameChange={(value) => {
                setTransformedName(value);
                setSaveFeedback(null);
              }}
              onSubmit={handleSubmit}
            />
            <button
              type="button"
              onClick={requestSubmit}
              disabled={submitting}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/15 px-4 py-2 text-sm font-semibold text-yellow-200 transition-colors hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? copy.saving
                : initialPost
                  ? copy.saveChanges
                  : copy.submit}
              <Image
                src="/images/sts2/relics/astrolabe.webp"
                alt=""
                width={16}
                height={16}
                className="object-contain"
              />
            </button>
          </section>
        </div>
      )}

      {saveFeedback && (
        <p
          className={saveFeedback.tone === "error"
            ? "text-xs text-red-300"
            : "text-xs text-yellow-100/75"}
          role={saveFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          data-transfigure-save-feedback={saveFeedback.tone}
        >
          {saveFeedback.message}
        </p>
      )}
    </div>
  );
}
