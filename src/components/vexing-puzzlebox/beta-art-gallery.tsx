"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { BetaArtReactions, type BetaArtAuth } from "@/components/vexing-puzzlebox/beta-art-engagement";
import { buildBetaArtCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const GALLERY_PAGE_SIZE = 48;

export function BetaArtGallery({
  entries,
  likes,
  comments,
  auth,
  serviceLocale,
  onOpen,
}: {
  entries: BetaArtEntry[];
  likes: Record<string, number>;
  comments: Record<string, number>;
  auth: BetaArtAuth;
  serviceLocale: ServiceLocale;
  onOpen: (key: string, options?: { comments?: boolean }) => void;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.slice(0, visibleCount).map((entry) => (
          <li key={entry.key}>
            <div className="group w-full overflow-hidden rounded-lg border border-border bg-card/90 transition-colors hover:border-primary/60">
              <button type="button" onClick={() => onOpen(entry.key)} className="block w-full text-left">
                <span className="relative block aspect-[25/19] bg-black/40">
                  <Image
                    src={entry.betaUrl}
                    alt={entry.name}
                    width={320}
                    height={240}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
                  />
                  {entry.officialUrl && (
                    <Image
                      src={entry.officialUrl}
                      alt=""
                      width={320}
                      height={240}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  )}
                </span>
              </button>
              <span className="flex items-center justify-between gap-1 px-2 py-1">
                <button type="button" onClick={() => onOpen(entry.key)} className="min-w-0 truncate text-left text-xs">
                  {entry.name}
                </button>
                <BetaArtReactions
                  artKey={entry.key}
                  likeCount={likes[buildBetaArtCommentThreadKey(entry.key)] ?? 0}
                  commentCount={comments[buildBetaArtCommentThreadKey(entry.key)] ?? 0}
                  auth={auth}
                  onComments={() => onOpen(entry.key, { comments: true })}
                  serviceLocale={serviceLocale}
                  size={13}
                  className="shrink-0"
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
      {visibleCount < entries.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + GALLERY_PAGE_SIZE)}
            className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-primary/60"
          >
            {copy.next} ({visibleCount}/{entries.length})
          </button>
        </div>
      )}
    </>
  );
}
