"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexServiceMessages } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { CodexAncient, CodexCharacter } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import { DescriptionText } from "./codex-description";
import { RichDescription } from "./rich-description";

const DIALOGUE_BACKGROUND = "/images/sts2/ancient-dialogue/dialogue_nine_patch.webp";
const DIALOGUE_TAIL = "/images/sts2/ancient-dialogue/dialogue_tail.webp";
const SPECIAL_GROUPS = ["First Visit", "Returning"] as const;

export function AncientDialogueViewer({
  ancient,
  characters,
  serviceLocale,
  messages,
  entities,
  excludeSelf,
}: {
  ancient: CodexAncient;
  characters: CodexCharacter[];
  serviceLocale: ServiceLocale;
  messages: CodexServiceMessages;
  entities?: EntityInfo[];
  excludeSelf?: ReadonlySet<string>;
}) {
  const groups = useMemo(() => [
    ...SPECIAL_GROUPS.map((key) => ({
      key,
      label: key === "First Visit" ? messages.ancientsView.firstVisit : messages.ancientsView.returning,
      character: null,
    })),
    ...characters.map((character) => ({
      key: character.id.slice(0, 1) + character.id.slice(1).toLowerCase(),
      label: character.name,
      character,
    })),
  ].filter(({ key }) => ancient.dialogue[key]?.length), [ancient.dialogue, characters, messages]);
  const [selectedGroupKey, setSelectedGroupKey] = useState(() => groups[0]?.key ?? "First Visit");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [revealedStaleIndex, setRevealedStaleIndex] = useState<number | null>(null);
  const currentLineRef = useRef<HTMLDivElement | null>(null);
  const selectedGroup = groups.find(({ key }) => key === selectedGroupKey) ?? groups[0];
  const scenes = selectedGroup ? ancient.dialogue[selectedGroup.key] ?? [] : [];
  const scene = scenes[Math.min(sceneIndex, Math.max(0, scenes.length - 1))];
  const currentLine = scene?.lines[lineIndex];
  const atLastLine = Boolean(scene && lineIndex === scene.lines.length - 1);
  const continueLabel = atLastLine
    ? serviceLocale === "ko" ? "다시 보기" : "Replay"
    : currentLine?.nextLabel ?? (serviceLocale === "ko" ? "계속" : "Continue");

  useEffect(() => {
    currentLineRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [lineIndex, scene?.id, selectedGroup?.key]);

  const resetProgress = () => {
    setLineIndex(0);
    setRevealedStaleIndex(null);
  };
  const selectGroup = (key: string) => {
    setSelectedGroupKey(key);
    setSceneIndex(0);
    resetProgress();
  };
  const selectScene = (index: number) => {
    setSceneIndex(index);
    resetProgress();
  };
  const advance = () => {
    if (!scene) return;
    setLineIndex((current) => current >= scene.lines.length - 1 ? 0 : current + 1);
    setRevealedStaleIndex(null);
  };

  if (!selectedGroup || !scene || !currentLine) return null;

  return (
    <div
      className="absolute inset-0 min-w-0"
      data-ancient-dialogue-controls
      aria-label={messages.ancientsView.dialogue}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-300"
        onClick={advance}
        aria-label={continueLabel}
      >
        <span className="absolute bottom-2 right-3 flex min-h-11 items-center gap-2 rounded-full border border-blue-200/40 bg-black/70 px-4 font-game-text text-sm font-bold text-blue-100 shadow-lg sm:bottom-3 sm:right-5">
          {continueLabel} <span aria-hidden>›</span>
        </span>
      </button>

      <div className="pointer-events-none absolute inset-x-2 bottom-14 top-[4.75rem] z-10 flex min-w-0 flex-col gap-2 sm:inset-x-4 sm:bottom-16 sm:top-[5.25rem]">
        <div
          role="tablist"
          aria-label={serviceLocale === "ko" ? "대사 그룹" : "Dialogue group"}
          className="pointer-events-auto flex min-h-11 gap-1.5 overflow-x-auto rounded-lg bg-black/65 p-1.5 [scrollbar-width:thin]"
        >
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={group.key === selectedGroup.key}
              onClick={() => selectGroup(group.key)}
              className={`min-h-11 shrink-0 rounded-md border px-3 font-game-text text-xs font-bold transition-colors motion-reduce:transition-none ${
                group.key === selectedGroup.key
                  ? "border-blue-300/70 bg-blue-400/20 text-blue-100"
                  : "border-white/10 bg-black/30 text-gray-200 hover:bg-white/10"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div
          role="tablist"
          aria-label={serviceLocale === "ko" ? "대화 선택" : "Dialogue selection"}
          className="pointer-events-auto flex min-h-11 gap-1.5 overflow-x-auto px-1 [scrollbar-width:thin]"
        >
          {scenes.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={index === sceneIndex}
              onClick={() => selectScene(index)}
              className={`min-h-11 shrink-0 rounded-full border px-4 font-game-text text-xs font-bold ${
                index === sceneIndex
                  ? "border-teal-200/70 bg-teal-400/20 text-teal-50"
                  : "border-white/15 bg-black/45 text-gray-200 hover:bg-white/10"
              }`}
            >
              {serviceLocale === "ko" ? `대화 ${index + 1}` : `Dialogue ${index + 1}`}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-black/25 px-1 py-2 [scrollbar-width:thin] sm:px-3">
          <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-2.5">
            {scene.lines.slice(0, lineIndex + 1).map((line, index) => {
              const isCurrent = index === lineIndex;
              const isAncient = line.speaker === "ancient";
              const speakerName = isAncient
                ? ancient.name
                : selectedGroup.character?.name ?? (serviceLocale === "ko" ? "캐릭터" : "Character");
              const portrait = isAncient
                ? ancient.sceneAsset.token
                : selectedGroup.character?.iconUrl ?? ancient.sceneAsset.token;
              const staleIsRevealed = revealedStaleIndex === index;
              return (
                <div
                  key={line.order}
                  ref={isCurrent ? currentLineRef : undefined}
                  className={`flex items-end gap-1.5 ${isAncient ? "pr-7" : "flex-row-reverse pl-7"}`}
                  onPointerEnter={() => !isCurrent && setRevealedStaleIndex(index)}
                  onPointerLeave={() => !isCurrent && setRevealedStaleIndex(null)}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-blue-100/30 bg-black/75 shadow-lg">
                    <Image src={portrait} alt="" fill sizes="48px" className="object-contain p-1" />
                  </div>
                  <div
                    className={`relative min-w-0 max-w-[85%] flex-1 transition-opacity motion-reduce:transition-none ${
                      isCurrent || staleIsRevealed ? "opacity-100" : "opacity-70"
                    }`}
                  >
                    <Image
                      src={DIALOGUE_TAIL}
                      alt=""
                      width={18}
                      height={20}
                      className={`absolute bottom-2 z-0 h-5 w-[18px] ${isAncient ? "-left-2" : "-right-2 scale-x-[-1]"}`}
                    />
                    {!isCurrent && (
                      <button
                        type="button"
                        aria-label={serviceLocale === "ko" ? "이 대사 다시 보기" : "Review this line"}
                        onClick={() => setRevealedStaleIndex(index)}
                        onFocus={() => setRevealedStaleIndex(index)}
                        onBlur={() => setRevealedStaleIndex(null)}
                        className="absolute right-1 top-1 z-20 flex h-11 w-11 items-center justify-center rounded-full text-blue-100/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200"
                      >
                        <span aria-hidden>↺</span>
                      </button>
                    )}
                    <div
                      className={`relative z-10 rounded-xl px-4 py-3 pr-12 font-game-text text-sm leading-relaxed text-white shadow-xl ${isCurrent ? "ring-2 ring-blue-100/50" : ""}`}
                      style={{ backgroundImage: `url(${DIALOGUE_BACKGROUND})`, backgroundSize: "100% 100%" }}
                    >
                      <div className="mb-1 text-xs font-bold text-teal-50">{speakerName}</div>
                      {entities ? (
                        <RichDescription
                          description={line.text}
                          entities={entities}
                          excludeEntityTerms={excludeSelf}
                          excludeEntityTypes={new Set(["epoch"])}
                        />
                      ) : (
                        <DescriptionText description={line.text} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {currentLine.speaker === "ancient" ? ancient.name : selectedGroup.character?.name}: {stripCodexMarkup(currentLine.text)}
      </p>
    </div>
  );
}
