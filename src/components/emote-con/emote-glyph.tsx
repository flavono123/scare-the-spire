import Image from "@/components/ui/static-image";
import { emoteById, emoteLabel, emoteSrc, type EmoteId } from "@/lib/emote-con";
import { cn } from "@/lib/utils";

export function EmoteGlyph({
  emoteId,
  locale = "ko",
  className,
}: {
  emoteId: string;
  locale?: "ko" | "en";
  className?: string;
}) {
  const emote = emoteById(emoteId);
  if (!emote) return null;

  return (
    <Image
      src={emoteSrc(emote.id as EmoteId)}
      alt={emoteLabel(emote.id, locale)}
      width={24}
      height={24}
      data-emote-con=""
      data-emote-id={emote.id}
      className={cn("mx-0.5 inline-block h-6 w-6 align-middle object-contain", className)}
    />
  );
}
