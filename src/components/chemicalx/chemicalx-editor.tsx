"use client";

import { useState, useCallback } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { RichContentEditor } from "@/components/rich-content-editor";

const DEFAULT_NICKNAME = "익명의 투입터리안";
const NICKNAME_KEY = "sts-chemicalx-nickname";

function getSavedNickname(): string {
  if (typeof window === "undefined") return DEFAULT_NICKNAME;
  return localStorage.getItem(NICKNAME_KEY) || DEFAULT_NICKNAME;
}

interface ChemicalXEditorProps {
  entities: EntityInfo[];
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
}

export function ChemicalXEditor({ entities, onSubmit }: ChemicalXEditorProps) {
  const [nickname, setNickname] = useState(getSavedNickname);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    const nick = nickname.trim() || DEFAULT_NICKNAME;
    localStorage.setItem(NICKNAME_KEY, nick);
    await onSubmit(blocks, nick);
  }, [nickname, onSubmit]);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg bg-card/30 overflow-visible">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={DEFAULT_NICKNAME}
            maxLength={20}
            className="bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none w-full"
          />
        </div>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder="오, 이 차는 무례한 사람들에게 내어지는 차입니다..."
          draftKey="sts-chemicalx-draft"
          submitLabel="투입"
          submitIconSrc="/images/relics/inserter.webp"
        />
      </div>
    </div>
  );
}
