"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "@/components/ui/static-image";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { PagestormGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import {
  PAGESTORM_HREF,
  PAGESTORM_LOREM_HREF,
  PAGESTORM_LOREM_SNIPPET,
  PAGESTORM_TOKEN_SRC,
  PAGESTORM_WRITE_HREF,
} from "@/lib/pagestorm";
import { serviceMessages } from "@/messages/service";

function EditorLoading() {
  const serviceLocale = useServiceLocale();
  return (
    <p className="p-4 text-sm text-muted-foreground">
      {serviceMessages[serviceLocale].pagestorm.editorLoading}
    </p>
  );
}

const Editor = dynamic(
  () => import("./pagestorm-editor").then((mod) => mod.PagestormEditor),
  {
    ssr: false,
    loading: EditorLoading,
  },
);

export function PagestormClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const writeHref = localizeHrefWithGameLocale(
    PAGESTORM_WRITE_HREF,
    serviceLocale,
    gameLocale,
  );
  const loremHref = localizeHrefWithGameLocale(
    PAGESTORM_LOREM_HREF,
    serviceLocale,
    gameLocale,
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={PAGESTORM_TOKEN_SRC}
              alt={gameCopy.title}
              width={32}
              height={32}
              className="object-contain"
            />
            <h1 className="truncate font-service text-xl font-bold text-primary">
              {gameCopy.title}
            </h1>
          </div>
          <Link
            href={writeHref}
            className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src={PAGESTORM_TOKEN_SRC}
              alt=""
              width={18}
              height={18}
              className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
            />
            {copy.create}
          </Link>
        </div>
        <ToyBoxIndexHeading
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
          heroRich
        />
      </header>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          {copy.count.replace("{count}", "1")}
        </p>
        <Link
          href={loremHref}
          className="block rounded-lg border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
        >
          <article data-pagestorm-post="lorem">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="truncate text-sm font-semibold text-gray-300">
                {copy.defaultNickname}
              </span>
            </div>
            <h2 className="font-game-title text-base text-foreground">
              {copy.sampleHeading}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {PAGESTORM_LOREM_SNIPPET}
            </p>
          </article>
        </Link>
      </div>
    </div>
  );
}

function PagestormDocumentClient({
  gameCopy,
  surface,
}: {
  gameCopy: PagestormGameCopy;
  surface: "write" | "lorem";
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const indexHref = localizeHrefWithGameLocale(
    PAGESTORM_HREF,
    serviceLocale,
    gameLocale,
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <Link
          href={indexHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          {copy.backToIndex}
        </Link>
        <div className="flex items-center gap-3">
          <Image
            src={PAGESTORM_TOKEN_SRC}
            alt={gameCopy.title}
            width={32}
            height={32}
            className="object-contain"
          />
          <h1 className="font-service text-xl font-bold text-primary">{gameCopy.title}</h1>
        </div>
      </header>
      <Editor mode={surface === "lorem" ? "preview" : "edit"} />
    </div>
  );
}

export function PagestormWriteClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  return <PagestormDocumentClient gameCopy={gameCopy} surface="write" />;
}

export function PagestormLoremClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  return <PagestormDocumentClient gameCopy={gameCopy} surface="lorem" />;
}
