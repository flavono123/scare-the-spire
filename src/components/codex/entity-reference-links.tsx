import Image from "@/components/ui/static-image";
import Link from "next/link";
import type { ReactNode } from "react";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";

export interface CodexReferenceLinkItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  description?: ReactNode;
  imageAlt?: string;
  imageSrc?: string | null;
}

interface EntityReferenceLinksProps {
  items: readonly CodexReferenceLinkItem[];
  serviceLocale: ServiceLocale;
  title: string;
}

export function EntityReferenceLinks({
  items,
  serviceLocale,
  title,
}: EntityReferenceLinksProps) {
  if (items.length === 0) return null;

  return (
    <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="mb-3 text-sm font-bold text-gray-300">{title}</h2>
      <div className="grid gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={localizeHref(item.href, serviceLocale)}
            className="group flex items-start gap-3 rounded-md border border-white/10 bg-black/20 p-3 transition-colors hover:border-yellow-300/50 hover:bg-yellow-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/50"
          >
            {item.imageSrc ? (
              <span className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                <Image
                  src={item.imageSrc}
                  alt={item.imageAlt ?? ""}
                  fill
                  sizes="44px"
                  className="object-contain p-1"
                />
              </span>
            ) : (
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-yellow-300/30 bg-yellow-300/10 text-lg font-black text-yellow-200">
                ?
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-yellow-100 transition-colors group-hover:text-yellow-50">
                {item.title}
              </span>
              {item.subtitle ? (
                <span className="mt-0.5 block text-xs text-gray-400">{item.subtitle}</span>
              ) : null}
              {item.description ? (
                <span className="mt-2 block text-sm leading-relaxed text-gray-200">
                  {item.description}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
