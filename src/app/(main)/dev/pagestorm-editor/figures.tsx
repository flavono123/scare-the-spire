import Image from "@/components/ui/static-image";
import { youtubeEmbedUrl } from "@/lib/youtube-reference";
import type { MockAlign, MockGameAsset, MockOgBookmark } from "./sample";

const ALIGN_CLASS: Record<MockAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function alignRowClass(align: MockAlign): string {
  return `my-3 flex w-full ${ALIGN_CLASS[align]}`;
}

export function GameAssetFigure({
  asset,
  align,
}: {
  asset: MockGameAsset;
  align: MockAlign;
}) {
  const card = asset.kind === "card";
  return (
    <div className={alignRowClass(align)}>
      <a href={asset.href} className="block no-underline" target="_blank" rel="noreferrer">
        <figure className={card ? "w-28 sm:w-32" : "w-14 sm:w-16"}>
          <Image
            src={asset.imageUrl}
            alt={asset.name}
            width={card ? 128 : 64}
            height={card ? 200 : 64}
            className="h-auto w-full"
          />
          <figcaption className="mt-1 text-center font-game-title text-xs spire-gold">
            {asset.name}
          </figcaption>
        </figure>
      </a>
    </div>
  );
}

export function YoutubePlayerFigure({
  videoId,
  title,
  align,
}: {
  videoId: string;
  title: string;
  align: MockAlign;
}) {
  return (
    <div className={alignRowClass(align)}>
      <div className="w-full max-w-xl overflow-hidden rounded-md border border-border bg-black">
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video h-auto w-full"
        />
      </div>
    </div>
  );
}

export function OgBookmarkFigure({
  bookmark,
  align,
}: {
  bookmark: MockOgBookmark;
  align: MockAlign;
}) {
  return (
    <div className={alignRowClass(align)}>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noreferrer"
        className="flex w-full max-w-xl overflow-hidden rounded-md border border-border bg-card/40 no-underline hover:border-primary/50"
      >
        {bookmark.image ? (
          <Image
            src={bookmark.image}
            alt=""
            width={144}
            height={96}
            className="h-24 w-36 shrink-0 object-cover"
          />
        ) : null}
        <span className="min-w-0 flex-1 p-3">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
            {bookmark.siteName}
          </span>
          <span className="mt-0.5 block font-game-title text-sm text-foreground">
            {bookmark.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
            {bookmark.description}
          </span>
        </span>
      </a>
    </div>
  );
}
