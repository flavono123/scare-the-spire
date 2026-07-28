"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CodexCard } from "@/lib/codex-types";
import { getCardKeywordDisplayText } from "@/lib/sts2-card-keywords";

interface TransfigureCardKeywordRailProps {
  addLabel: string;
  card: Pick<CodexCard, "keywordLabels">;
  keywords: string[];
  options: readonly string[];
  placement: "top" | "bottom";
  removeLabel: string;
  onChange: (keywords: string[]) => void;
}

export function TransfigureCardKeywordRail({
  addLabel,
  card,
  keywords,
  options,
  placement,
  removeLabel,
  onChange,
}: TransfigureCardKeywordRailProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = new Set(keywords);
  const available = options.filter((keyword) => !selected.has(keyword));

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  const addKeyword = (keyword: string) => {
    onChange(options.filter((option) => (
      option === keyword || selected.has(option)
    )));
  };
  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((selectedKeyword) => selectedKeyword !== keyword));
  };

  return (
    <div
      ref={rootRef}
      className="relative z-20 w-full shrink-0"
      data-transfigure-keyword-rail={placement}
      style={{ fontSize: "0.742857em", lineHeight: 1.05 }}
    >
      <div className="flex min-h-[8cqi] flex-wrap items-center justify-center gap-[1.2cqi]">
        {keywords.map((keyword) => {
          const displayText = getCardKeywordDisplayText(card, keyword);
          return (
            <button
              key={keyword}
              type="button"
              onClick={() => removeKeyword(keyword)}
              className="inline-flex items-center gap-[0.8cqi] rounded-[2cqi] border border-[#EFC851]/45 bg-black/30 px-[2cqi] py-[1.1cqi] font-bold text-[#EFC851] transition-colors hover:border-[#FFF0A8] hover:bg-[#EFC851]/15 focus-visible:outline focus-visible:outline-[0.7cqi] focus-visible:outline-[#FFF0A8]"
              title={removeLabel.replace("{keyword}", displayText)}
              aria-label={removeLabel.replace("{keyword}", displayText)}
              data-transfigure-card-keyword={keyword}
            >
              <span>{displayText}.</span>
              <X aria-hidden="true" style={{ width: "4cqi", height: "4cqi" }} />
            </button>
          );
        })}

        {available.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="inline-flex items-center gap-[0.8cqi] rounded-[2cqi] border border-dashed border-[#EFC851]/70 bg-[#EFC851]/10 px-[2cqi] py-[1.1cqi] font-bold text-[#FFF0A8] transition-colors hover:border-[#FFF0A8] hover:bg-[#EFC851]/20 focus-visible:outline focus-visible:outline-[0.7cqi] focus-visible:outline-[#FFF0A8]"
            data-transfigure-add-keyword={placement}
          >
            <Plus aria-hidden="true" style={{ width: "4cqi", height: "4cqi" }} />
            {addLabel}
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label={addLabel}
          className={`absolute left-0 right-0 z-30 grid grid-cols-2 gap-[1cqi] rounded-[2cqi] border border-[#EFC851]/35 bg-black/95 p-[1.5cqi] shadow-[0_0_10cqi_rgba(0,0,0,0.75)] ${
            placement === "top"
              ? "top-full mt-[1.2cqi]"
              : "bottom-full mb-[1.2cqi]"
          }`}
          data-transfigure-keyword-options={placement}
        >
          {options.map((keyword) => {
            const displayText = getCardKeywordDisplayText(card, keyword);
            const isSelected = selected.has(keyword);
            return (
              <button
                key={keyword}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isSelected}
                onClick={() => addKeyword(keyword)}
                className="inline-flex min-w-0 items-center justify-center gap-[0.8cqi] rounded-[1.5cqi] border border-[#EFC851]/25 bg-[#EFC851]/10 px-[1.2cqi] py-[1.2cqi] font-bold text-[#EFC851] transition-colors hover:border-[#FFF0A8]/70 hover:bg-[#EFC851]/20 focus-visible:outline focus-visible:outline-[0.7cqi] focus-visible:outline-[#FFF0A8] disabled:opacity-45"
              >
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    style={{ width: "3.5cqi", height: "3.5cqi" }}
                  />
                )}
                <span className="truncate">{displayText}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
