"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((mod) => mod.RichContentEditor),
  { ssr: false },
);

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  placeholder: string;
  profileNickname: string;
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
}

export function ChemicalXEditor({
  entities,
  placeholder,
  profileNickname,
  onSubmit,
}: ChemicalXEditorProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    const nickname = nicknameInputRef.current?.value.trim() || profileNickname || copy.defaultNickname;
    await onSubmit(blocks, nickname);
  }, [copy.defaultNickname, onSubmit, profileNickname]);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg bg-card/30 overflow-visible">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <input
            key={profileNickname}
            ref={nicknameInputRef}
            type="text"
            defaultValue={profileNickname}
            placeholder={copy.defaultNickname}
            maxLength={20}
            className="w-full bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none"
          />
        </div>

        <p className="border-b border-border px-3 py-2 text-xs leading-relaxed text-zinc-500">
          {copy.composerHint}
        </p>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          draftKey="sts-chemicalx-draft"
          submitLabel={copy.submit}
          maxChars={null}
          submitIconSrc="/images/sts2/badges/ccccombo.webp"
          showKeywordTip
          keywordTip={copy.keywordTip}
        />
      </div>
    </div>
  );
}
