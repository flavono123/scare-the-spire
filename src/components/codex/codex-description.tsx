"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { GameHoverTip } from "@/components/codex/hover-tip";

export {
  cleanDescription,
  getCardMaxUpgradeLevel,
  hasCardUpgrade,
  parseDescription,
  renderCardDescription,
  type DescPart,
  type EnchantVarMod,
} from "@/lib/codex-card-description";
import { parseDescription, type DescPart } from "@/lib/codex-card-description";

// =============================================================================
// Tooltip component
// =============================================================================

export function TermTooltip({ name, desc }: { name: string; desc: string }) {
  return (
    <PortaledHoverTipLayer pin="bottom-left">
      <GameHoverTip title={name} style={{ minWidth: 180, maxWidth: 260 }}>
        <span className="block text-left">{desc}</span>
      </GameHoverTip>
    </PortaledHoverTipLayer>
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
  description?: string | null;
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
  const parts = parseDescription(description ?? "");
  const allTerms = { ...GOLD_TERM_DESC, ...termDescriptions };

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "gold" ? (
          <span
            key={i}
            className="relative text-primary font-bold cursor-help"
            onMouseEnter={() => setHoveredTerm(part.text)}
            onMouseLeave={() => setHoveredTerm(null)}
          >
            {part.text}
            {hoveredTerm === part.text && allTerms[part.text] && (
              <TermTooltip name={part.text} desc={allTerms[part.text]} />
            )}
          </span>
        ) : part.type === "upgrade" ? (
          <span key={i} className="text-[#6ee67a] font-bold">{part.text}</span>
        ) : part.type === "red" ? (
          <span key={i} className="text-red-400">{part.text}</span>
        ) : part.type === "blue" ? (
          <span key={i} className="text-blue-400 font-bold">{part.text}</span>
        ) : part.type === "purple" ? (
          <span key={i} style={{ color: "#EE82EE" }} className="font-bold">{part.text}</span>
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
        ) : part.type === "star" ? (
          <span key={i} className="inline-flex items-baseline gap-0">
            {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
              <Image
                key={j}
                src="/images/game-assets/card-misc/star_icon.png"
                alt="star"
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
