import Link from "next/link";
import type { ReactNode } from "react";
import { ServiceBackground } from "@/components/service-background";
import Image from "@/components/ui/static-image";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import {
  BETA_ART_TOKEN_SRC,
  VEXING_PUZZLEBOX_BACKGROUND_SRC,
  VEXING_PUZZLEBOX_BETA_ART_HREF,
  VEXING_PUZZLEBOX_HREF,
  VEXING_PUZZLEBOX_TOKEN_SRC,
} from "@/lib/vexing-puzzlebox";
import { serviceMessages } from "@/messages/service";

export function VexingPuzzleboxShell({
  active,
  serviceLocale,
  gameLocale,
  children,
}: {
  active: "connections" | "beta-art";
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  children: ReactNode;
}) {
  const messages = serviceMessages[serviceLocale];
  const copy = messages.vexingPuzzlebox;
  const tabs = [
    {
      id: "connections" as const,
      label: copy.tabConnections,
      href: VEXING_PUZZLEBOX_HREF,
      icon: VEXING_PUZZLEBOX_TOKEN_SRC,
    },
    {
      id: "beta-art" as const,
      label: copy.tabBetaArt,
      href: VEXING_PUZZLEBOX_BETA_ART_HREF,
      icon: BETA_ART_TOKEN_SRC,
    },
  ];

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-vexing-puzzlebox-page={active}>
      <ServiceBackground src={VEXING_PUZZLEBOX_BACKGROUND_SRC} />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <header className="flex items-center gap-3">
          <Image
            src={VEXING_PUZZLEBOX_TOKEN_SRC}
            alt={messages.nav.vexingPuzzlebox}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0">
            <h1 className="font-service text-xl font-bold text-primary sm:text-3xl">
              {messages.nav.vexingPuzzlebox}
            </h1>
            <h2 className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</h2>
          </div>
        </header>
        <nav className="mt-4 flex items-center gap-5 border-b border-border" aria-label={copy.tabsLabel}>
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <Link
                key={tab.id}
                href={localizeHrefWithGameLocale(tab.href, serviceLocale, gameLocale)}
                prefetch={false}
                aria-current={selected ? "page" : undefined}
                className={`relative inline-flex items-center gap-2 pb-2.5 font-game-title text-sm transition-colors ${
                  selected
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Image src={tab.icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                <span>{tab.label}</span>
                {selected && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
