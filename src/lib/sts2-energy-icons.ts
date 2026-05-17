import type { CardColor } from "./codex-types";

export type Sts2EnergyIconVariant = CardColor | "colorless";

export const STS2_ENERGY_ICON_BY_VARIANT: Record<Sts2EnergyIconVariant, string> = {
  ironclad: "/images/game-assets/card-misc/energy_ironclad.png",
  silent: "/images/game-assets/card-misc/energy_silent.png",
  defect: "/images/game-assets/card-misc/energy_defect.png",
  necrobinder: "/images/game-assets/card-misc/energy_necrobinder.png",
  regent: "/images/game-assets/card-misc/energy_regent.png",
  colorless: "/images/game-assets/card-misc/energy_colorless.png",
  curse: "/images/game-assets/card-misc/energy_colorless.png",
  event: "/images/game-assets/card-misc/energy_colorless.png",
  status: "/images/game-assets/card-misc/energy_colorless.png",
  token: "/images/game-assets/card-misc/energy_colorless.png",
  quest: "/images/game-assets/card-misc/energy_quest.png",
};

export function resolveSts2EnergyIcon(
  variant: Sts2EnergyIconVariant = "colorless",
): string {
  return STS2_ENERGY_ICON_BY_VARIANT[variant] ?? STS2_ENERGY_ICON_BY_VARIANT.colorless;
}
