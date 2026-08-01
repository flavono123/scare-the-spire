"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexServiceMessages } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import { CHARACTER_COLORS, type CodexAncient, type CodexCharacter } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { RichDescription } from "./rich-description";

const DIALOGUE_BACKGROUND = "/images/sts2/ancient-dialogue/dialogue_nine_patch.webp";
const DIALOGUE_TAIL = "/images/sts2/ancient-dialogue/dialogue_tail.webp";
const CONTINUE_ARROW = "/images/sts2/ancient-dialogue/continue_arrow.webp";
const SPECIAL_GROUPS = ["First Visit", "Returning"] as const;

export function AncientDialogueViewer({
  ancient,
  characters,
  messages,
  entities,
  excludeSelf,
}: {
  ancient: CodexAncient;
  characters: CodexCharacter[];
  messages: CodexServiceMessages;
  entities?: EntityInfo[];
  excludeSelf?: ReadonlySet<string>;
}) {
  const situationGroups = useMemo(() => SPECIAL_GROUPS.map((key) => ({
      key,
      label: key === "First Visit" ? messages.ancientsView.firstVisit : messages.ancientsView.returning,
      character: null,
    })).filter(({ key }) => ancient.dialogue[key]?.length), [ancient.dialogue, messages]);
  const characterGroups = useMemo(() => characters.map((character) => ({
      key: character.id.slice(0, 1) + character.id.slice(1).toLowerCase(),
      label: character.name,
      character,
    })).filter(({ key }) => ancient.dialogue[key]?.length), [ancient.dialogue, characters]);
  const groups = useMemo(
    () => [...situationGroups, ...characterGroups],
    [characterGroups, situationGroups],
  );
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
  const showAdvance = !atLastLine || Boolean(scene && scene.lines.length > 1);
  const continueLabel = atLastLine
    ? messages.ancientsView.replay
    : currentLine?.nextLabel ?? messages.ancientsView.continue;

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
      {showAdvance && (
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#efc850]"
          onClick={advance}
          aria-label={continueLabel}
        >
          <span className="absolute bottom-3 right-4 flex min-h-11 items-center gap-1 font-game-text text-base font-bold italic text-[#efc850] [text-shadow:0_2px_0_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.85)] sm:bottom-5 sm:right-7 sm:text-lg">
            {continueLabel}
            <Image src={CONTINUE_ARROW} alt="" width={24} height={48} className="h-9 w-[18px] object-contain" />
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-2 bottom-14 z-10 mx-auto flex max-h-[58%] min-w-0 max-w-[58rem] flex-col justify-end sm:inset-x-4 sm:bottom-16">
        <div className="pointer-events-auto grid shrink-0 grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_11rem] sm:items-center sm:gap-x-4">
          {situationGroups.length > 0 && (
            <div className="flex min-w-0 items-center justify-center sm:justify-start" role="tablist" aria-label={messages.ancientsView.dialogueSituation}>
              <span className="mr-2 shrink-0 font-game-title text-xs font-bold text-[#efc850] [text-shadow:0_2px_0_rgba(0,0,0,0.9)]" aria-hidden>
                {messages.ancientsView.dialogueSituation}
              </span>
              {situationGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  role="tab"
                  aria-selected={group.key === selectedGroup.key}
                  onClick={() => selectGroup(group.key)}
                  className={`min-h-11 shrink-0 px-2 font-game-text text-sm font-bold [text-shadow:0_2px_0_rgba(0,0,0,0.95)] transition-[opacity,transform,filter] motion-reduce:transition-none ${
                    group.key === selectedGroup.key
                      ? "text-[#fff6e2] drop-shadow-[0_0_6px_rgba(239,200,80,0.8)]"
                      : "text-[#fff6e2] opacity-45 hover:opacity-80"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}
          {characterGroups.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center justify-center sm:justify-start" role="tablist" aria-label={messages.ancientsView.characterSpeaker}>
              <span className="mr-1 shrink-0 font-game-title text-xs font-bold text-[#efc850] [text-shadow:0_2px_0_rgba(0,0,0,0.9)]" aria-hidden>
                {messages.ancientsView.characterSpeaker}
              </span>
              {characterGroups.map((group) => {
                const selected = group.key === selectedGroup.key;
                const color = CHARACTER_COLORS[group.character.id.toLowerCase()] ?? "#fff6e2";
                return (
                  <button
                    key={group.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => selectGroup(group.key)}
                    className={`flex min-h-11 shrink-0 items-center gap-1 px-1.5 font-game-text text-xs font-bold [text-shadow:0_2px_0_rgba(0,0,0,0.95)] transition-[opacity,filter] motion-reduce:transition-none ${selected ? "opacity-100" : "opacity-45 hover:opacity-80"}`}
                    style={{ color }}
                  >
                    <span className="relative h-8 w-8 shrink-0">
                      <Image src={group.character.iconOutlineUrl} alt="" fill sizes="32px" className="object-contain opacity-60" />
                      <Image src={group.character.iconUrl} alt="" fill sizes="32px" className="object-contain" />
                    </span>
                    <span>{group.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div role={scenes.length > 1 ? "tablist" : undefined} aria-label={scenes.length > 1 ? messages.ancientsView.dialogueSelection : undefined} className="flex min-h-11 items-center justify-center gap-1 sm:justify-end">
            {scenes.length > 1 && (
              <>
                <span className="font-game-title text-xs font-bold text-[#efc850] [text-shadow:0_2px_0_rgba(0,0,0,0.9)]" aria-hidden>
                  {messages.ancientsView.dialogue}
                </span>
                {scenes.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    role="tab"
                    aria-selected={index === sceneIndex}
                    onClick={() => selectScene(index)}
                    className={`flex min-h-11 min-w-10 items-center justify-center gap-1 font-game-title text-lg font-bold [text-shadow:0_2px_0_rgba(0,0,0,0.95)] transition-[opacity,transform] ${
                      index === sceneIndex ? "scale-110 text-[#efc850] drop-shadow-[0_0_6px_rgba(239,200,80,0.75)]" : "text-[#fff6e2] opacity-65 hover:opacity-100"
                    }`}
                  >
                    <Image src={CONTINUE_ARROW} alt="" width={24} height={48} className={`h-5 w-2.5 object-contain ${index === sceneIndex ? "opacity-100" : "opacity-0"}`} />
                    {index + 1}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-1 py-2 [scrollbar-width:thin] sm:px-3">
          <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-2.5">
            {scene.lines.slice(0, lineIndex + 1).map((line, index) => {
              const isCurrent = index === lineIndex;
              const isAncient = line.speaker === "ancient";
              const speakerName = isAncient
                ? ancient.name
                : selectedGroup.character?.name ?? messages.ancientsView.characterSpeaker;
              const portrait = isAncient
                ? ancient.sceneAsset.token
                : selectedGroup.character?.iconUrl ?? ancient.sceneAsset.token;
              const portraitOutline = isAncient ? null : selectedGroup.character?.iconOutlineUrl ?? null;
              const speakerColor = isAncient
                ? "#60a5fa"
                : selectedGroup.character
                  ? CHARACTER_COLORS[selectedGroup.character.id.toLowerCase()] ?? "#fff6e2"
                  : "#fff6e2";
              const staleIsRevealed = revealedStaleIndex === index;
              return (
                <div
                  key={line.order}
                  ref={isCurrent ? currentLineRef : undefined}
                  className={`flex items-end gap-1.5 ${isAncient ? "pr-7" : "flex-row-reverse pl-7"}`}
                  onPointerEnter={() => !isCurrent && setRevealedStaleIndex(index)}
                  onPointerLeave={() => !isCurrent && setRevealedStaleIndex(null)}
                >
                  <div className="relative h-14 w-14 shrink-0 drop-shadow-[0_3px_3px_rgba(0,0,0,0.75)]">
                    {portraitOutline && <Image src={portraitOutline} alt="" fill sizes="56px" className="object-contain opacity-60" />}
                    <Image src={portrait} alt="" fill sizes="56px" className="object-contain" />
                  </div>
                  <div
                    className={`relative min-w-0 max-w-[85%] flex-1 transition-opacity motion-reduce:transition-none ${
                      isCurrent || staleIsRevealed ? "opacity-100" : "opacity-70"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute bottom-2 z-0 h-5 w-[18px] bg-[#28454f] ${isAncient ? "-left-2" : "-right-2 scale-x-[-1]"}`}
                      style={{
                        WebkitMaskImage: `url(${DIALOGUE_TAIL})`,
                        maskImage: `url(${DIALOGUE_TAIL})`,
                        WebkitMaskSize: "100% 100%",
                        maskSize: "100% 100%",
                      }}
                    />
                    {!isCurrent && (
                      <button
                        type="button"
                        aria-label={messages.ancientsView.reviewLine}
                        onClick={() => setRevealedStaleIndex(index)}
                        onFocus={() => setRevealedStaleIndex(index)}
                        onBlur={() => setRevealedStaleIndex(null)}
                        className="absolute right-1 top-0 z-20 flex h-11 w-11 items-center justify-center font-game-title text-lg text-[#efc850]/70 [text-shadow:0_2px_0_rgba(0,0,0,0.9)] hover:text-[#efc850] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc850]"
                      >
                        <span aria-hidden>↺</span>
                      </button>
                    )}
                    <div
                      className={`relative z-10 px-4 py-3 font-game-text text-sm leading-relaxed text-[#fff6e2] drop-shadow-[2px_5px_0_rgba(0,0,0,0.25)] ${!isCurrent ? "pr-12" : ""}`}
                      style={{
                        backgroundColor: "#28454f",
                        WebkitMaskBoxImageSource: `url(${DIALOGUE_BACKGROUND})`,
                        WebkitMaskBoxImageSlice: "28 27 fill",
                        WebkitMaskBoxImageWidth: "14px",
                        WebkitMaskBoxImageRepeat: "stretch",
                      }}
                    >
                      <div className="mb-1 text-xs font-bold [text-shadow:0_1px_0_rgba(0,0,0,0.8)]" style={{ color: speakerColor }}>{speakerName}</div>
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
