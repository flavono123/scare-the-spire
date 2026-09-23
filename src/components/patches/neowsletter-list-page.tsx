import type { Metadata } from "next";
import Link from "next/link";
import { PatchSectionTabs } from "@/components/patches/patch-section-tabs";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getNeowsletters } from "@/lib/neowsletters";
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
          return (
            <Link
              key={issue.id}
              href={localizeHrefWithGameLocale(`/patches/neowsletters/${issue.id}`, serviceLocale, gameLocale)}
              prefetch={false}
              className="block rounded-lg border border-border/70 bg-card/40 px-4 py-3 transition-colors hover:border-primary/50"
            >
              <p className="text-xs text-muted-foreground">{issue.date}</p>
              <p className="mt-1 font-game-title text-lg text-primary">{title}</p>
              <p className="mt-2 text-sm text-foreground/90">{summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
