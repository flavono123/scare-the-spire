"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const GALLERY_PAGE_SIZE = 48;

export function BetaArtGallery({
  entries,
  serviceLocale,
  onOpen,
}: {
  entries: BetaArtEntry[];
  serviceLocale: ServiceLocale;
  onOpen: (key: string) => void;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.slice(0, visibleCount).map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={() => onOpen(entry.key)}
              className="group w-full overflow-hidden rounded-lg border border-border bg-card/90 text-left transition-colors hover:border-primary/60"
            >
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
              <span className="block truncate px-2 py-1.5 text-xs">{entry.name}</span>
            </button>
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
