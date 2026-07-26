"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { RichText } from "@/components/rich-text";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  getTransfigureEntityDescription,
  getTransfigureSourceText,
  isTransfiguredContent,
  isTransfigureResourceType,
  transfigureResourceKey,
  type TransfigureResourceRef,
} from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { TransfigureResourcePicker } from "./transfigure-resource-picker";

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
    blocks: PostBlock[],
    nickname: string,
    resource: TransfigureResourceRef,
    sourceText: string,
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const sourceEntities = useMemo(
    () => entities.filter((entity) => getTransfigureSourceText(entity) != null),
    [entities],
  );
  const sourceDescription = useMemo(
    () => selected ? getTransfigureEntityDescription(selected) : null,
    [selected],
  );
  const sourceText = useMemo(
    () => selected ? getTransfigureSourceText(selected) : null,
    [selected],
  );

  const handleSelect = useCallback((entity: EntityInfo) => {
    setSelected(entity);
    setValidationError(null);
  }, []);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    if (
      !selected
      || !sourceText
      || !isTransfigureResourceType(selected.type)
      || !isTransfiguredContent(blocks, sourceText)
    ) {
      setValidationError(copy.changeRequired);
      throw new Error("transfigure content is unchanged");
    }

    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    setValidationError(null);
    await onSubmit(
      blocks,
      nickname,
      { type: selected.type, id: selected.id },
      sourceText,
    );
  }, [
    copy.changeRequired,
    copy.defaultNickname,
    onSubmit,
    profileNickname,
    selected,
    sourceText,
  ]);
  const canSubmitBlocks = useCallback(
    (blocks: PostBlock[]) => sourceText != null && isTransfiguredContent(blocks, sourceText),
    [sourceText],
  );

  return (
    <div className="space-y-3" data-transfigure-editor>
      <TransfigureResourcePicker
        entities={sourceEntities}
        selected={selected}
        serviceLocale={serviceLocale}
        onSelect={handleSelect}
      />

      {selected && sourceDescription && sourceText && isTransfigureResourceType(selected.type) && (
        <div className="overflow-hidden rounded-xl border border-cyan-400/15 bg-[#080b14]/80">
          <div className="border-b border-white/10 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200/60">
              {copy.sourceLabel}
            </span>
            <div className="mt-1 font-game-text text-sm leading-relaxed text-zinc-400">
              <RichText text={sourceDescription} />
            </div>
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200/60">
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
            placeholder={sourceText}
            initialText={sourceText}
            canSubmitBlocks={canSubmitBlocks}
            draftKey={`sts-transfigure-draft:${gameLocale}:${selected.type}:${selected.id}`}
            submitLabel={copy.submit}
            maxChars={null}
            submitIconSrc="/images/sts2/relics/astrolabe.webp"
          />
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
