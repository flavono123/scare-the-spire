import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GameCheckboxToggle } from "./game-checkbox";

const TICKBOX_FILL_SRC = "/images/game-assets/card-library/cost_tickbox.webp";
const TICKBOX_OUTLINE_SRC = "/images/game-assets/card-library/cost_tickbox_outline.webp";

export const CARD_DETAIL_UPGRADE_LEVEL_CAP = 99;

function clampUpgradeLevel(level: number, maxLevel: number): number {
  return Math.max(0, Math.min(Math.floor(level), maxLevel));
}

function UpgradeStepButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "minus" | "plus";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative h-8 w-8 shrink-0 rounded-sm transition-[filter,transform]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70",
        disabled ? "opacity-40" : "hover:scale-105 hover:brightness-125",
      )}
    >
      <Image
        src={TICKBOX_FILL_SRC}
        alt=""
        width={72}
        height={72}
        className={cn(
          "absolute inset-[16%] h-[68%] w-[68%] object-contain opacity-65",
          "[filter:brightness(0)_saturate(100%)_invert(22%)_sepia(14%)_saturate(1161%)_hue-rotate(139deg)_brightness(83%)_contrast(83%)]",
        )}
      />
      <Image
        src={TICKBOX_OUTLINE_SRC}
        alt=""
        width={72}
        height={72}
        className="absolute inset-0 h-full w-full object-contain [filter:sepia(0.22)_saturate(1.25)_brightness(1.1)_drop-shadow(2px_2px_0_rgba(0,0,0,0.75))]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pb-0.5 font-game-title text-[24px] font-bold leading-none tracking-[0] text-[#f1c94f] [text-shadow:2px_2px_0_rgba(0,0,0,0.82)]"
      >
        {direction === "minus" ? "-" : "+"}
      </span>
    </button>
  );
}

export function GameUpgradeToggle({
  upgradeLevel,
  maxUpgradeLevel,
  onUpgradeLevelChange,
  label,
  serviceLocale,
}: {
  upgradeLevel: number;
  maxUpgradeLevel: number;
  onUpgradeLevelChange: (level: number) => void;
  label: ReactNode;
  serviceLocale: ServiceLocale;
}) {
  const maxLevel = Math.max(
    1,
    Math.min(Math.floor(maxUpgradeLevel), CARD_DETAIL_UPGRADE_LEVEL_CAP),
  );
  const currentLevel = clampUpgradeLevel(upgradeLevel, maxLevel);
  const checked = currentLevel > 0;
  const labels = serviceLocale === "ko"
    ? {
        group: "강화 단계",
        decrease: "강화 단계 낮추기",
        increase: "강화 단계 올리기",
      }
    : {
        group: "Upgrade level",
        decrease: "Decrease upgrade level",
        increase: "Increase upgrade level",
      };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <GameCheckboxToggle
        checked={checked}
        onCheckedChange={(nextChecked) => onUpgradeLevelChange(nextChecked ? 1 : 0)}
        label={label}
        size="md"
      />
      {checked && (
        <div
          role="group"
          aria-label={labels.group}
          className="flex items-center gap-1 pl-0.5"
        >
          <UpgradeStepButton
            direction="minus"
            disabled={currentLevel <= 0}
            label={labels.decrease}
            onClick={() => onUpgradeLevelChange(clampUpgradeLevel(currentLevel - 1, maxLevel))}
          />
          <span
            aria-live="polite"
            className="min-w-[3.25rem] text-center font-game-title text-[20px] font-bold leading-none tracking-[0] text-[#f1c94f] [text-shadow:2px_2px_0_rgba(0,0,0,0.82)]"
            title={`+${currentLevel} / +${maxLevel}`}
          >
            +{currentLevel}
          </span>
          <UpgradeStepButton
            direction="plus"
            disabled={currentLevel >= maxLevel}
            label={labels.increase}
            onClick={() => onUpgradeLevelChange(clampUpgradeLevel(currentLevel + 1, maxLevel))}
          />
        </div>
      )}
    </div>
  );
}
