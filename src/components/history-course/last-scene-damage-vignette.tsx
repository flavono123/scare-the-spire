"use client";

/**
 * Event HP-loss screen flash from `scenes/vfx/ui/vfx_low_hp_border.tscn`:
 * red edge gradient, alpha curve 1 at 0.25 then down to 0.
 */
export function LastSceneDamageVignette({
  active,
  progress,
}: {
  active: boolean;
  progress: number;
}) {
  if (!active) return null;
  const t = Math.max(0, Math.min(1, progress));
  const alpha = t < 0.25 ? 0.75 : Math.max(0, 0.75 * (1 - (t - 0.25) / 0.75));
  if (alpha <= 0.01) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      data-history-damage-vignette
      style={{
        opacity: alpha,
        background:
          "radial-gradient(ellipse at center, rgba(188,0,0,0) 38%, rgba(188,0,0,0.72) 78%, rgba(82,7,7,0.92) 100%)",
      }}
      aria-hidden
    />
  );
}
