"use client";

import Image from "@/components/ui/static-image";

export {
  cleanDescription,
  getCardMaxUpgradeLevel,
  hasCardUpgrade,
  parseDescription,
  renderCardDescription,
  type DescPart,
  type EnchantVarMod,
} from "@/lib/codex-card-description";
import { parseDescription } from "@/lib/codex-card-description";

// =============================================================================
// Rendered description component (gold is highlight only: the game attaches tips in code, not by word)
// =============================================================================

interface DescriptionTextProps {
  description?: string | null;
  energyIcon?: string;
  className?: string;
}

export function DescriptionText({
  description,
  energyIcon = "/images/game-assets/card-misc/energy_colorless.png",
  className = "",
}: DescriptionTextProps) {
  const parts = parseDescription(description ?? "");

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "gold" ? (
          <span key={i} className="text-primary font-bold">{part.text}</span>
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
