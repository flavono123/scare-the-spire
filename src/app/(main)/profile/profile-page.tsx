"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AncientNodeRender } from "@/components/codex/ancient-node-render";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import { ProfileActivity, type ProfileActivityCopy } from "@/components/profile-activity";
import Image from "@/components/ui/static-image";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { MonsterSpineAsset } from "@/lib/codex-types";
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

export interface PetChoice {
  id: string;
  monsterId: string;
  label: string;
  iconUrl: string;
  fallbackImageUrl: string;
  selectedSkin: string | null;
  selectedSkins: readonly string[] | null;
  skinOptions: readonly PetSkinOption[];
  spineAsset: MonsterSpineAsset | null;
}

export interface PetSkinOption {
  id: string;
  label: string;
  selectedSkins: readonly string[];
}

export interface AncientChoice {
  id: string;
  label: string;
  subtitle: string;
  iconUrl: string;
}

type ActionId = "IDLE" | "ATTACK" | "HURT";

export interface ProfilePageCopy {
  fallbackNickname: string;
  devBadge: string;
  nicknamePlaceholder: string;
  selectors: {
    character: string;
    pet: string;
    ancient: string;
  };
  actions: {
    idle: string;
    attack: string;
    hurt: string;
  };
  petSkin: {
    label: string;
    byrdpipLabel: string;
    ariaLabel: string;
  };
  carousel: {
    previous: string;
    next: string;
  };
  activity: ProfileActivityCopy;
}

const DEFAULTS = {
  character: "NECROBINDER",
  pet: "OSTY",
  ancient: "OROBAS",
};

const PROFILE_CHARACTER_VIEWPORT_PADDING = {
  padLeft: "2%",
  padRight: "34%",
  padTop: "14%",
  padBottom: "0%",
} as const;

const PROFILE_PET_VIEWPORT_PADDING = {
  padLeft: "8%",
  padRight: "8%",
  padTop: "8%",
  padBottom: "4%",
} as const;

const PROFILE_SMALL_PET_VIEWPORT_PADDING = {
  padLeft: "42%",
  padRight: "42%",
  padTop: "42%",
  padBottom: "24%",
} as const;

export default function ProfilePage({
  characters,
  pets,
  ancients,
  copy,
  nicknameLocale = "ko",
}: {
  characters: CharacterChoice[];
  pets: PetChoice[];
  ancients: AncientChoice[];
  copy: ProfilePageCopy;
  nicknameLocale?: ProfileNicknameLocale;
}) {
  const fallbackProfile = useMemo(
    () => normalizeUserProfile({
      nickname: getInitialNickname(characters, DEFAULTS.character, nicknameLocale, copy.fallbackNickname),
      characterId: DEFAULTS.character,
      petId: DEFAULTS.pet,
      petSkinId: null,
      ancientId: DEFAULTS.ancient,
    }),
    [characters, copy.fallbackNickname, nicknameLocale],
  );
  const { profile, saveProfile } = useUserProfile(fallbackProfile);
  const [draftProfile, setDraftProfile] = useState(fallbackProfile);
  const [characterAction, setCharacterAction] = useActionState();
  const [petAction, setPetAction] = useActionState();

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
  const pet = findChoice(pets, draftProfile.petId) ?? pets[0];
  const ancient = findChoice(ancients, draftProfile.ancientId) ?? ancients[0];
  const selectedPetSkin = pet?.skinOptions.length
    ? pet.skinOptions.find((option) => option.id === draftProfile.petSkinId) ?? pet.skinOptions[0]
    : undefined;
  const selectedPetSkinId = selectedPetSkin?.id;
  const selectedPetSkins = selectedPetSkin?.selectedSkins ?? pet?.selectedSkins ?? null;

  return (
    <main
      data-profile-page
      className="mx-auto w-full max-w-7xl px-3 sm:px-4"
    >
      <div className="flex h-[calc(100svh-3.25rem)] flex-col gap-3 overflow-hidden py-2">
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src={character?.iconUrl ?? "/images/sts2/characters/character_icon_necrobinder.webp"}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
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
              className="min-w-0 bg-transparent text-lg font-bold text-zinc-100 outline-none placeholder:text-zinc-600 focus:text-amber-100"
            />
          </div>
          {copy.devBadge && (
            <span className="shrink-0 rounded border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
              {copy.devBadge}
            </span>
          )}
        </header>

        <section
          data-profile-layout
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 md:grid-cols-[minmax(18rem,30%)_minmax(0,70%)] md:grid-rows-1 md:gap-4"
        >
          <div data-profile-controls className="flex min-h-0 flex-col gap-1.5 self-start pt-1">
            <ProfileRow
              label={copy.selectors.character}
              carousel={
                <ChoiceCarousel
                  choiceType="character"
                  items={characters}
                  selectedId={character?.id}
                  labels={copy.carousel}
                  onSelect={(id) => {
                    const nextCharacter = findChoice(characters, id);
                    persistProfile((current) => ({
                      ...current,
                      characterId: id,
                      nickname: pickCharacterNickname(nextCharacter, nicknameLocale, copy.fallbackNickname),
                    }));
                    setCharacterAction("ATTACK");
                  }}
                />
              }
            />

            <ProfileRow
              label={copy.selectors.pet}
              carousel={
                <ChoiceCarousel
                  choiceType="pet"
                  items={pets}
                  selectedId={pet?.id}
                  labels={copy.carousel}
                  onSelect={(id) => {
                    const nextPet = findChoice(pets, id);
                    persistProfile((current) => ({
                      ...current,
                      petId: id,
                      petSkinId: nextPet?.skinOptions[0]?.id ?? null,
                    }));
                    setPetAction("ATTACK");
                  }}
                />
              }
            />

            <ProfileRow
              label={copy.selectors.ancient}
              carousel={
                <ChoiceCarousel
                  choiceType="ancient"
                  items={ancients}
                  selectedId={ancient?.id}
                  labels={copy.carousel}
                  onSelect={(id) => persistProfile((current) => ({ ...current, ancientId: id }))}
                />
              }
            />
          </div>

          <DuoRender
            character={character}
            pet={pet}
            ancient={ancient}
            selectedPetSkins={selectedPetSkins}
            selectedPetSkinId={selectedPetSkinId}
            characterAction={characterAction.action}
            characterActionNonce={characterAction.nonce}
            petAction={petAction.action}
            petActionNonce={petAction.nonce}
            copy={copy}
            onPetSkinSelect={(skinId) => {
              if (!pet) return;
              persistProfile((current) => ({ ...current, petSkinId: skinId }));
              setPetAction("ATTACK");
            }}
          />
        </section>
      </div>

      <ProfileActivity copy={copy.activity} serviceLocale={nicknameLocale} />
    </main>
  );
}

function ProfileRow({
  label,
  carousel,
}: {
  label: string;
  carousel: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
      <div className="flex items-center">
        <h2 className="text-sm font-bold text-zinc-100">{label}</h2>
      </div>
      <div className="min-w-0 self-center">{carousel}</div>
    </div>
  );
}

function ChoiceCarousel<T extends { id: string; label: string; iconUrl: string; subtitle?: string }>({
  choiceType,
  items,
  selectedId,
  labels,
  onSelect,
}: {
  choiceType: "character" | "pet" | "ancient";
  items: T[];
  selectedId: string | undefined;
  labels: ProfilePageCopy["carousel"];
  onSelect: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const update = () => {
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items.length]);

  const scrollBy = (direction: -1 | 1) => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.78, behavior: "smooth" });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) return;

    const atStart = element.scrollLeft <= 1;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

    event.preventDefault();
    element.scrollLeft += delta;
  };

  return (
    <div className="relative">
      {canScrollLeft && (
        <CarouselArrow direction="left" label={labels.previous} onClick={() => scrollBy(-1)} />
      )}
      {canScrollRight && (
        <CarouselArrow direction="right" label={labels.next} onClick={() => scrollBy(1)} />
      )}
      <div
        ref={scrollerRef}
        onWheel={handleWheel}
        className="mx-7 flex gap-1.5 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              data-profile-choice
              data-profile-choice-type={choiceType}
              data-profile-choice-id={item.id}
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              aria-label={item.subtitle ? `${item.label} ${item.subtitle}` : item.label}
              title={item.subtitle ? `${item.label} — ${item.subtitle}` : item.label}
              className={cn(
                "group relative flex h-16 basis-[calc((100%-0.75rem)/3)] shrink-0 items-center justify-center p-1 text-center transition-transform hover:scale-105",
                active
                  ? "scale-105"
                  : "opacity-75 hover:opacity-100",
              )}
            >
              <Image
                src={item.iconUrl}
                alt=""
                width={56}
                height={56}
                className={cn(
                  "h-11 w-11 object-contain drop-shadow-lg transition-[filter,transform]",
                  active
                    ? "drop-shadow-[0_0_7px_rgba(251,191,36,0.72)]"
                    : "group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.22)]",
                )}
              />
              <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[11px] font-semibold text-zinc-100 shadow-lg group-hover:block">
                {item.label}
                {item.subtitle && <span className="ml-1 text-zinc-400">{item.subtitle}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CarouselArrow({ direction, label, onClick }: { direction: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110",
        direction === "left" ? "left-0" : "right-0",
      )}
    >
      <Image
        src={`/images/sts2/ui/settings_tiny_${direction}_arrow.png`}
        alt=""
        width={28}
        height={28}
        className="object-contain"
      />
    </button>
  );
}

function DuoRender({
  character,
  pet,
  ancient,
  selectedPetSkins,
  selectedPetSkinId,
  characterAction,
  characterActionNonce,
  petAction,
  petActionNonce,
  copy,
  onPetSkinSelect,
}: {
  character: CharacterChoice | undefined;
  pet: PetChoice | undefined;
  ancient: AncientChoice | undefined;
  selectedPetSkins: readonly string[] | null;
  selectedPetSkinId: string | undefined;
  characterAction: ActionId;
  characterActionNonce: number;
  petAction: ActionId;
  petActionNonce: number;
  copy: ProfilePageCopy;
  onPetSkinSelect: (skinId: string) => void;
}) {
  const petPlacement = getPetPlacement(pet?.monsterId);
  const petViewportPadding = getPetViewportPadding(pet?.monsterId);

  return (
    <div
      data-profile-render
      data-profile-character-id={character?.id ?? ""}
      data-profile-pet-id={pet?.id ?? ""}
      data-profile-ancient-id={ancient?.id ?? ""}
      className="flex h-full min-h-[18rem] flex-col overflow-visible md:min-h-0"
    >
      <div className="relative min-h-0 flex-1">
        {ancient && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-[1] aspect-[2560/1200] w-[92%] max-w-[26rem] -translate-x-1/2 overflow-hidden md:top-0 md:w-[68%] md:max-w-[42rem]">
            <div className="absolute inset-0 flex items-center justify-center">
              <AncientNodeRender ancientId={ancient.id} className="h-[92%] md:h-[82%]" />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-full w-[46rem] max-w-none origin-bottom -translate-x-[46%] scale-[0.6] md:left-0 md:w-[68rem] md:origin-bottom-left md:translate-x-0 md:scale-[0.8]">
          <MonsterSpineStage
            key={`duo-${character?.id ?? "none"}`}
            asset={character?.spineAsset ?? null}
            fallbackImageUrl={null}
            monsterName={character?.label ?? ""}
            selectedMoveId={characterAction}
            selectedMoveNonce={characterActionNonce}
            imagePriority={false}
            showLoadingLabel={false}
            viewportTransitionTime={0}
            viewportPadding={PROFILE_CHARACTER_VIEWPORT_PADDING}
            className="relative h-full w-full"
          />
        </div>
        <div
          className="pointer-events-none absolute z-20 top-[var(--profile-pet-mobile-top)] bottom-[var(--profile-pet-mobile-bottom)] left-[var(--profile-pet-mobile-left)] h-[var(--profile-pet-mobile-height)] w-[var(--profile-pet-mobile-width)] md:top-[var(--profile-pet-top)] md:bottom-[var(--profile-pet-bottom)] md:left-[var(--profile-pet-left)] md:h-[var(--profile-pet-height)] md:w-[var(--profile-pet-width)]"
          style={{
            "--profile-pet-top": petPlacement.top,
            "--profile-pet-bottom": petPlacement.bottom,
            "--profile-pet-left": petPlacement.left,
            "--profile-pet-width": petPlacement.width,
            "--profile-pet-height": petPlacement.height,
            "--profile-pet-mobile-top": petPlacement.mobileTop,
            "--profile-pet-mobile-bottom": petPlacement.mobileBottom,
            "--profile-pet-mobile-left": petPlacement.mobileLeft,
            "--profile-pet-mobile-width": petPlacement.mobileWidth,
            "--profile-pet-mobile-height": petPlacement.mobileHeight,
          } as React.CSSProperties}
        >
          <MonsterSpineStage
            key={`pet-${pet?.id ?? "none"}`}
            asset={pet?.spineAsset ?? null}
            fallbackImageUrl={null}
            monsterName={pet?.label ?? ""}
            selectedMoveId={petAction}
            selectedMoveNonce={petActionNonce}
            selectedSkin={pet?.selectedSkin}
            selectedSkins={selectedPetSkins}
            imagePriority={false}
            showLoadingLabel={false}
            viewportTransitionTime={0}
            viewportPadding={petViewportPadding}
            className="relative h-full w-full"
          />
        </div>
      </div>
      {pet && pet.skinOptions.length > 0 && (
        <SkinOptionBar
          options={pet.skinOptions}
          selectedId={selectedPetSkinId}
          ariaLabelTemplate={copy.petSkin.ariaLabel}
          onSelect={onPetSkinSelect}
        />
      )}
    </div>
  );
}

function SkinOptionBar({
  options,
  selectedId,
  ariaLabelTemplate,
  onSelect,
}: {
  options: readonly PetSkinOption[];
  selectedId: string | undefined;
  ariaLabelTemplate: string;
  onSelect: (skinId: string) => void;
}) {
  return (
    <div className="relative z-30 flex shrink-0 justify-end gap-1 pr-1 pb-1">
      {options.map((option) => {
        const active = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-label={formatTemplate(ariaLabelTemplate, { label: option.label })}
            title={option.label}
            onClick={() => onSelect(option.id)}
            className={cn(
              "h-6 rounded px-2 text-[11px] font-semibold transition-colors",
              active
                ? "text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getPetPlacement(petId: string | undefined): {
  top: string;
  bottom: string;
  left: string;
  width: string;
  height: string;
  mobileTop: string;
  mobileBottom: string;
  mobileLeft: string;
  mobileWidth: string;
  mobileHeight: string;
} {
  if (petId === "OSTY") {
    return {
      top: "0%",
      bottom: "auto",
      left: "62%",
      width: "24rem",
      height: "56%",
      mobileTop: "9%",
      mobileBottom: "auto",
      mobileLeft: "55%",
      mobileWidth: "12rem",
      mobileHeight: "38%",
    };
  }

  return {
    top: "auto",
    bottom: "0%",
    left: "58%",
    width: petId === "PAELS_LEGION" ? "16.8rem" : "14rem",
    height: petId === "PAELS_LEGION" ? "40.8%" : "34%",
    mobileTop: "auto",
    mobileBottom: "2%",
    mobileLeft: "56%",
    mobileWidth: petId === "PAELS_LEGION" ? "10rem" : "8.8rem",
    mobileHeight: petId === "PAELS_LEGION" ? "31%" : "27%",
  };
}

function getPetViewportPadding(petId: string | undefined) {
  return petId === "OSTY" ? PROFILE_PET_VIEWPORT_PADDING : PROFILE_SMALL_PET_VIEWPORT_PADDING;
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

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
