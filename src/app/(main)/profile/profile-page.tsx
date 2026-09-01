"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CHARACTER_STAGE_VIEWPORT_PADDING } from "@/components/codex/character-spine-stage";
import { EncounterSceneStage } from "@/components/codex/encounter-scene-stage";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import { ColorSchemePicker, type ColorSchemePickerCopy } from "@/components/color-scheme-picker";
import { ProfileActivity, type ProfileActivityCopy } from "@/components/profile-activity";
import { ProfileAvatarToken } from "@/components/profile/profile-avatar-token";
import { ProfilePalettePicker, type ProfilePalettePickerCopy } from "@/components/profile/profile-palette-picker";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import Image from "@/components/ui/static-image";
import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { CodexEncounter, CodexMonster, MonsterSpineAsset } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { resolveProfileDuotone } from "@/lib/profile-palettes";
import { normalizeUserProfile, type UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export type ProfileNicknameLocale = "ko" | "en";

export interface CharacterChoice {
  id: string;
  label: string;
  iconUrl: string;
  fallbackImageUrl: string;
  nicknameOptions: Record<ProfileNicknameLocale, readonly string[]>;
  spineAsset: MonsterSpineAsset | null;
}

export interface BossChoice {
  id: string;
  label: string;
  iconUrl: string;
  encounter: CodexEncounter;
  spinePreview: "encounter" | "static";
  staticPreviewUrl: string | null;
}

type ActionId = "IDLE" | "ATTACK" | "HURT";

export interface ProfilePageCopy {
  fallbackNickname: string;
  devBadge: string;
  nicknamePlaceholder: string;
  selectors: {
    character: string;
    boss: string;
  };
  palette: ProfilePalettePickerCopy;
  appearance: ColorSchemePickerCopy;
  activity: ProfileActivityCopy;
}

const DEFAULTS = {
  character: "NECROBINDER",
};

export default function ProfilePage({
  characters,
  bosses,
  bossMonsters,
  copy,
  nicknameLocale = "ko",
  gameLocale,
}: {
  characters: CharacterChoice[];
  bosses: BossChoice[];
  bossMonsters: CodexMonster[];
  copy: ProfilePageCopy;
  nicknameLocale?: ProfileNicknameLocale;
  gameLocale: GameLocale;
}) {
  const fallbackProfile = useMemo(
    () => normalizeUserProfile({
      nickname: getInitialNickname(characters, DEFAULTS.character, nicknameLocale, copy.fallbackNickname),
      characterId: DEFAULTS.character,
      avatarKind: "character",
      avatarId: DEFAULTS.character,
    }),
    [characters, copy.fallbackNickname, nicknameLocale],
  );
  const { profile, saveProfile } = useUserProfile(fallbackProfile);
  const [draftProfile, setDraftProfile] = useState(fallbackProfile);
  const [characterAction, setCharacterAction] = useActionState();

  useEffect(() => {
    setDraftProfile(profile);
  }, [profile]);

  const persistProfile = useCallback(
    (getNext: (current: UserProfile) => UserProfile) => {
      const next = normalizeUserProfile(getNext(draftProfile), fallbackProfile);
      setDraftProfile(next);
      void saveProfile(next).catch(() => undefined);
    },
    [draftProfile, fallbackProfile, saveProfile],
  );
  const persistNickname = useCallback(() => {
    persistProfile((current) => ({
      ...current,
      nickname: draftProfile.nickname,
    }));
  }, [draftProfile.nickname, persistProfile]);

  const character = findChoice(characters, draftProfile.characterId) ?? characters[0];
  const avatarCharacter = draftProfile.avatarKind === "character"
    ? findChoice(characters, draftProfile.avatarId) ?? character
    : null;
  const boss = draftProfile.avatarKind === "boss"
    ? findChoice(bosses, draftProfile.avatarId)
    : null;
  const duotone = resolveProfileDuotone(draftProfile);
  const serviceLocale: ServiceLocale = nicknameLocale;

  return (
    <main
      data-profile-page
      className="mx-auto w-full max-w-7xl px-3 sm:px-4"
    >
      <div
        data-profile-hero
        className="flex h-[calc(100svh-3.25rem)] flex-col gap-3 overflow-hidden py-2 md:h-[18rem] lg:h-[20rem] xl:h-[21rem]"
      >
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span data-profile-avatar-edit="" className="flex shrink-0 items-center gap-1">
              <ProfilePalettePicker
                paletteId={draftProfile.paletteId}
                paletteSwapped={draftProfile.paletteSwapped}
                copy={copy.palette}
                locale={nicknameLocale}
                onPick={(id) => {
                  persistProfile((current) => {
                    if (id === null) {
                      return { ...current, paletteId: null, paletteSwapped: false };
                    }
                    if (current.paletteId === id) {
                      return { ...current, paletteSwapped: !current.paletteSwapped };
                    }
                    return { ...current, paletteId: id, paletteSwapped: false };
                  });
                }}
              />
              <ProfileAvatarToken
                profile={draftProfile}
                size={28}
                className="h-7 w-7"
              />
            </span>
            <input
              type="text"
              aria-label={copy.nicknamePlaceholder}
              value={draftProfile.nickname}
              placeholder={copy.nicknamePlaceholder}
              maxLength={20}
              onChange={(event) => {
                const nickname = event.target.value;
                setDraftProfile((current) => ({ ...current, nickname }));
              }}
              onBlur={persistNickname}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="min-w-0 bg-transparent text-lg font-bold text-foreground outline-none placeholder:text-muted-foreground focus:text-primary"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ColorSchemePicker copy={copy.appearance} />
            {copy.devBadge ? (
              <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {copy.devBadge}
              </span>
            ) : null}
          </div>
        </header>

        <section
          data-profile-layout
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 md:grid-cols-[minmax(18rem,30%)_minmax(0,70%)] md:grid-rows-1 md:gap-4"
        >
          <div data-profile-controls className="flex min-h-0 flex-col gap-1.5 self-start pt-1">
            <ProfileRow
              label={copy.selectors.character}
              tokens={
                <TokenPicker
                  choiceType="character"
                  items={characters}
                  selectedId={draftProfile.avatarKind === "character" ? draftProfile.avatarId : undefined}
                  onSelect={(id) => {
                    const nextCharacter = findChoice(characters, id);
                    persistProfile((current) => ({
                      ...current,
                      characterId: id,
                      avatarKind: "character",
                      avatarId: id,
                      nickname: pickCharacterNickname(nextCharacter, nicknameLocale, copy.fallbackNickname),
                    }));
                    setCharacterAction("ATTACK");
                  }}
                />
              }
            />

            <ProfileRow
              label={copy.selectors.boss}
              tokens={
                <TokenPicker
                  choiceType="boss"
                  items={bosses}
                  selectedId={draftProfile.avatarKind === "boss" ? draftProfile.avatarId : undefined}
                  wrap
                  onSelect={(id) => {
                    persistProfile((current) => ({
                      ...current,
                      avatarKind: "boss",
                      avatarId: id,
                    }));
                    setCharacterAction("ATTACK");
                  }}
                />
              }
            />
          </div>

          <AvatarRender
            profile={draftProfile}
            character={avatarCharacter}
            identityCharacter={character}
            boss={boss}
            bossMonsters={bossMonsters}
            duotone={duotone}
            action={characterAction.action}
            actionNonce={characterAction.nonce}
            serviceLocale={serviceLocale}
          />
        </section>
      </div>

      <ProfileActivity copy={copy.activity} serviceLocale={nicknameLocale} gameLocale={gameLocale} />
    </main>
  );
}

function ProfileRow({
  label,
  tokens,
}: {
  label: string;
  tokens: ReactNode;
}) {
  return (
    <div className="grid min-h-0 grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-2">
      <div className="flex h-8 items-center">
        <h2 className="text-sm font-bold text-foreground">{label}</h2>
      </div>
      <div className="min-w-0 self-center">{tokens}</div>
    </div>
  );
}

function TokenPicker<T extends { id: string; label: string; iconUrl: string }>({
  choiceType,
  items,
  selectedId,
  wrap = false,
  onSelect,
}: {
  choiceType: "character" | "boss";
  items: T[];
  selectedId: string | undefined;
  wrap?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={cn("flex gap-0.5", wrap ? "flex-wrap" : "flex-nowrap")}>
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <GameUiHoverTip
            key={item.id}
            label={item.label}
            delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
          >
            <button
              type="button"
              data-profile-choice
              data-profile-choice-type={choiceType}
              data-profile-choice-id={item.id}
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              aria-label={item.label}
              className="group/index-token relative inline-flex h-8 w-8 shrink-0 items-center justify-center outline-none"
            >
              <Image
                src={item.iconUrl}
                alt=""
                width={28}
                height={28}
                className={cn(
                  "h-7 w-7 object-contain transition-[transform,filter] duration-150 group-hover/index-token:scale-110 group-hover/index-token:brightness-125 group-hover/index-token:drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]",
                  active
                    ? "scale-110 brightness-125 drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]"
                    : "opacity-80 hover:opacity-100",
                )}
              />
            </button>
          </GameUiHoverTip>
        );
      })}
    </div>
  );
}

function AvatarRender({
  profile,
  character,
  identityCharacter,
  boss,
  bossMonsters,
  duotone,
  action,
  actionNonce,
  serviceLocale,
}: {
  profile: UserProfile;
  character: CharacterChoice | null;
  identityCharacter: CharacterChoice | undefined;
  boss: BossChoice | undefined;
  bossMonsters: CodexMonster[];
  duotone: { shadow: string; highlight: string } | null;
  action: ActionId;
  actionNonce: number;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div
      data-profile-render
      data-profile-character-id={identityCharacter?.id ?? ""}
      data-profile-boss-id={profile.avatarKind === "boss" ? profile.avatarId : ""}
      data-profile-avatar-kind={profile.avatarKind}
      data-profile-avatar-id={profile.avatarId}
      data-profile-palette-id={profile.paletteId ?? ""}
      className="flex h-full min-h-[18rem] flex-col overflow-hidden md:min-h-0"
    >
      <div className="relative min-h-0 flex-1">
        {profile.avatarKind === "boss" && boss ? (
          <BossAvatarStage
            boss={boss}
            monsters={bossMonsters}
            duotone={duotone}
            action={action}
            actionNonce={actionNonce}
            serviceLocale={serviceLocale}
          />
        ) : (
          <MonsterSpineStage
            key={`avatar-${character?.id ?? "none"}`}
            asset={character?.spineAsset ?? null}
            fallbackImageUrl={character?.fallbackImageUrl ?? null}
            monsterName={character?.label ?? ""}
            selectedMoveId={action}
            selectedMoveNonce={actionNonce}
            imagePriority={false}
            showLoadingLabel={false}
            viewportTransitionTime={0}
            viewportPadding={CHARACTER_STAGE_VIEWPORT_PADDING}
            atlasDuotone={duotone}
            className="relative h-full w-full"
          />
        )}
      </div>
    </div>
  );
}

function BossAvatarStage({
  boss,
  monsters,
  duotone,
  action,
  actionNonce,
  serviceLocale,
}: {
  boss: BossChoice;
  monsters: CodexMonster[];
  duotone: { shadow: string; highlight: string } | null;
  action: ActionId;
  actionNonce: number;
  serviceLocale: ServiceLocale;
}) {
  if (boss.spinePreview === "encounter" && boss.encounter.scene) {
    return (
      <div className="absolute inset-0 flex items-center overflow-hidden">
            <EncounterSceneStage
              key={boss.id}
              encounter={boss.encounter}
          character={null}
          monsters={monsters}
          serviceLocale={serviceLocale}
          interactive={false}
          atlasDuotone={duotone}
          selectedMoveId={action}
          selectedMoveNonce={actionNonce}
        />
      </div>
    );
  }

  const tokenUrl = boss.staticPreviewUrl ?? boss.iconUrl;
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-white/10 bg-black">
      {boss.encounter.scene ? (
        <Image
          src={boss.encounter.scene.backgroundUrl}
          alt=""
          fill
          className="object-cover"
        />
      ) : null}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {duotone ? (
          <DuotoneCharacterToken
            iconUrl={tokenUrl}
            shadowHex={duotone.shadow}
            highlightHex={duotone.highlight}
            size={192}
            className="h-36 w-36 sm:h-48 sm:w-48"
          />
        ) : (
          <Image
            src={tokenUrl}
            alt={boss.label}
            width={192}
            height={192}
            className="h-36 w-36 object-contain sm:h-48 sm:w-48"
          />
        )}
      </div>
    </div>
  );
}

function useActionState(): [{ action: ActionId; nonce: number }, (action: ActionId) => void] {
  const [state, setState] = useState({ action: "IDLE" as ActionId, nonce: 0 });

  const setAction = (action: ActionId) => {
    setState((current) => ({
      action,
      nonce: current.nonce + 1,
    }));
  };

  return [state, setAction];
}

function findChoice<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

function getInitialNickname(
  characters: CharacterChoice[],
  characterId: string,
  locale: ProfileNicknameLocale,
  fallback: string,
): string {
  const character = findChoice(characters, characterId) ?? characters[0];
  return character?.nicknameOptions[locale]?.[0] ?? character?.label ?? fallback;
}

function pickCharacterNickname(
  character: CharacterChoice | undefined,
  locale: ProfileNicknameLocale,
  fallback: string,
): string {
  if (!character) return fallback;
  const options = character.nicknameOptions[locale];
  if (!options.length) return character.label;
  return options[Math.floor(Math.random() * options.length)] ?? character.label;
}
