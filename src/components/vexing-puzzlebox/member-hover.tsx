"use client";

import { useState, type ReactNode } from "react";
import { PortaledHoverTipLayer } from "@/components/codex/card-keyword-tip-stack";
import { EntityPreview, GameResourcePreview } from "@/components/patch-note-renderer";
import { Sts1MentionHover } from "@/components/sts1/mention-hover";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type { ConnectionsMember } from "@/lib/vexing-puzzlebox-types";

/** An STS1 event or blight: the Compendium has no page for it, so its tip carries the game text. */
function NoteHover({
  member,
  className,
  children,
}: {
  member: ConnectionsMember;
  className?: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      tabIndex={0}
      className={`relative inline-flex cursor-help ${className ?? ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <PortaledHoverTipLayer pin="top-left">
          <GameResourcePreview
            title={member.name}
            imageUrl={member.imageUrl}
            imageAlt={member.name}
            imageClassName="h-16 w-16 object-contain"
            imageWidth={72}
            imageHeight={72}
          >
            <span className="whitespace-pre-line">{member.note?.description}</span>
          </GameResourcePreview>
        </PortaledHoverTipLayer>
      )}
    </span>
  );
}

/**
 * A Connections member's game hover tip: the STS2 Compendium, the STS1 Compendium, or the
 * game text of an STS1 thing the Compendium lacks. A name with no game data has none.
 * `inspect` keeps a click on the trigger from leaving the puzzle.
 */
export function MemberHover({
  member,
  serviceLocale,
  gameLocale,
  inspect = false,
  linkClassName,
  children,
}: {
  member: ConnectionsMember;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  inspect?: boolean;
  linkClassName?: string;
  children: ReactNode;
}) {
  if (member.entity) {
    return (
      <EntityPreview
        entity={member.entity}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        disableLink={inspect}
        linkClassName={linkClassName}
      >
        {children}
      </EntityPreview>
    );
  }
  if (member.sts1MentionId) {
    return (
      <Sts1MentionHover
        entityId={member.sts1MentionId}
        text={member.name}
        editorLink={inspect}
        className="relative inline-flex"
        linkClassName={linkClassName ?? "font-game-title font-semibold spire-gold no-underline"}
      >
        {children}
      </Sts1MentionHover>
    );
  }
  if (member.note) {
    return <NoteHover member={member} className={linkClassName}>{children}</NoteHover>;
  }
  return <>{children}</>;
}
