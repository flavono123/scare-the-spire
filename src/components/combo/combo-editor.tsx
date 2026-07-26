"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Youtube } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { PostBlock } from "@/lib/chemical-types";
import type { HistoryRunBlock } from "@/lib/chemical-types";
import {
  countComboYouTubeReferences,
  extractComboResourceRefs,
} from "@/lib/combo-types";
import { HISTORY_COURSE_RELIC_IMAGE } from "@/lib/history-run-reference";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ComboResourcePicker } from "./combo-resource-picker";
import { ComboHistoryRunPicker } from "./combo-history-run-picker";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((module) => module.RichContentEditor),
  { ssr: false },
);

interface ComboEditorProps {
  entities: EntityInfo[];
  placeholder: string;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  onSubmit: (blocks: PostBlock[], nickname: string) => Promise<void>;
}

export function ComboEditor({
  entities,
  placeholder,
  profileNickname,
  serviceLocale,
  onSubmit,
}: ComboEditorProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const entityInsertRequestIdRef = useRef(0);
  const historyRunInsertRequestIdRef = useRef(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [historyRunPickerOpen, setHistoryRunPickerOpen] = useState(false);
  const [entityInsertRequest, setEntityInsertRequest] = useState<{
    requestId: number;
    entity: EntityInfo;
  } | null>(null);
  const [historyRunInsertRequest, setHistoryRunInsertRequest] = useState<{
    requestId: number;
    block: HistoryRunBlock;
  } | null>(null);
  const [youtubeGuideBeforeLink, youtubeGuideAfterLink] = copy.youtubeGuide.split("{youtubeLink}");
  const youtubeExtension = useMemo(() => ({
    pending: copy.youtubePending,
    added: copy.youtubeAdded,
    duplicate: copy.youtubeLimit,
    unavailable: copy.youtubeUnavailable,
  }), [
    copy.youtubeAdded,
    copy.youtubeLimit,
    copy.youtubePending,
    copy.youtubeUnavailable,
  ]);

  const handleResourceSelect = useCallback((entity: EntityInfo) => {
    entityInsertRequestIdRef.current += 1;
    setEntityInsertRequest({
      requestId: entityInsertRequestIdRef.current,
      entity,
    });
  }, []);

  const handleHistoryRunSelect = useCallback((block: HistoryRunBlock) => {
    historyRunInsertRequestIdRef.current += 1;
    setHistoryRunInsertRequest({
      requestId: historyRunInsertRequestIdRef.current,
      block,
    });
  }, []);

  const slashCommands = useMemo(() => [{
    id: "history-run",
    label: copy.historyRunSlashLabel,
    description: copy.historyRunSlashDescription,
    aliases: ["/도전", "/런", "/역사"],
    iconSrc: HISTORY_COURSE_RELIC_IMAGE,
    onSelect: () => setHistoryRunPickerOpen(true),
  }], [
    copy.historyRunSlashDescription,
    copy.historyRunSlashLabel,
  ]);
  const historyRunReferences = useMemo(() => ({
    insertRequest: historyRunInsertRequest,
    slashCommands,
  }), [historyRunInsertRequest, slashCommands]);

  const handleSubmit = useCallback(async (blocks: PostBlock[]) => {
    if (extractComboResourceRefs(blocks).length < 2) {
      setValidationError(copy.minimumResources);
      throw new Error("combo requires at least two resources");
    }
    if (countComboYouTubeReferences(blocks) > 1) {
      setValidationError(copy.youtubeLimit);
      throw new Error("combo allows one YouTube reference");
    }

    setValidationError(null);
    const nickname = nicknameInputRef.current?.value.trim()
      || profileNickname
      || copy.defaultNickname;
    await onSubmit(blocks, nickname);
  }, [
    copy.defaultNickname,
    copy.minimumResources,
    copy.youtubeLimit,
    onSubmit,
    profileNickname,
  ]);

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
            secondaryAction={(
              <ComboHistoryRunPicker
                open={historyRunPickerOpen}
                onOpenChange={setHistoryRunPickerOpen}
                serviceLocale={serviceLocale}
                onSelect={handleHistoryRunSelect}
              />
            )}
          />
        </div>

        <div
          className="flex items-start gap-1.5 border-b border-border/70 px-3 py-1.5 text-[11px] leading-relaxed text-zinc-500"
          data-combo-youtube-guide
        >
          <Youtube
            className="mt-0.5 h-3.5 w-3.5 shrink-0 spire-aqua opacity-70"
            aria-hidden="true"
          />
          <p>
            {youtubeGuideBeforeLink}
            <span
              className="font-semibold spire-aqua opacity-70"
              data-variant="ghost"
            >
              {copy.youtubeGuideLink}
            </span>
            {youtubeGuideAfterLink}
          </p>
        </div>

        <RichContentEditor
          entities={entities}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          richPlaceholder={placeholder}
          draftKey="sts-combo-draft"
          submitLabel={copy.submit}
          maxChars={null}
          submitIconSrc="/images/sts2/badges/ccccombo.webp"
          entityInsertRequest={entityInsertRequest}
          youtubeExtension={youtubeExtension}
          historyRunReferences={historyRunReferences}
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
