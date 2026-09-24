import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PatchArtPreview } from "@/components/patches/patch-art";
import { PatchNoteRenderer } from "@/components/patch-note-renderer";
import { NeowsletterClaimThread } from "@/components/patches/neowsletter-claim-thread";
import { PatchSectionTabs } from "@/components/patches/patch-section-tabs";
import { buildNeowsletterCommentThreadKey } from "@/lib/comment-threads";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  getNeowsletter,
  getNeowsletters,
  neowsletterArt,
  readNeowsletterDocument,
} from "@/lib/neowsletters";
import { PATCH_NOTES_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateNeowsletterStaticParams() {
  const issues = await getNeowsletters();
  return issues.map((issue) => ({ issue: issue.id }));
}

export async function getNeowsletterDetailMetadata({
  issueId,
  serviceLocale,
}: {
  issueId: string;
  serviceLocale: ServiceLocale;
}): Promise<Metadata> {
  const issue = await getNeowsletter(issueId);
  const copy = serviceMessages[serviceLocale].neowsletters;
  const title = issue
    ? (serviceLocale === "ko" ? issue.titleKo : issue.title)
    : copy.indexTitle;
  const description = issue
    ? (serviceLocale === "ko" ? issue.summaryKo : issue.summary)
    : copy.metadataDescription;
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: PATCH_NOTES_PAGE_OG_IMAGE,
    canonicalPath: `/patches/neowsletters/${issueId}`,
  });
}

export async function NeowsletterDetailPage({
  issueId,
  serviceLocale,
  gameLocale,
  staticHoverPreviews = false,
}: {
  issueId: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  staticHoverPreviews?: boolean;
}) {
  const issue = await getNeowsletter(issueId);
  if (!issue) notFound();

  const [document, entities, gameUi] = await Promise.all([
    readNeowsletterDocument(issueId, serviceLocale),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const copy = serviceMessages[serviceLocale].neowsletters;
  const title = serviceLocale === "ko" ? issue.titleKo : issue.title;
  const listHref = localizeHrefWithGameLocale("/patches/neowsletters", serviceLocale, gameLocale);
  const art = neowsletterArt(issue, serviceLocale);
  const authoredGameLocale = serviceLocale === "ko" ? "kor" : "eng";
  const rendererProps = {
    entities,
    gameUi,
    serviceLocale,
    gameLocale,
    preferEntityLocaleLabel: gameLocale !== authoredGameLocale,
    staticHoverPreviews,
  };

  return (
    <div className={TOYBOX_WIDE_SHELL_CLASS} data-neowsletter-issue={issue.id}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <PatchSectionTabs
        active="neowsletters"
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href={listHref} prefetch={false} className="hover:text-foreground">
          {copy.backToList}
        </Link>
        <span>{issue.date}</span>
        <a
          href={issue.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
        >
          <img
            src="/images/neowsletters/source/megacrit.jpg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 rounded-sm"
          />
          {copy.source} &rarr;
        </a>
        {issue.steamUrl ? (
          <a
            href={issue.steamUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
          >
            <img
              src="/images/neowsletters/source/steam.png"
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
            />
            {copy.steam} &rarr;
          </a>
        ) : null}
      </p>
      {art ? <PatchArtPreview art={art} priority /> : null}
      {document.claims.map((claim) => (
        <section key={claim.id} id={`claim-${claim.id}`} data-neowsletter-claim={claim.id} className="mt-6">
          <PatchNoteRenderer
            markdown={claim.markdown}
            {...rendererProps}
          />
          <NeowsletterClaimThread
            threadKey={buildNeowsletterCommentThreadKey(issue.id, claim.id)}
            label={copy.comments}
          />
        </section>
      ))}
      <section id="comments" className="mt-8 rounded-lg border border-border bg-card/20 p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">{copy.comments}</h2>
        <div
          data-patch-comment-root
          data-thread-key={buildNeowsletterCommentThreadKey(issue.id, "page")}
        />
      </section>
    </div>
  );
}
