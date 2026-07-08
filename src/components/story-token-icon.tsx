import Image from "@/components/ui/static-image";

export const STORY_TOKEN_ICON_SRC = "/images/sts2/relics/storybook.webp";

export function StoryTokenIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={STORY_TOKEN_ICON_SRC}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 object-contain drop-shadow-[0_0_4px_rgba(250,204,21,0.35)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
