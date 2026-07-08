"use client";

import { useEffect, useMemo, useState } from "react";
import { PenLine, Search, X } from "lucide-react";
import type { ServiceLocale } from "@/lib/i18n";
import type { STS2PatchLine } from "@/lib/types";
import { useUserProfile } from "@/hooks/use-user-profile";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { supabaseEnabled } from "@/lib/supabase";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";

const STORY_DRAFT_MAX_LENGTH = 120;

function storyComposerCopy(serviceLocale: ServiceLocale) {
  if (serviceLocale === "ko") {
    return {
      write: "작성",
      writing: "...",
      newStory: "이야기 쓰기",
      close: "닫기",
      clearPatchLine: "참조 해제",
      nickname: "닉네임",
      patchLineSearchPlaceholder: "카드, 몬스터, 패치 내용 검색",
      patchLineRequired: "참조할 패치 내용을 한 줄 선택하세요",
      storageUnavailable: "데이터베이스가 응답하지 않습니다",
      communityLoading: "불러오는 중...",
    };
  }

  return {
    write: "Write",
    writing: "...",
    newStory: "Write story",
    close: "Close",
    clearPatchLine: "Clear reference",
    nickname: "Nickname",
    patchLineSearchPlaceholder: "Search cards, monsters, or patch text",
    patchLineRequired: "Select one patch note line to reference",
    storageUnavailable: "No responses from database",
    communityLoading: "Loading...",
  };
}

function normalizeStoryLookupText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function patchLineDisplayText(patchLine: STS2PatchLine, serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? patchLine.textKo || patchLine.textEn || ""
    : patchLine.textEn || patchLine.textKo || "";
}

function filterPatchLines(
  patchLines: STS2PatchLine[],
  query: string,
  serviceLocale: ServiceLocale,
) {
  const terms = normalizeStoryLookupText(query).split(/\s+/).filter(Boolean);
  const candidates = [...patchLines].reverse();
  if (terms.length === 0) return candidates.slice(0, 12);

  return candidates
    .filter((patchLine) => {
      const text = normalizeStoryLookupText([
        patchLine.searchText,
        patchLineDisplayText(patchLine, serviceLocale),
      ].join(" "));
      return terms.every((term) => text.includes(term));
    })
    .slice(0, 24);
}

export function StoryComposerModal({
  serviceLocale,
  storyPlaceholder,
  userId,
  authReady,
  ensureUser,
  unavailable,
  loading,
  patchLines,
  initialPatchLineId,
  onAdd,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  storyPlaceholder: string;
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  unavailable: boolean;
  loading: boolean;
  patchLines: STS2PatchLine[];
  initialPatchLineId?: string;
  onAdd: (sentence: string, nickname: string, patchLine: STS2PatchLine, activeUserId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const copy = storyComposerCopy(serviceLocale);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: serviceLocale === "ko" ? "닉" : "Nick" }),
    [serviceLocale],
  );
  const initialPatchLine = useMemo(
    () => patchLines.find((patchLine) => patchLine.id === initialPatchLineId) ?? null,
    [initialPatchLineId, patchLines],
  );
  const { profile } = useUserProfile(profileFallback);
  const [sentence, setSentence] = useState("");
  const [nickname, setNickname] = useState(profile.nickname);
  const [patchLineQuery, setPatchLineQuery] = useState("");
  const [selectedPatchLine, setSelectedPatchLine] = useState<STS2PatchLine | null>(initialPatchLine);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNickname(profile.nickname);
  }, [profile.nickname]);

  useEffect(() => {
    setSelectedPatchLine(initialPatchLine);
  }, [initialPatchLine]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredPatchLines = useMemo(
    () => filterPatchLines(patchLines, patchLineQuery, serviceLocale),
    [patchLineQuery, patchLines, serviceLocale],
  );
  const trimmedSentence = sentence.trim();
  const disabled = !authReady || !supabaseEnabled || unavailable || submitting || trimmedSentence.length < 2 || !nickname.trim() || !selectedPatchLine;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId || !selectedPatchLine) return;
      await onAdd(trimmedSentence, nickname, selectedPatchLine, activeUserId);
      setSentence("");
      setSelectedPatchLine(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">{copy.newStory}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            title={copy.close}
          >
            <X size={16} />
            <span className="sr-only">{copy.close}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {unavailable || !supabaseEnabled ? (
            <StorageUnavailableNotice compact title={copy.storageUnavailable} />
          ) : null}

          <textarea
            value={sentence}
            onChange={(event) => setSentence(event.target.value.slice(0, STORY_DRAFT_MAX_LENGTH))}
            placeholder={storyPlaceholder}
            maxLength={STORY_DRAFT_MAX_LENGTH}
            rows={3}
            disabled={!authReady || !supabaseEnabled || unavailable}
            className="min-h-24 w-full resize-none rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40 disabled:opacity-40"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value.slice(0, 20))}
              placeholder={copy.nickname}
              maxLength={20}
              disabled={!authReady || !supabaseEnabled || unavailable}
              className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background/50 px-2.5 text-xs text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-yellow-500/40 disabled:opacity-40"
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {sentence.length}/{STORY_DRAFT_MAX_LENGTH}
            </span>
            {loading && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <EngagementSpinner size={12} />
                {copy.communityLoading}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={patchLineQuery}
                onChange={(event) => setPatchLineQuery(event.target.value)}
                placeholder={copy.patchLineSearchPlaceholder}
                className="h-9 w-full rounded-md border border-border/70 bg-background/40 pl-8 pr-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40"
              />
            </label>

            {selectedPatchLine ? (
              <div className="relative rounded-md border border-yellow-500/25 bg-yellow-500/5 px-3 py-2 pr-9">
                <button
                  type="button"
                  onClick={() => setSelectedPatchLine(null)}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-yellow-500/80 transition-colors hover:bg-yellow-500/10 hover:text-yellow-300"
                  title={copy.clearPatchLine}
                >
                  <X size={14} />
                  <span className="sr-only">{copy.clearPatchLine}</span>
                </button>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{selectedPatchLine.patch}</span>
                  <span className="mx-1.5 text-muted-foreground/60">·</span>
                  {patchLineDisplayText(selectedPatchLine, serviceLocale)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">{copy.patchLineRequired}</p>
            )}

            <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-card/20">
              {filteredPatchLines.map((patchLine) => (
                <button
                  key={patchLine.id}
                  type="button"
                  onClick={() => setSelectedPatchLine(patchLine)}
                  className={`block w-full border-b border-border/40 px-3 py-2 text-left last:border-b-0 transition-colors hover:bg-white/5 ${
                    selectedPatchLine?.id === patchLine.id ? "bg-white/10" : ""
                  }`}
                >
                  <span className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-yellow-500">{patchLine.patch}</span>
                    {patchLine.section.length > 0 && <span>{patchLine.section.join(" / ")}</span>}
                  </span>
                  <span className="block text-xs leading-relaxed text-foreground">
                    {patchLineDisplayText(patchLine, serviceLocale)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/15 disabled:opacity-30"
          >
            {submitting ? <EngagementSpinner size={14} /> : <PenLine size={14} />}
            {submitting ? copy.writing : copy.write}
          </button>
        </div>
      </form>
    </div>
  );
}
