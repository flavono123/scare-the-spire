"use client";

import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import {
  DEFRAGMENT_BODY_MAX_CHARS,
  DEFRAGMENT_BODY_MIN_CHARS,
} from "@/lib/content-limits";
import { DEFRAGMENT_TOKEN_SRC } from "@/lib/defragment";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((mod) => mod.RichContentEditor),
  { ssr: false },
);

export function DefragmentOverlayBodyEditor({
  entities,
  placeholder,
  draftKey,
  initialBlocks,
  onBlocksChange,
}: {
  entities: EntityInfo[];
  placeholder: string;
  draftKey: string;
  initialBlocks?: PostBlock[];
  onBlocksChange: (blocks: PostBlock[]) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;

  return (
    <div className="overflow-visible rounded-lg border border-dashed border-yellow-500/20 bg-card/20">
      <div className="border-b border-border/70 px-3 py-2 text-[11px] font-semibold tracking-wide text-zinc-500">
        {copy.overlayBody}
      </div>
      <RichContentEditor
        entities={entities}
        onSubmit={async () => {}}
        onBlocksChange={onBlocksChange}
        placeholder={placeholder}
        draftKey={draftKey}
        submitLabel={copy.submit}
        submitIconSrc={DEFRAGMENT_TOKEN_SRC}
        minChars={0}
        maxChars={DEFRAGMENT_BODY_MAX_CHARS}
        initialBlocks={initialBlocks}
        canSubmitBlocks={(blocks) => {
          const length = blocksToPlainText(blocks).trim().length;
          return length === 0 || (
            length >= DEFRAGMENT_BODY_MIN_CHARS && length <= DEFRAGMENT_BODY_MAX_CHARS
          );
        }}
        hideSubmitButton
        allowLineBreaks
        submitOnEnter={false}
      />
    </div>
  );
}
