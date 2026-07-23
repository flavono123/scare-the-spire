"use client";

import { ExternalLink, Play, Youtube } from "lucide-react";
import Image from "@/components/ui/static-image";
import type { YouTubeBlock } from "@/lib/chemical-types";
import {
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube-reference";

interface ComboYouTubeReferenceProps {
  reference: YouTubeBlock;
}

export function ComboYouTubeThumbnail({
  reference,
}: ComboYouTubeReferenceProps) {
  const href = youtubeWatchUrl(reference.videoId);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/youtube relative block w-24 shrink-0 overflow-hidden rounded-md outline-none ring-1 ring-white/10 transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:ring-cyan-300/50 focus-visible:ring-2 focus-visible:ring-cyan-300 active:translate-y-0 motion-reduce:transform-none sm:w-32"
      aria-label={`${reference.title} · YouTube`}
      title={reference.title}
    >
      <Image
        src={youtubeThumbnailUrl(reference.videoId)}
        alt=""
        width={160}
        height={90}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video h-auto w-full object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90">
        <Youtube aria-hidden className="h-3 w-3 text-red-400" />
        YouTube
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-7 w-9 items-center justify-center rounded-lg bg-red-600/90 text-white shadow-lg transition-transform group-hover/youtube:scale-110 motion-reduce:transform-none">
          <Play aria-hidden className="h-3.5 w-3.5 fill-current" />
        </span>
      </span>
    </a>
  );
}

export function ComboYouTubeEmbed({
  reference,
}: ComboYouTubeReferenceProps) {
  const href = youtubeWatchUrl(reference.videoId);

  return (
    <section
      className="overflow-hidden rounded-xl bg-black/55 shadow-xl shadow-black/20 ring-1 ring-cyan-300/15"
      aria-label={reference.title}
    >
      <div className="aspect-video min-h-[200px] w-full">
        <iframe
          src={youtubeEmbedUrl(reference.videoId)}
          title={reference.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full min-h-[200px] w-full border-0"
        />
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 text-sm font-semibold spire-aqua transition-colors hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300"
      >
        <Youtube aria-hidden className="h-4 w-4 shrink-0 text-red-400" />
        <span className="min-w-0 flex-1 truncate">{reference.title}</span>
        <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </a>
    </section>
  );
}
