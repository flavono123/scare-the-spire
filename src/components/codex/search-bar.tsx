"use client";

import { useRef } from "react";
import type { CodexSearchTriggerGroup } from "@/lib/codex-search";

export type TriggerGroup = CodexSearchTriggerGroup;

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
  triggerGroups?: TriggerGroup[];
  placeholder?: string;
}

export function SearchBar({ value, onChange, inputId, placeholder = "검색" }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-9 rounded-md border border-black/70 bg-[#171c1f] shadow-[inset_0_-2px_0_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.06)]">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="search"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (value) {
              onChange("");
            } else {
              inputRef.current?.blur();
            }
          }
        }}
        placeholder={placeholder}
        className="h-full w-full rounded-md bg-transparent px-2.5 pr-9 font-game-text text-sm font-semibold leading-none text-[#d8d2c4] placeholder:text-[#aaa6a0] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="검색어 지우기"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[#f1eadc] drop-shadow-[2px_2px_0_rgba(0,0,0,0.85)] transition-transform hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M19.8 5.6 18.4 4.2 12 10.6 5.6 4.2 4.2 5.6l6.4 6.4-6.4 6.4 1.4 1.4 6.4-6.4 6.4 6.4 1.4-1.4-6.4-6.4 6.4-6.4Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
