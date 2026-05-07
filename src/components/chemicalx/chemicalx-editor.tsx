"use client";

import { useState, useCallback } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { RichContentEditor } from "@/components/rich-content-editor";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

const NICKNAME_KEY = "sts-chemicalx-nickname";
const DEFAULT_NICKNAME_FIXTURES = new Set([
  serviceMessages.ko.chemicalX.defaultNickname,
  serviceMessages.en.chemicalX.defaultNickname,
  "Anonymous Inserterian",
]);

function getSavedNickname(defaultNickname: string): string {
  if (typeof window === "undefined") return defaultNickname;
  const saved = localStorage.getItem(NICKNAME_KEY);
  if (!saved || DEFAULT_NICKNAME_FIXTURES.has(saved)) return defaultNickname;
  return saved;
}

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
}

export function ChemicalXEditor({ entities, onSubmit }: ChemicalXEditorProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const [nickname, setNickname] = useState(() => getSavedNickname(copy.defaultNickname));
  const nicknameValue = DEFAULT_NICKNAME_FIXTURES.has(nickname)
    ? copy.defaultNickname
    : nickname;

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    const nick = nicknameValue.trim() || copy.defaultNickname;
    localStorage.setItem(NICKNAME_KEY, nick);
    await onSubmit(blocks, nick);
  }, [copy.defaultNickname, nicknameValue, onSubmit]);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg bg-card/30 overflow-visible">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <input
            type="text"
            value={nicknameValue}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={copy.defaultNickname}
            maxLength={20}
            className="bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none w-full"
          />
        </div>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={copy.placeholder}
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
