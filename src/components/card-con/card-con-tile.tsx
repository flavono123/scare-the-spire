"use client";

import Link from "next/link";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  CARD_CON_COMMENT_WIDTH_CLASS,
  CARD_CON_PICKER_TILE_CLASS,
} from "@/lib/card-con";
import type { CodexCard } from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function CardConTile({
  card,
  displayText,
  linked = false,
  variant = "comment",
}: {
  card: CodexCard | null;
  displayText: string;
  linked?: boolean;
  variant?: "comment" | "picker";
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();

  if (!card) {
    return <span className="spire-gold font-semibold">{displayText}</span>;
  }

  const frameClass = variant === "picker"
    ? CARD_CON_PICKER_TILE_CLASS
    : CARD_CON_COMMENT_WIDTH_CLASS;

  const tile = (
    <span className={cn("inline-block max-w-full align-middle", frameClass)}>
      <FittedCardTile
        card={card}
        serviceLocale={serviceLocale}
        showUpgrade={false}
        showBeta={false}
        interactive={false}
      />
    </span>
  );

  if (!linked) {
    return (
      <span data-card-con="" className="inline-block align-middle">
        {tile}
      </span>
    );
  }

  const href = localizeHrefWithGameLocale(
    buildCompendiumResourceHref("card", card.id),
    serviceLocale,
    gameLocale,
  );

  return (
    <Link
      href={href}
      data-card-con=""
      aria-label={displayText}
      className="inline-block align-middle"
    >
      {tile}
    </Link>
  );
}
