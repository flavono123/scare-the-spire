import type { Metadata } from "next";
import Link from "next/link";
import { PatchArtPreview } from "@/components/patches/patch-art";
import { PatchSectionTabs } from "@/components/patches/patch-section-tabs";
import { IndexReadFrame } from "@/hooks/use-index-read";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getNeowsletters, neowsletterArt } from "@/lib/neowsletters";
import { PATCH_NOTES_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export function getNeowsletterListMetadata(serviceLocale: ServiceLocale): Metadata {
  const copy = serviceMessages[serviceLocale].neowsletters;
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.indexTitle,
    description: copy.metadataDescription,
    image: PATCH_NOTES_PAGE_OG_IMAGE,
    canonicalPath: "/patches/neowsletters",
  });
}

export async function NeowsletterListPage({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].neowsletters;
  const issues = await getNeowsletters();

  return (
    <div className={TOYBOX_WIDE_SHELL_CLASS}>
      <h1 className="text-2xl font-bold">{copy.indexTitle}</h1>
      <PatchSectionTabs
        active="neowsletters"
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
      <div className="mt-6 space-y-3">
        {issues.map((issue) => {
          const title = serviceLocale === "ko" ? issue.titleKo : issue.title;
          const summary = serviceLocale === "ko" ? issue.summaryKo : issue.summary;
          const art = neowsletterArt(issue, serviceLocale);
          return (
            <Link
              key={issue.id}
              href={localizeHrefWithGameLocale(`/patches/neowsletters/${issue.id}`, serviceLocale, gameLocale)}
              prefetch={false}
              className="block rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <IndexReadFrame surfaceId="neowsletters" publishedAt={issue.addedAt} className="block font-game-title text-lg text-primary">{title}</IndexReadFrame>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{summary}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{issue.date}</p>
              {art ? <PatchArtPreview art={art} priority /> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
