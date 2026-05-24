"use client";

import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

export function ancientNodeImageUrl(ancientId: string, outline = false): string {
  const slug = ancientId.toLowerCase();
  return `/images/sts2/ancient-nodes/ancient_node_${slug}${outline ? "_outline" : ""}.webp`;
}

export function AncientNodeRender({
  ancientId,
  className,
  imagePriority = false,
  sizes = "14rem",
}: {
  ancientId: string;
  className?: string;
  imagePriority?: boolean;
  sizes?: string;
}) {
  const imageUrl = ancientNodeImageUrl(ancientId);
  const outlineImageUrl = ancientNodeImageUrl(ancientId, true);

  return (
    <div className={cn("relative aspect-square", className)}>
      <Image
        src={outlineImageUrl}
        alt=""
        fill
        sizes={sizes}
        className="scale-[1.08] object-contain drop-shadow-[0_0_18px_rgba(96,165,250,0.45)]"
        priority={imagePriority}
        loading={imagePriority ? "eager" : "lazy"}
      />
      <Image
        src={outlineImageUrl}
        alt=""
        fill
        sizes={sizes}
        className="object-contain brightness-0"
        priority={imagePriority}
        loading={imagePriority ? "eager" : "lazy"}
      />
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes={sizes}
        className="object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"
        priority={imagePriority}
        loading={imagePriority ? "eager" : "lazy"}
      />
    </div>
  );
}
