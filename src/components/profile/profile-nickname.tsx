"use client";

import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

/** Nickname plus optional remapped token for comment and Toy Box chrome. */
export function ProfileNickname({
  nickname,
  iconUrl,
  duotone,
  size = 16,
  className,
  tokenClassName,
  nicknameClassName,
}: {
  nickname: string;
  iconUrl: string | null;
  duotone: { shadow: string; highlight: string } | null;
  size?: number;
  className?: string;
  tokenClassName?: string;
  nicknameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {iconUrl ? (
        <span data-dev-nickname-token data-icon-url={iconUrl} className="shrink-0">
          {duotone ? (
            <DuotoneCharacterToken
              iconUrl={iconUrl}
              shadowHex={duotone.shadow}
              highlightHex={duotone.highlight}
              size={size}
              className={tokenClassName}
            />
          ) : (
            <Image
              src={iconUrl}
              alt=""
              width={size}
              height={size}
              className={cn("object-contain", tokenClassName)}
            />
          )}
        </span>
      ) : null}
      <span className={cn("truncate", nicknameClassName)}>{nickname}</span>
    </span>
  );
}
