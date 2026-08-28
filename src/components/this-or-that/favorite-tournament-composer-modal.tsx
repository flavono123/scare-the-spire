"use client";

import { ServiceModalFrame } from "@/components/service-modal-frame";
import {
  FavoriteTournamentComposer,
  type FavoriteTournamentComposerValues,
} from "@/components/this-or-that/favorite-tournament-composer";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { FavoriteTournamentPost } from "@/lib/favorite-tournament";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export function FavoriteTournamentComposerModal({
  entities,
  entityMap,
  gameLocale,
  serviceLocale,
  presetLabels,
  submitLabel,
  profileNickname,
  hideNickname = false,
  initial,
  onSubmit,
  onClose,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  presetLabels: Record<string, string>;
  submitLabel: string;
  profileNickname: string;
  hideNickname?: boolean;
  initial?: FavoriteTournamentPost | null;
  onSubmit: (values: FavoriteTournamentComposerValues) => Promise<boolean>;
  onClose: () => void;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;

  return (
    <ServiceModalFrame
      title={copy.create}
      titleId="favorite-tournament-composer-title"
      closeLabel={copy.close}
      onClose={onClose}
      overlayClassName="items-center px-3 py-6"
      panelClassName="max-h-[90vh] max-w-6xl rounded-xl border-b border-border bg-background shadow-2xl sm:rounded-xl"
      showAccentDot
      titleClassName="spire-gold"
    >
      <FavoriteTournamentComposer
        entities={entities}
        entityMap={entityMap}
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        presetLabels={presetLabels}
        submitLabel={submitLabel}
        profileNickname={profileNickname}
        hideNickname={hideNickname}
        initial={initial}
        onSubmit={onSubmit}
      />
    </ServiceModalFrame>
  );
}
