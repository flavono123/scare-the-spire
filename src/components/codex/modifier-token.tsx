import Image from "@/components/ui/static-image";
import type { CodexModifier } from "@/lib/codex-types";

export function ModifierToken({
  modifier,
  size = 80,
}: {
  modifier: Pick<CodexModifier, "name" | "imageUrl"> | {
    name?: string | null;
    imageUrl?: string | null;
  };
  size?: number;
}) {
  if (!modifier.imageUrl) {
    return (
      <span
        className="relative inline-flex shrink-0 items-center justify-center font-game-title text-lg font-bold text-primary"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {(modifier.name || "?").slice(0, 1)}
      </span>
    );
  }

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Image
        src={modifier.imageUrl}
        alt={modifier.name ?? ""}
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
      />
    </span>
  );
}
