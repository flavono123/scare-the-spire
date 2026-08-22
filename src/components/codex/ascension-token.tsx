import Image from "@/components/ui/static-image";
import { ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

export function AscensionToken({
  level,
  className,
  size = 80,
}: {
  level: number;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={ASCENSION_TOKEN_IMAGE_URL}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
        aria-hidden
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-game-title font-bold leading-none text-[#fff6e2]"
        style={{
          fontSize: Math.max(18, Math.round(size * 0.36)),
          textShadow: "0 0 0 #593400, 2px 2px 0 rgba(0,0,0,0.45)",
          WebkitTextStroke: `${Math.max(2, Math.round(size * 0.04))}px #593400`,
          paintOrder: "stroke fill",
        }}
      >
        {level}
      </span>
    </span>
  );
}
