"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { SaveTransfigurePostInput } from "@/hooks/use-transfigure-posts";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  findTransfigureEntity,
  getTransfigureInitialBlocks,
  getTransfigureSourceCost,
  getTransfigureSourceText,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceText,
  isTransfigureChanged,
  isTransfigureResourceType,
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
  const [transformedUpgradeCost, setTransformedUpgradeCost] = useState(
    initialPost?.transformed_upgrade_cost ?? "",
  );
  const [editorValid, setEditorValid] = useState(false);
  const [submitRequestId, setSubmitRequestId] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
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

  const handleSelect = useCallback((entity: EntityInfo) => {
    setSelected(entity);
    setPostTitle(copy.defaultTitle.replace("{name}", entity.nameKo));
    setPreviewBlocks(getTransfigureInitialBlocks(entity, entities));
    setPreviewUpgradeBlocks(getTransfigureUpgradeInitialBlocks(entity, entities));
    setTransformedName("");
    setTransformedCost("");
    setTransformedUpgradeCost("");
    setValidationError(null);
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
      })
    ) {
      setValidationError(copy.changeRequired);
      throw new Error("transfigure content is unchanged");
    }

    const title = postTitle.trim()
      || copy.defaultTitle.replace("{name}", selected.nameKo);
    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    setValidationError(null);
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
      transformedName,
      transformedCost,
      upgradedBlocks,
      transformedUpgradeCost,
    });
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    copy.defaultTitle,
    gameLocale,
    onSubmit,
    postTitle,
    profileNickname,
    selected,
    sourceBlocks,
    sourceCost,
    sourceText,
    sourceUpgradeBlocks,
    sourceUpgradeCost,
    sourceUpgradeText,
    transformedCost,
    transformedName,
    transformedUpgradeCost,
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
      })
    ),
    [
      selected,
      sourceBlocks,
      sourceCost,
      sourceText,
      sourceUpgradeBlocks,
      sourceUpgradeCost,
      sourceUpgradeText,
      transformedCost,
      transformedName,
      transformedUpgradeCost,
    ],
  );
  const canSubmit = editorValid && canSubmitBlocks(
    previewBlocks,
    previewUpgradeBlocks,
  );
  const requestSubmit = useCallback(() => {
    if (!canSubmit) {
      setValidationError(copy.changeRequired);
      return;
    }
    setValidationError(null);
    setSubmitRequestId((current) => current + 1);
  }, [canSubmit, copy.changeRequired]);

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
                    setValidationError(null);
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
                placeholder={copy.defaultNickname}
                maxLength={20}
                className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
              />
            </div>

          </div>

          <section className="rounded-xl border border-yellow-500/15 bg-black/20 p-3 lg:sticky lg:top-0">
            <TransfigureAssetEditor
              canSubmitBlocks={canSubmitBlocks}
              draftKey={initialPost
                ? `sts-transfigure-edit-draft:${initialPost.id}`
                : `sts-transfigure-draft:${gameLocale}:${selected.type}:${selected.id}`}
              entities={entities}
              entity={selected}
              gameLocale={gameLocale}
              blocks={previewBlocks}
              initialBlocks={editorInitialBlocks}
              initialUpgradeBlocks={editorInitialUpgradeBlocks}
              nameLabel={copy.nameLabel}
              costLabel={copy.costLabel}
              descriptionLabel={copy.descriptionLabel}
              serviceLocale={serviceLocale}
              sourceText={sourceText}
              sourceUpgradeText={sourceUpgradeText}
              sourceUpgradeCost={sourceUpgradeCost}
              submitLabel={initialPost ? copy.saveChanges : copy.submit}
              submitRequestId={submitRequestId}
              transformedName={transformedName}
              transformedCost={transformedCost}
              transformedUpgradeCost={transformedUpgradeCost}
              upgradedBlocks={previewUpgradeBlocks}
              upgradeLabel={upgradeLabel}
              onBlocksChange={setPreviewBlocks}
              onCostChange={(value) => {
                setTransformedCost(value);
                setValidationError(null);
              }}
              onUpgradeBlocksChange={setPreviewUpgradeBlocks}
              onUpgradeCostChange={(value) => {
                setTransformedUpgradeCost(value);
                setValidationError(null);
              }}
              onNameChange={(value) => {
                setTransformedName(value);
                setValidationError(null);
              }}
              onSubmit={handleSubmit}
              onValidityChange={setEditorValid}
            />
            <button
              type="button"
              onClick={requestSubmit}
              disabled={!canSubmit}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/15 px-4 py-2 text-sm font-semibold text-yellow-200 transition-colors hover:bg-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {initialPost ? copy.saveChanges : copy.submit}
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

      {validationError && (
        <p className="text-xs text-red-300" role="alert" aria-live="polite">
          {validationError}
        </p>
      )}
    </div>
  );
}
