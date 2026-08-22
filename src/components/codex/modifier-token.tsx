import Image from "@/components/ui/static-image";
import type { CodexModifier } from "@/lib/codex-types";

export function ModifierToken({
  modifier,
  size = 80,
}: {
  modifier: Pick<CodexModifier, "name" | "imageUrl">;
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Image
        src={modifier.imageUrl}
        alt={modifier.name}
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
      />
    </span>
  );
}
