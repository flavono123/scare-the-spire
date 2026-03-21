"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { COLOR_ALIASES, COLOR_LABELS, TYPE_ALIASES, CardFilterCategory, CardTypeKo } from "@/lib/codex-types";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
}

// Autocomplete items for triggers
const AUTOCOMPLETE_ITEMS: {
  trigger: string;
  items: { value: string; label: string; desc: string }[];
}[] = [
  {
    trigger: "@",
    items: [
      { value: "아이언클래드", label: "아이언클래드", desc: "Ironclad" },
      { value: "사일런트", label: "사일런트", desc: "Silent" },
      { value: "디펙트", label: "디펙트", desc: "Defect" },
      { value: "네크로바인더", label: "네크로바인더", desc: "Necrobinder" },
      { value: "리젠트", label: "리젠트", desc: "Regent" },
      { value: "무색", label: "무색", desc: "Colorless" },
      { value: "이벤트", label: "이벤트", desc: "Event" },
      { value: "저주", label: "저주", desc: "Curse" },
      { value: "상태이상", label: "상태이상", desc: "Status" },
      { value: "고대", label: "고대의 존재", desc: "Ancient" },
    ],
  },
  {
    trigger: "#",
    items: [
      { value: "공격", label: "공격", desc: "Attack" },
      { value: "스킬", label: "스킬", desc: "Skill" },
      { value: "파워", label: "파워", desc: "Power" },
    ],
  },
  {
    trigger: "!",
    items: [
      { value: "0", label: "0", desc: "비용 0" },
      { value: "1", label: "1", desc: "비용 1" },
      { value: "2", label: "2", desc: "비용 2" },
      { value: "3", label: "3", desc: "비용 3" },
      { value: "3+", label: "3+", desc: "비용 3 이상" },
      { value: "2-", label: "2-", desc: "비용 2 이하" },
      { value: "X", label: "X", desc: "X 비용" },
    ],
  },
];

export function SearchBar({ value, onChange, inputId }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Detect current trigger being typed
  const currentTrigger = getCurrentTrigger(value);
  const autocompleteItems = currentTrigger
    ? getFilteredItems(currentTrigger.trigger, currentTrigger.query)
    : [];

  useEffect(() => {
    setSelectedIndex(0);
    setShowAutocomplete(autocompleteItems.length > 0);
  }, [autocompleteItems.length]);

  const completeItem = useCallback(
    (item: { value: string }) => {
      if (!currentTrigger) return;
      const before = value.slice(0, currentTrigger.startIndex);
      const completed = `${currentTrigger.trigger}${item.value} `;
      onChange(before + completed);
      setShowAutocomplete(false);
      inputRef.current?.focus();
    },
    [value, onChange, currentTrigger]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (showAutocomplete) {
          setShowAutocomplete(false);
        } else {
          onChange("");
          inputRef.current?.blur();
        }
        return;
      }

      if (showAutocomplete && autocompleteItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % autocompleteItems.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(
            (i) => (i - 1 + autocompleteItems.length) % autocompleteItems.length
          );
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          completeItem(autocompleteItems[selectedIndex]);
        }
      }
    },
    [showAutocomplete, autocompleteItems, selectedIndex, completeItem, onChange]
  );

  // Parse tokens for chip display
  const tokens = value.split(/\s+/).filter(Boolean);

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
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
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (autocompleteItems.length > 0) setShowAutocomplete(true);
          }}
          onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
          placeholder="검색..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-16 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              onClick={() => onChange("")}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 005.7 7.12L10.59 12 5.7 16.88a1 1 0 101.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[9px] text-gray-600 bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Token chips */}
      {tokens.some((t) => t.startsWith("@") || t.startsWith("#") || t.startsWith("!")) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tokens.map((token, i) => {
            if (token.startsWith("@")) {
              const val = token.slice(1).toLowerCase();
              const match = COLOR_ALIASES[val];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    match
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-red-500/15 text-red-400/70"
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
                  className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    match
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/15 text-red-400/70"
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
                  className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400"
                >
                  !{token.slice(1)}
                </span>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e3a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {autocompleteItems.map((item, i) => (
            <button
              key={item.value}
              onMouseDown={() => completeItem(item)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-[10px] text-gray-500">{item.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getCurrentTrigger(
  value: string
): { trigger: string; query: string; startIndex: number } | null {
  // Find the last word being typed
  const lastSpaceIndex = value.lastIndexOf(" ");
  const currentWord = value.slice(lastSpaceIndex + 1);
  const startIndex = lastSpaceIndex + 1;

  for (const { trigger } of AUTOCOMPLETE_ITEMS) {
    if (currentWord.startsWith(trigger) && currentWord.length > trigger.length) {
      return {
        trigger,
        query: currentWord.slice(trigger.length).toLowerCase(),
        startIndex,
      };
    }
    // Just typed the trigger character
    if (currentWord === trigger) {
      return { trigger, query: "", startIndex };
    }
  }
  return null;
}

function getFilteredItems(
  trigger: string,
  query: string
): { value: string; label: string; desc: string }[] {
  const group = AUTOCOMPLETE_ITEMS.find((g) => g.trigger === trigger);
  if (!group) return [];
  if (!query) return group.items;
  return group.items.filter(
    (item) =>
      item.value.toLowerCase().includes(query) ||
      item.label.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query)
  );
}
