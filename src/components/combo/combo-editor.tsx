"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import { extractComboResourceRefs } from "@/lib/combo-types";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ComboResourcePicker } from "./combo-resource-picker";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((module) => module.RichContentEditor),
  { ssr: false },
);

interface ComboEditorProps {
  entities: EntityInfo[];
  profileNickname: string;
  serviceLocale: ServiceLocale;
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
}

export function ComboEditor({
  entities,
  profileNickname,
  serviceLocale,
  onSubmit,
}: ComboEditorProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const entityInsertRequestIdRef = useRef(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [entityInsertRequest, setEntityInsertRequest] = useState<{
    requestId: number;
    entity: EntityInfo;
  } | null>(null);

  const handleResourceSelect = useCallback((entity: EntityInfo) => {
    entityInsertRequestIdRef.current += 1;
    setEntityInsertRequest({
      requestId: entityInsertRequestIdRef.current,
      entity,
    });
  }, []);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    if (extractComboResourceRefs(blocks).length < 2) {
      setValidationError(copy.minimumResources);
      throw new Error("combo requires at least two resources");
    }

    setValidationError(null);
    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    await onSubmit(blocks, nickname);
  }, [copy.defaultNickname, copy.minimumResources, onSubmit, profileNickname]);

  return (
    <div className="space-y-2">
      <div className="overflow-visible rounded-lg border border-border bg-card/30">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
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

        <div className="border-b border-border px-3 py-2">
          <ComboResourcePicker
            entities={entities}
            serviceLocale={serviceLocale}
            onSelect={handleResourceSelect}
          />
        </div>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={copy.placeholder}
          draftKey="sts-combo-draft"
          submitLabel={copy.submit}
          maxChars={null}
          submitIconSrc="/images/sts2/badges/ccccombo.webp"
          entityInsertRequest={entityInsertRequest}
        />
      </div>

      {validationError && (
        <p className="text-xs text-red-300" role="alert" aria-live="polite">
          {validationError}
        </p>
      )}
    </div>
  );
}
