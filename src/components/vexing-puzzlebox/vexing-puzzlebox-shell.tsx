import Link from "next/link";
import type { ReactNode } from "react";
import { ServiceBackground } from "@/components/service-background";
import { PuzzleboxSoundSettings } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { VexingPuzzleboxEffects } from "@/components/vexing-puzzlebox/vexing-puzzlebox-effects";
import Image from "@/components/ui/static-image";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import {
  BETA_ART_TOKEN_SRC,
  CONNECTIONS_TOKEN_SRC,
  RANKINGS_TOKEN_SRC,
  VEXING_PUZZLEBOX_BACKGROUND_SRC,
  VEXING_PUZZLEBOX_BETA_ART_HREF,
  VEXING_PUZZLEBOX_HREF,
  VEXING_PUZZLEBOX_RANKINGS_HREF,
  VEXING_PUZZLEBOX_TOKEN_SRC,
} from "@/lib/vexing-puzzlebox";
import { serviceMessages } from "@/messages/service";

export function VexingPuzzleboxShell({
  active,
  gameCopy,
  serviceLocale,
  gameLocale,
  children,
}: {
  active: "connections" | "beta-art" | "rankings";
  gameCopy: VexingPuzzleboxGameCopy;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  children: ReactNode;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const tabs = [
    {
      id: "connections" as const,
      label: copy.tabConnections,
      href: VEXING_PUZZLEBOX_HREF,
      icon: CONNECTIONS_TOKEN_SRC,
    },
    {
      id: "beta-art" as const,
      label: copy.tabBetaArt,
      href: VEXING_PUZZLEBOX_BETA_ART_HREF,
      icon: BETA_ART_TOKEN_SRC,
    },
    {
      id: "rankings" as const,
      label: copy.tabRankings,
      href: VEXING_PUZZLEBOX_RANKINGS_HREF,
      icon: RANKINGS_TOKEN_SRC,
    },
  ];

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-vexing-puzzlebox-page={active}>
      <ServiceBackground src={VEXING_PUZZLEBOX_BACKGROUND_SRC} />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <header className="flex items-center gap-3">
          <Image
            src={VEXING_PUZZLEBOX_TOKEN_SRC}
            alt={gameCopy.title}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0">
            <h1 className="font-service text-xl font-bold text-primary sm:text-3xl">
              {gameCopy.title}
            </h1>
            <h2 className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</h2>
            {gameCopy.hero && <p className="mt-0.5 text-xs text-red-300/90">{gameCopy.hero}</p>}
          </div>
        </header>
        {/* On phones the icon stacks over the label: three labels side by side outgrow 320px. */}
        <nav className="mt-4 flex items-end gap-3 border-b border-border sm:items-center sm:gap-5" aria-label={copy.tabsLabel}>
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <Link
                key={tab.id}
                href={localizeHrefWithGameLocale(tab.href, serviceLocale, gameLocale)}
                prefetch={false}
                aria-current={selected ? "page" : undefined}
                className={`relative inline-flex flex-col items-center gap-0.5 pb-2 font-game-title text-xs transition-colors sm:flex-row sm:gap-2 sm:pb-2.5 sm:text-sm ${
                  selected
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Image src={tab.icon} alt="" width={48} height={48} className="h-6 w-6 object-contain" />
                <span className="whitespace-nowrap">{tab.label}</span>
                {selected && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
              </Link>
            );
          })}
          <div className="ml-auto pb-1.5">
            <PuzzleboxSoundSettings
              title={gameCopy.soundTab}
              musicLabel={gameCopy.musicVolume}
              effectsLabel={gameCopy.sfxVolume}
              waitingLabel={copy.musicWaiting}
            />
          </div>
        </nav>
        <div className="mt-5">
          <VexingPuzzleboxEffects gameCopy={gameCopy}>{children}</VexingPuzzleboxEffects>
        </div>
      </div>
    </div>
  );
}
