import Image from "@/components/ui/static-image";
import type { ResolvedPatchArt } from "@/lib/sts2-patch-art";
import { cn } from "@/lib/utils";

export type PatchArtTone = "normal" | "building" | "watching";

const PATCH_ART_TONE_CLASS: Record<PatchArtTone, string> = {
  normal: "h-full w-full object-cover",
  building: "h-full w-full object-cover grayscale opacity-45 saturate-0",
  watching: "h-full w-full object-cover opacity-75 sepia saturate-150",
};

export function PatchArtPreview({
  art,
  priority = false,
  tone = "normal",
}: {
  art: ResolvedPatchArt;
  priority?: boolean;
  tone?: PatchArtTone;
}) {
  return (
    <div
      className="mt-3 aspect-[16/7] overflow-hidden rounded-md border border-border/70 bg-zinc-950"
      aria-label="패치 대표 아트"
    >
      <Image
        src={art.imageUrl}
        alt={art.alt}
        width={960}
        height={420}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        priority={priority}
        className={PATCH_ART_TONE_CLASS[tone]}
        style={{ objectPosition: art.objectPosition }}
      />
    </div>
  );
}

export function PatchArtThumbnail({
  art,
  className,
  tone = "normal",
}: {
  art: ResolvedPatchArt;
  className?: string;
  tone?: PatchArtTone;
}) {
  return (
    <span
      className={cn(
        "block h-10 w-14 shrink-0 overflow-hidden rounded border border-border/70 bg-zinc-950",
        className,
      )}
      aria-hidden
    >
      <Image
        src={art.imageUrl}
        alt=""
        width={112}
        height={80}
        loading="lazy"
        fetchPriority="low"
        className={PATCH_ART_TONE_CLASS[tone]}
        style={{ objectPosition: art.objectPosition }}
      />
    </span>
  );
}
