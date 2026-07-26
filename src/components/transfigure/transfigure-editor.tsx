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
  const [postTitle, setPostTitle] = useState(initialPost?.title ?? "");
  const [previewBlocks, setPreviewBlocks] = useState<PostBlock[]>(
    initialPost?.content ?? [],
  );
  const [transformedName, setTransformedName] = useState(
    initialPost?.transformed_name ?? "",
  );
  const [transformedCost, setTransformedCost] = useState(
    initialPost?.transformed_cost ?? "",
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

  const handleSelect = useCallback((entity: EntityInfo) => {
    setSelected(entity);
    setPreviewBlocks(getTransfigureInitialBlocks(entity, entities));
    setTransformedName("");
    setTransformedCost("");
    setValidationError(null);
  }, [entities]);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
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
      })
    ) {
      setValidationError(copy.changeRequired);
      throw new Error("transfigure content is unchanged");
    }

    const title = postTitle.trim();
    if (!title) {
      setValidationError(copy.titleRequired);
      throw new Error("transfigure title is required");
    }
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
      transformedName,
      transformedCost,
    });
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    copy.titleRequired,
    gameLocale,
    onSubmit,
    postTitle,
    profileNickname,
    selected,
    sourceBlocks,
    sourceCost,
    sourceText,
    transformedCost,
    transformedName,
  ]);
  const canSubmitBlocks = useCallback(
    (blocks: PostBlock[]) => (
      postTitle.trim().length > 0
      && sourceText != null
      && selected != null
      && isTransfigureChanged({
        blocks,
        sourceText,
        sourceBlocks,
        transformedName,
        sourceName: selected.nameKo,
        transformedCost,
        sourceCost,
      })
    ),
    [
      postTitle,
      selected,
      sourceBlocks,
      sourceCost,
      sourceText,
      transformedCost,
      transformedName,
    ],
  );
  const canSubmit = editorValid && canSubmitBlocks(previewBlocks);
  const requestSubmit = useCallback(() => {
    if (!postTitle.trim()) {
      setValidationError(copy.titleRequired);
      return;
    }
    if (!canSubmit) {
      setValidationError(copy.changeRequired);
      return;
    }
    setValidationError(null);
    setSubmitRequestId((current) => current + 1);
  }, [canSubmit, copy.changeRequired, copy.titleRequired, postTitle]);

  return (
    <div className="space-y-3" data-transfigure-editor>
      <TransfigureResourcePicker
        entities={sourceEntities}
        selected={selected}
        serviceLocale={serviceLocale}
        onSelect={handleSelect}
        disabled={Boolean(initialPost)}
      />

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

            <div className="border-b border-white/10 px-3 py-2">
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

            <div className="space-y-2 px-3 py-3 text-xs leading-relaxed text-zinc-500">
              <p>{copy.directEditHint}</p>
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
              initialBlocks={editorInitialBlocks}
              nameLabel={copy.nameLabel}
              costLabel={copy.costLabel}
              descriptionLabel={copy.descriptionLabel}
              directEditLabel={copy.directEditLabel}
              serviceLocale={serviceLocale}
              sourceText={sourceText}
              submitLabel={initialPost ? copy.saveChanges : copy.submit}
              submitRequestId={submitRequestId}
              transformedName={transformedName}
              transformedCost={transformedCost}
              onBlocksChange={setPreviewBlocks}
              onCostChange={(value) => {
                setTransformedCost(value);
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
