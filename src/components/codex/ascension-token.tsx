import Image from "@/components/ui/static-image";
import { ASCENSION_TOKEN_IMAGE_URL, BLITZ_ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

export function AscensionToken({
  level,
  className,
  size = 80,
  blitz = false,
}: {
  level: number;
  className?: string;
  size?: number;
  /** Blitz run look (BlitzIconConfig): green bolt, green label, no label at 0. */
  blitz?: boolean;
}) {
  const outline = blitz ? "#054f22" : "#593400";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={blitz ? BLITZ_ASCENSION_TOKEN_IMAGE_URL : ASCENSION_TOKEN_IMAGE_URL}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
        aria-hidden
      />
      {!(blitz && level === 0) && (
      <span
        className={cn("absolute inset-0 flex items-center justify-center font-game-title font-bold leading-none", blitz ? "text-[#7fff00]" : "text-[#fff6e2]")}
        style={{
          fontSize: Math.max(18, Math.round(size * 0.36)),
          textShadow: `0 0 0 ${outline}, 2px 2px 0 rgba(0,0,0,0.45)`,
          WebkitTextStroke: `${Math.max(2, Math.round(size * 0.04))}px ${outline}`,
          paintOrder: "stroke fill",
        }}
      >
        {level}
      </span>
      )}
    </span>
  );
}
