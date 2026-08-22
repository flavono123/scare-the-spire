"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import {
  DEFRAGMENT_BODY_MAX_CHARS,
  DEFRAGMENT_BODY_MIN_CHARS,
  DEFRAGMENT_TITLE_MAX_CHARS,
  DEFRAGMENT_TITLE_MIN_CHARS,
} from "@/lib/content-limits";
import { DEFRAGMENT_TOKEN_SRC } from "@/lib/defragment";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((mod) => mod.RichContentEditor),
  { ssr: false },
);

export function DefragmentComposer({
  entities,
  placeholder,
  profileNickname,
  submitLabel,
  initialTitle = "",
  initialBlocks,
  draftKey,
  onSubmit,
  hideNickname = false,
}: {
  entities: EntityInfo[];
  placeholder: string;
  profileNickname: string;
  submitLabel: string;
  initialTitle?: string;
  initialBlocks?: PostBlock[];
  draftKey: string;
  onSubmit: (input: {
    title: string;
    blocks: PostBlock[];
    nickname: string;
  }) => Promise<void>;
  hideNickname?: boolean;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);

  const canSubmitBlocks = useCallback((blocks: PostBlock[]) => {
    const trimmedTitle = title.replace(/\s+/g, " ").trim();
    const body = blocksToPlainText(blocks).trim();
    return (
      trimmedTitle.length >= DEFRAGMENT_TITLE_MIN_CHARS
      && trimmedTitle.length <= DEFRAGMENT_TITLE_MAX_CHARS
      && body.length >= DEFRAGMENT_BODY_MIN_CHARS
      && body.length <= DEFRAGMENT_BODY_MAX_CHARS
    );
  }, [title]);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    const nickname = hideNickname
      ? (profileNickname.trim() || copy.defaultNickname)
      : (nicknameInputRef.current?.value.trim()
        || profileNickname
        || copy.defaultNickname);
    await onSubmit({
      title,
      blocks,
      nickname,
    });
  }, [copy.defaultNickname, hideNickname, onSubmit, profileNickname, title]);

  return (
    <div className="space-y-3" data-defragment-composer>
      <div className="overflow-visible rounded-lg border border-border bg-card/30">
        {!hideNickname && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <input
            key={profileNickname}
            ref={nicknameInputRef}
            type="text"
            defaultValue={profileNickname}
            placeholder={copy.nicknamePlaceholder}
            maxLength={20}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        )}
        <div className="border-b border-border px-3 py-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.titlePlaceholder}
            maxLength={DEFRAGMENT_TITLE_MAX_CHARS}
            className="w-full bg-transparent font-service text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          draftKey={draftKey}
          submitLabel={submitLabel}
          submitIconSrc={DEFRAGMENT_TOKEN_SRC}
          minChars={DEFRAGMENT_BODY_MIN_CHARS}
          maxChars={DEFRAGMENT_BODY_MAX_CHARS}
          initialBlocks={initialBlocks}
          canSubmitBlocks={canSubmitBlocks}
          allowLineBreaks
          submitOnEnter={false}
        />
      </div>
    </div>
  );
}
