"use client";

import { useEffect, useRef, useState } from "react";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

export interface CharacterChoice {
  id: string;
  label: string;
  iconUrl: string;
  fallbackImageUrl: string;
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

const ACTIONS: { id: ActionId; label: string }[] = [
  { id: "IDLE", label: "대기" },
  { id: "ATTACK", label: "공격" },
  { id: "HURT", label: "피격" },
];

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

export default function ProfilePage({
  characters,
  pets,
  ancients,
}: {
  characters: CharacterChoice[];
  pets: PetChoice[];
  ancients: AncientChoice[];
}) {
  const [characterId, setCharacterId] = useState(DEFAULTS.character);
  const [petId, setPetId] = useState(DEFAULTS.pet);
  const [ancientId, setAncientId] = useState(DEFAULTS.ancient);
  const [petSkinById, setPetSkinById] = useState<Record<string, string>>({});
  const [characterAction, setCharacterAction] = useActionState();
  const [petAction, setPetAction] = useActionState();

  const character = findChoice(characters, characterId) ?? characters[0];
  const pet = findChoice(pets, petId) ?? pets[0];
  const selectedPetSkinId = pet?.skinOptions.length
    ? petSkinById[pet.id] ?? pet.skinOptions[0]?.id
    : undefined;
  const selectedPetSkin = selectedPetSkinId
    ? pet?.skinOptions.find((option) => option.id === selectedPetSkinId)
    : undefined;
  const selectedPetSkins = selectedPetSkin?.selectedSkins ?? pet?.selectedSkins ?? null;

  return (
    <main className="mx-auto flex h-[calc(100svh-3.25rem)] w-full max-w-7xl flex-col gap-3 overflow-hidden px-3 py-2 sm:px-4">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src={character?.iconUrl ?? "/images/sts2/characters/character_icon_necrobinder.webp"}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <h1 className="truncate text-lg font-bold text-zinc-100">프로필</h1>
        </div>
        <span className="shrink-0 rounded border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
          DEV
        </span>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(18rem,30%)_minmax(0,70%)] gap-4">
        <div className="flex min-h-0 flex-col gap-1.5 self-start pt-1">
          <ProfileRow
            label="캐릭터"
            carousel={
              <ChoiceCarousel
                items={characters}
                selectedId={character?.id}
                onSelect={(id) => {
                  setCharacterId(id);
                  setCharacterAction("ATTACK");
                }}
              />
            }
          />

          <ProfileRow
            label="펫"
            carousel={
              <ChoiceCarousel
                items={pets}
                selectedId={pet?.id}
                onSelect={(id) => {
                  setPetId(id);
                  setPetAction("ATTACK");
                }}
              />
            }
          />

          <ProfileRow
            label="고대신"
            carousel={<ChoiceCarousel items={ancients} selectedId={ancientId} onSelect={setAncientId} />}
          />
        </div>

        <DuoRender
          character={character}
          pet={pet}
          selectedPetSkins={selectedPetSkins}
          selectedPetSkinId={selectedPetSkinId}
          characterAction={characterAction.action}
          characterActionNonce={characterAction.nonce}
          petAction={petAction.action}
          petActionNonce={petAction.nonce}
          onCharacterAction={setCharacterAction}
          onPetAction={setPetAction}
          onPetSkinSelect={(skinId) => {
            if (!pet) return;
            setPetSkinById((current) => ({ ...current, [pet.id]: skinId }));
            setPetAction("ATTACK");
          }}
        />
      </section>
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
  items,
  selectedId,
  onSelect,
}: {
  items: T[];
  selectedId: string | undefined;
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

  return (
    <div className="relative">
      {canScrollLeft && (
        <CarouselArrow direction="left" onClick={() => scrollBy(-1)} />
      )}
      {canScrollRight && (
        <CarouselArrow direction="right" onClick={() => scrollBy(1)} />
      )}
      <div
        ref={scrollerRef}
        className="mx-7 flex gap-1.5 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
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
                    ? "drop-shadow-[0_0_12px_rgba(251,191,36,0.75)]"
                    : "group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.22)]",
                )}
              />
              {active && (
                <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              )}
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

function CarouselArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "이전" : "다음"}
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
  selectedPetSkins,
  selectedPetSkinId,
  characterAction,
  characterActionNonce,
  petAction,
  petActionNonce,
  onCharacterAction,
  onPetAction,
  onPetSkinSelect,
}: {
  character: CharacterChoice | undefined;
  pet: PetChoice | undefined;
  selectedPetSkins: readonly string[] | null;
  selectedPetSkinId: string | undefined;
  characterAction: ActionId;
  characterActionNonce: number;
  petAction: ActionId;
  petActionNonce: number;
  onCharacterAction: (action: ActionId) => void;
  onPetAction: (action: ActionId) => void;
  onPetSkinSelect: (skinId: string) => void;
}) {
  const petPlacement = getPetPlacement(pet?.monsterId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-visible">
      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-full w-[52rem] max-w-[98%] origin-bottom-left scale-[0.8]">
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
          className="pointer-events-none absolute z-20"
          style={{
            top: petPlacement.top,
            bottom: petPlacement.bottom,
            left: petPlacement.left,
            width: petPlacement.width,
            height: petPlacement.height,
          }}
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
            viewportPadding={PROFILE_PET_VIEWPORT_PADDING}
            className="relative h-full w-full"
          />
        </div>
      </div>
      <div className="relative z-30 grid shrink-0 grid-cols-2 gap-3 pb-1">
        <ActionBar label="캐릭터" value={characterAction} onChange={onCharacterAction} />
        <ActionBar label="펫" value={petAction} onChange={onPetAction} />
      </div>
      {pet && pet.skinOptions.length > 0 && (
        <SkinOptionBar
          options={pet.skinOptions}
          selectedId={selectedPetSkinId}
          onSelect={onPetSkinSelect}
        />
      )}
    </div>
  );
}

function SkinOptionBar({
  options,
  selectedId,
  onSelect,
}: {
  options: readonly PetSkinOption[];
  selectedId: string | undefined;
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
            aria-label={`펫 ${option.label}`}
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

function ActionBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ActionId;
  onChange: (action: ActionId) => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1 p-1">
      <span className="mr-1 shrink-0 text-[11px] font-semibold text-zinc-500">{label}</span>
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onChange(action.id)}
          aria-pressed={value === action.id}
          aria-label={`${label} ${action.label}`}
          className={cn(
            "h-7 rounded px-2 text-[11px] font-semibold transition-colors",
            value === action.id
              ? "text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function getPetPlacement(petId: string | undefined): {
  top?: string;
  bottom?: string;
  left: string;
  width: string;
  height: string;
} {
  if (petId === "OSTY") {
    return {
      top: "4%",
      left: "52%",
      width: "28rem",
      height: "82%",
    };
  }

  return {
    bottom: "0%",
    left: "40%",
    width: "16rem",
    height: "42%",
  };
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
