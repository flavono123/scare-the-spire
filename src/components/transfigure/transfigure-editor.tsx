"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  getTransfigureInitialBlocks,
  getTransfigureSourceText,
  isTransfiguredContent,
  isTransfigureResourceType,
  transfigureResourceKey,
  type TransfigureResourceRef,
} from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { TransfigureResourcePicker } from "./transfigure-resource-picker";
import { TransfigureResourcePreview } from "./transfigure-resource-preview";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((module) => module.RichContentEditor),
  { ssr: false },
);

interface TransfigureEditorProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  onSubmit: (
    title: string,
    blocks: PostBlock[],
    nickname: string,
    resource: TransfigureResourceRef,
    sourceText: string,
    sourceBlocks: PostBlock[],
  ) => Promise<void>;
}

export function TransfigureEditor({
  entities,
  gameLocale,
  profileNickname,
  serviceLocale,
  onSubmit,
}: TransfigureEditorProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<EntityInfo | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [previewBlocks, setPreviewBlocks] = useState<PostBlock[]>([]);
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

  const handleSelect = useCallback((entity: EntityInfo) => {
    setSelected(entity);
    setPreviewBlocks(getTransfigureInitialBlocks(entity, entities));
    setValidationError(null);
  }, [entities]);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    if (
      !selected
      || !sourceText
      || !isTransfigureResourceType(selected.type)
      || !isTransfiguredContent(blocks, sourceText, sourceBlocks)
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
    await onSubmit(
      title,
      blocks,
      nickname,
      { type: selected.type, id: selected.id },
      sourceText,
      sourceBlocks,
    );
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    copy.titleRequired,
    onSubmit,
    postTitle,
    profileNickname,
    selected,
    sourceBlocks,
    sourceText,
  ]);
  const canSubmitBlocks = useCallback(
    (blocks: PostBlock[]) => (
      postTitle.trim().length > 0
      && sourceText != null
      && isTransfiguredContent(blocks, sourceText, sourceBlocks)
    ),
    [postTitle, sourceBlocks, sourceText],
  );

  return (
    <div className="space-y-3" data-transfigure-editor>
      <TransfigureResourcePicker
        entities={sourceEntities}
        selected={selected}
        serviceLocale={serviceLocale}
        onSelect={handleSelect}
      />

      {selected && sourceText && isTransfigureResourceType(selected.type) && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                key={profileNickname}
                ref={nicknameInputRef}
                type="text"
                defaultValue={profileNickname}
                placeholder={copy.defaultNickname}
                maxLength={20}
                className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600"
              />
            </div>

            <div className="px-3 pt-2">
              <span className="spire-gold text-[11px] font-semibold uppercase tracking-[0.12em]">
                {copy.resultLabel}
              </span>
            </div>

            <RichContentEditor
              key={`${gameLocale}:${transfigureResourceKey({
                type: selected.type,
                id: selected.id,
              })}`}
              entities={entities}
              onSubmit={handleSubmit}
              onBlocksChange={setPreviewBlocks}
              placeholder={sourceText}
              initialBlocks={sourceBlocks}
              canSubmitBlocks={canSubmitBlocks}
              draftKey={`sts-transfigure-draft:${gameLocale}:${selected.type}:${selected.id}`}
              submitLabel={copy.submit}
              maxChars={null}
              submitIconSrc="/images/sts2/relics/astrolabe.webp"
            />
          </div>

          <aside className="rounded-xl border border-yellow-500/15 bg-black/20 p-3 lg:sticky lg:top-0">
            <span className="spire-gold mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em]">
              {copy.previewLabel}
            </span>
            <TransfigureResourcePreview
              blocks={previewBlocks}
              entities={entities}
              entity={selected}
              gameLocale={gameLocale}
              serviceLocale={serviceLocale}
            />
          </aside>
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
