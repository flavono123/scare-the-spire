"use client";

import { GameScrollArea } from "@/components/game-scroll-area";
import { RichText } from "@/components/rich-text";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import type { ReplayChoice } from "@/lib/sts2-run-replay";

export function GameRoomChoiceButton({
  title,
  description,
  backgroundImageUrl,
  picked,
  revealed,
  pickId,
}: {
  title: string;
  description?: string | null;
  backgroundImageUrl?: string | null;
  picked: boolean;
  revealed: boolean;
  pickId: string;
}) {
  return (
    <div
      data-history-last-scene-pick={pickId}
      data-picked={picked ? "true" : "false"}
      className="transition-opacity duration-300"
      style={{ opacity: revealed && !picked ? 0.4 : 1 }}
    >
      <GameChoiceFrame
        active={revealed && picked}
        backgroundImageUrl={backgroundImageUrl}
      >
        <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
          <RichText text={title} />
        </div>
        {description ? (
          <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
            <RichText text={description} />
          </div>
        ) : null}
      </GameChoiceFrame>
    </div>
  );
}

export function GameRoomChoicePanel({
  title,
  body,
  children,
}: {
  title?: string | null;
  body?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="dark pointer-events-none absolute inset-x-4 bottom-20 top-24 z-10 flex min-w-0 flex-col sm:inset-x-auto sm:right-[3.5%] sm:w-[45%] sm:min-w-[18rem] sm:max-w-[540px]">
      <div className="pointer-events-none absolute -inset-6 rounded-full bg-black/35 blur-2xl" />
      <div className="relative flex min-h-0 flex-1 flex-col gap-2">
        {title ? (
          <div
            className="shrink-0 font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
            style={{ textShadow: "3px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.75)" }}
          >
            {title}
          </div>
        ) : null}
        {body ? (
          <div
            className="shrink-0 font-game-text text-sm leading-[1.65] text-[#fff4dc] sm:text-[15px]"
            style={{ textShadow: "3px 2px 0 rgba(0,0,0,0.5)" }}
          >
            <RichText text={body} />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}

export function GameRoomChoiceList({
  choices,
  revealed,
  copyFor,
}: {
  choices: ReplayChoice[];
  revealed: boolean;
  copyFor: (choice: ReplayChoice) => { title: string; description: string | null; backgroundImageUrl: string | null };
}) {
  if (choices.length === 0) return null;
  return (
    <GameScrollArea className="max-h-full min-h-0" size="large" scrollerClassName="flex max-h-full flex-col gap-2 py-1 pr-2">
      {choices.map((choice) => {
        const copy = copyFor(choice);
        return (
          <GameRoomChoiceButton
            key={choice.id}
            pickId={choice.id}
            title={copy.title}
            description={copy.description}
            backgroundImageUrl={copy.backgroundImageUrl}
            picked={choice.picked}
            revealed={revealed}
          />
        );
      })}
    </GameScrollArea>
  );
}
