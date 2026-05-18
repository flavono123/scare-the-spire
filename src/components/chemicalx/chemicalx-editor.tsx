"use client";

import { useCallback } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { RichContentEditor } from "@/components/rich-content-editor";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  placeholder: string;
  profileNickname: string;
  onSubmit: (blocks: PostBlock[]) => Promise<void>;
}

export function ChemicalXEditor({ entities, placeholder, profileNickname, onSubmit }: ChemicalXEditorProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    await onSubmit(blocks);
  }, [onSubmit]);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg bg-card/30 overflow-visible">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-gray-300">{profileNickname}</span>
        </div>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          draftKey="sts-chemicalx-draft"
          submitLabel={copy.submit}
          submitIconSrc="/images/relics/inserter.webp"
          showKeywordTip
          keywordTip={copy.keywordTip}
        />
      </div>
    </div>
  );
}
