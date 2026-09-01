"use client";

import dynamic from "next/dynamic";
import Image from "@/components/ui/static-image";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { PagestormGameCopy } from "@/lib/borrowed-game-copy";
import { PAGESTORM_TOKEN_SRC } from "@/lib/pagestorm";
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
  const copy = serviceMessages[serviceLocale].pagestorm;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
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
        <ToyBoxIndexHeading
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
          heroRich
        />
      </header>
      <Editor />
    </div>
  );
}
