import Image from "@/components/ui/static-image";

export const STORY_WRITE_ICON_SRC = "/images/sts2/relics/pen_nib.webp";
export const STORY_STAT_ICON_SRC = "/images/sts2/relics/bone_tea.webp";

function GameAssetIcon({
  src,
  size,
  className,
}: {
  src: string;
  size: number;
  className: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function StoryWriteIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <GameAssetIcon
      src={STORY_WRITE_ICON_SRC}
      size={size}
      className={`drop-shadow-[0_0_4px_rgba(250,204,21,0.35)] ${className}`}
    />
  );
}

export function StoryStatIcon({
  size = 15,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <GameAssetIcon
      src={STORY_STAT_ICON_SRC}
      size={size}
      className={`opacity-80 grayscale-[0.15] ${className}`}
    />
  );
}
