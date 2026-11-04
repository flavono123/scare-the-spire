"use client";

import { useRef } from "react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { GAME_LOCALE_LABELS, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { playPurchaseFailedWiggle } from "@/lib/merchant-feedback";
import { serviceMessages } from "@/messages/service";

/** What an item shows: its picture, its name in the game language, its original English name. */
export type ItemDisplay = {
  token: boolean;
  local: boolean;
  original: boolean;
};

/** English is already the original wording, so its game locale has no separate local name. */
export function hasLocalNames(gameLocale: GameLocale): boolean {
  return gameLocale !== "eng";
}

/**
 * The toggles' names in toggle order. Names are labelled by language, like the game locale
 * picker: 한국어, 일본어, 영어. English has no separate game-language name.
 */
export function displayItemLabels(
  gameLocale: GameLocale,
  serviceLocale: ServiceLocale,
): { id: keyof ItemDisplay; label: string }[] {
  return [
    { id: "token", label: serviceMessages[serviceLocale].vexingPuzzlebox.viewTokens },
    ...(hasLocalNames(gameLocale) ? [{ id: "local" as const, label: GAME_LOCALE_LABELS[gameLocale][serviceLocale] }] : []),
    { id: "original", label: GAME_LOCALE_LABELS.eng[serviceLocale] },
  ];
}

export function defaultItemDisplay(gameLocale: GameLocale): ItemDisplay {
  const local = hasLocalNames(gameLocale);
  return { token: true, local, original: !local };
}

function DisplayToggle({
  label,
  checked,
  locked,
  onChange,
}: {
  label: string;
  checked: boolean;
  /** Turning this off would leave an item empty. */
  locked: boolean;
  onChange: () => void;
}) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const say = useMerchantSay();
  const playSound = usePuzzleboxSound();
  return (
    <span ref={wrapperRef} className="inline-flex">
      <GameCheckboxToggle
        checked={checked}
        label={label}
        onCheckedChange={() => {
          if (locked && wrapperRef.current) {
            playPurchaseFailedWiggle(wrapperRef.current);
            say("failure", wrapperRef.current);
            return;
          }
          playSound(checked ? "checkboxOff" : "checkboxOn");
          onChange();
        }}
      />
    </span>
  );
}

/** Picture / game-language name / English name checkboxes; the last one on cannot be turned off. */
export function DisplayToggles({
  display,
  gameLocale,
  serviceLocale,
  groupLabel,
  onChange,
}: {
  display: ItemDisplay;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  groupLabel: string;
  onChange: (next: ItemDisplay, changed: keyof ItemDisplay) => void;
}) {
  const toggles = displayItemLabels(gameLocale, serviceLocale);
  const enabledCount = toggles.filter((item) => display[item.id]).length;
  return (
    <div role="group" aria-label={groupLabel} className="inline-flex flex-wrap justify-center gap-3">
      {toggles.map((item) => (
        <DisplayToggle
          key={item.id}
          label={item.label}
          checked={display[item.id]}
          locked={display[item.id] && enabledCount === 1}
          onChange={() => onChange({ ...display, [item.id]: !display[item.id] }, item.id)}
        />
      ))}
    </div>
  );
}
