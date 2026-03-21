"use client";

import { useRef, useCallback } from "react";
import { COLOR_ALIASES, TYPE_ALIASES } from "@/lib/codex-types";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onChange("");
        inputRef.current?.blur();
      }
    },
    [onChange]
  );

  // Parse tokens for visual display
  const tokens = value.split(/\s+/).filter(Boolean);
  const hasTokens = tokens.some(
    (t) => t.startsWith("@") || t.startsWith("#") || t.startsWith("!")
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="검색... @캐릭터 #유형 !비용"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 005.7 7.12L10.59 12 5.7 16.88a1 1 0 101.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
            </svg>
          </button>
        )}
      </div>

      {/* Token hints */}
      {hasTokens && (
        <div className="flex flex-wrap gap-1">
          {tokens.map((token, i) => {
            if (token.startsWith("@")) {
              const val = token.slice(1).toLowerCase();
              const match = COLOR_ALIASES[val];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    match
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  @{token.slice(1)}
                </span>
              );
            }
            if (token.startsWith("#")) {
              const val = token.slice(1).toLowerCase();
              const match = TYPE_ALIASES[val];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    match
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  #{token.slice(1)}
                </span>
              );
            }
            if (token.startsWith("!")) {
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400"
                >
                  !{token.slice(1)}
                </span>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
