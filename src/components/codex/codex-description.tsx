"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";

// =============================================================================
// Description parsing (BBCode -> structured parts)
// =============================================================================

export interface DescPart {
  type: "text" | "gold" | "newline" | "energy";
  text: string;
}

export function cleanDescription(desc: string): string {
  let text = desc;
  text = text.replace(/choose\([^)]*\):([^|}]*)\|[^}]*\}/g, "$1");
  text = text.replace(/\{[^}]*\}/g, "");
  text = text.replace(/\[[A-Z][a-zA-Z]*\]/g, "");
  return text;
}

export function parseDescription(rawDesc: string): DescPart[] {
  const desc = cleanDescription(rawDesc);
  const parts: DescPart[] = [];
  const regex = /\[gold\](.*?)\[\/gold\]|\[energy:(\d+)\]|\[\/?\w+(?::?\w*)*\]|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: desc.slice(lastIndex, match.index) });
    }
    if (match[0] === "\n") {
      parts.push({ type: "newline", text: "" });
    } else if (match[1] !== undefined) {
      parts.push({ type: "gold", text: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "energy", text: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < desc.length) {
    parts.push({ type: "text", text: desc.slice(lastIndex) });
  }
  return parts;
}

// =============================================================================
// Tooltip component
// =============================================================================

export function TermTooltip({ name, desc }: { name: string; desc: string }) {
  return (
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 bg-[#0a0a1a]/95 border border-yellow-500/30 rounded px-2 py-1.5 text-left z-50 pointer-events-none shadow-xl">
      <span className="font-bold text-yellow-400 text-[10px] block">{name}</span>
      <span className="text-[9px] text-gray-300 font-normal leading-relaxed not-italic">{desc}</span>
    </span>
  );
}

// =============================================================================
// Shared keyword/term descriptions
// =============================================================================

export const KEYWORD_DESC: Record<string, string> = {
  교활: "교활 카드는 사일런트 카드 더미에 합류합니다.",
  보존: "이 카드는 턴 종료 시 버려지지 않습니다.",
  사용불가: "이 카드는 사용할 수 없습니다.",
  선천성: "이 카드는 매 전투 시작 시 손에 들어옵니다.",
  소멸: "이 카드는 사용 후 게임에서 제거됩니다.",
  영구: "이 카드는 어떤 방법으로도 제거할 수 없습니다.",
  휘발성: "이 카드는 턴 종료 시 손에 있으면 소멸합니다.",
};

export const GOLD_TERM_DESC: Record<string, string> = {
  힘: "카드의 공격 피해량이 증가합니다.",
  민첩: "카드의 방어도 획득량이 증가합니다.",
  방어도: "받는 피해를 줄여줍니다. 매 턴 시작 시 사라집니다.",
  약화: "약화된 적은 25% 적은 피해를 줍니다.",
  취약: "취약한 대상은 50% 더 많은 피해를 받습니다.",
  불가침: "체력이 1 이하로 줄어들지 않습니다.",
  가시: "피격 시 공격자에게 피해를 줍니다.",
  소환: "하수인을 소환합니다.",
  강화: "카드를 영구적으로 강화합니다.",
  활력: "다음에 사용하는 공격 카드의 피해량이 증가합니다.",
  집중: "오브의 패시브 효과가 증가합니다.",
  영창: "영창 시, 처음으로 비어있는 슬롯에 구체가 들어갑니다.",
  전기: "구체: 무작위 적에게 피해를 줍니다.",
  냉기: "구체: 턴 종료 시 방어도를 얻습니다.",
  어둠: "구체: 발현 시 축적된 어둠만큼 피해를 줍니다.",
  플라즈마: "구체: 턴 시작 시 에너지를 얻습니다.",
  독: "독에 걸린 적은 매 턴 독만큼의 피해를 받고 독이 1 줄어듭니다.",
  멸망: "멸망이 적용된 적은 체력이 멸망 이하가 되면 즉사합니다.",
  도금: "받는 피해를 줄여줍니다. 턴 시작 시 사라지지 않습니다.",
  단조: "단조한 만큼 카드를 강화할 수 있습니다.",
};

// =============================================================================
// Rendered description component with hover tooltips
// =============================================================================

interface DescriptionTextProps {
  description: string;
  energyIcon?: string;
  className?: string;
  termDescriptions?: Record<string, string>;
}

export function DescriptionText({
  description,
  energyIcon = "/images/game-assets/card-misc/energy_colorless.png",
  className = "",
  termDescriptions,
}: DescriptionTextProps) {
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);
  const parts = parseDescription(description);
  const allTerms = { ...GOLD_TERM_DESC, ...termDescriptions };

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "gold" ? (
          <span
            key={i}
            className="relative text-yellow-500 font-bold cursor-help"
            onMouseEnter={() => setHoveredTerm(part.text)}
            onMouseLeave={() => setHoveredTerm(null)}
          >
            {part.text}
            {hoveredTerm === part.text && allTerms[part.text] && (
              <TermTooltip name={part.text} desc={allTerms[part.text]} />
            )}
          </span>
        ) : part.type === "energy" ? (
          <span key={i} className="inline-flex items-baseline gap-0">
            {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
              <Image
                key={j}
                src={energyIcon}
                alt="energy"
                width={14}
                height={14}
                className="inline-block align-text-bottom mx-0.5"
              />
            ))}
          </span>
        ) : part.type === "newline" ? (
          <br key={i} />
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}
