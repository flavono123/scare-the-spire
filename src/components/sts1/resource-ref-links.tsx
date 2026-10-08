"use client";

import Link from "next/link";
import Image from "@/components/ui/static-image";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1ResourceRef } from "@/lib/sts1/types";

export function Sts1ResourceRefLinks({
  title,
  refs,
  serviceLocale,
}: {
  title: string;
  refs: readonly Sts1ResourceRef[];
  serviceLocale: ServiceLocale;
}) {
  if (refs.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
      <h2 className="mb-2 font-game-title text-sm font-bold text-foreground">{title}</h2>
      <ul className="flex flex-col gap-1">
        {refs.map((ref) => (
          <li key={`${ref.type}:${ref.id}`}>
            <Link
              href={localizeHref(sts1DetailPath(ref.type, ref.slug), serviceLocale)}
              className="flex items-center gap-2 rounded px-1.5 py-1 font-game-text text-sm text-primary transition-colors hover:bg-white/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-black/30">
                <Image
                  src={ref.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className={ref.type === "cards" ? "h-full w-full object-cover" : "h-7 w-7 object-contain"}
                />
              </span>
              <span className="min-w-0 truncate">{ref.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
