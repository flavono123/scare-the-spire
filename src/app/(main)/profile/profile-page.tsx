"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  label: string;
  iconUrl: string;
  fallbackImageUrl: string;
  selectedSkin: string | null;
  spineAsset: MonsterSpineAsset | null;
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
  const [characterAction, setCharacterAction] = useActionState();
  const [petAction, setPetAction] = useActionState();

  const character = findChoice(characters, characterId) ?? characters[0];
  const pet = findChoice(pets, petId) ?? pets[0];
  const ancient = findChoice(ancients, ancientId) ?? ancients[0];

  return (
    <main className="mx-auto flex h-[calc(100svh-3rem)] w-full max-w-7xl flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4">
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

      <section className="grid min-h-0 flex-1 grid-rows-3 gap-3">
        <ProfileRow
          label="캐릭터"
          carousel={
            <ChoiceCarousel
              items={characters}
              selectedId={character?.id}
              onSelect={(id) => {
                setCharacterId(id);
                setCharacterAction("IDLE");
              }}
            />
          }
          render={
            <SpineRender
              label={character?.label ?? ""}
              asset={character?.spineAsset ?? null}
              fallbackImageUrl={character?.fallbackImageUrl ?? null}
              action={characterAction.action}
              actionNonce={characterAction.nonce}
              onAction={setCharacterAction}
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
                setPetAction("IDLE");
              }}
            />
          }
          render={
            <DuoRender
              character={character}
              pet={pet}
              action={petAction.action}
              actionNonce={petAction.nonce}
              onAction={setPetAction}
            />
          }
        />

        <ProfileRow
          label="고대신"
          carousel={<ChoiceCarousel items={ancients} selectedId={ancient?.id} onSelect={setAncientId} />}
          render={<AncientRender ancient={ancient} />}
        />
      </section>
    </main>
  );
}

function ProfileRow({
  label,
  carousel,
  render,
}: {
  label: string;
  carousel: React.ReactNode;
  render: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 grid-cols-[4.5rem_minmax(0,1fr)_minmax(13rem,17rem)] items-stretch gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center">
        <h2 className="text-base font-bold text-zinc-100">{label}</h2>
      </div>
      <div className="min-w-0 self-center">{carousel}</div>
      <div className="min-w-0">{render}</div>
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
        className="mx-9 flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              className={cn(
                "flex h-24 basis-[calc((100%-1rem)/3)] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-colors",
                active
                  ? "border-amber-300/70 bg-amber-400/10"
                  : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.04]",
              )}
            >
              <Image src={item.iconUrl} alt="" width={48} height={48} className="h-12 w-12 object-contain drop-shadow-lg" />
              <span className="max-w-full truncate text-xs font-semibold text-zinc-100">{item.label}</span>
              {item.subtitle && (
                <span className="max-w-full truncate text-[10px] text-zinc-500">{item.subtitle}</span>
              )}
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
        "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110",
        direction === "left" ? "left-0" : "right-0",
      )}
    >
      <Image
        src={`/images/sts2/ui/settings_tiny_${direction}_arrow.png`}
        alt=""
        width={32}
        height={32}
        className="object-contain"
      />
    </button>
  );
}

function SpineRender({
  label,
  asset,
  fallbackImageUrl,
  action,
  actionNonce,
  onAction,
  selectedSkin,
}: {
  label: string;
  asset: MonsterSpineAsset | null;
  fallbackImageUrl: string | null;
  action: ActionId;
  actionNonce: number;
  onAction: (action: ActionId) => void;
  selectedSkin?: string | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-black/25">
      <div className="relative min-h-0 flex-1">
        <MonsterSpineStage
          key={`${asset?.id ?? label}-${selectedSkin ?? "default"}-${action}-${actionNonce}`}
          asset={asset}
          fallbackImageUrl={fallbackImageUrl}
          monsterName={label}
          selectedMoveId={action}
          selectedSkin={selectedSkin}
          imagePriority={false}
          showLoadingLabel={false}
          className="relative h-full w-full"
        />
      </div>
      <ActionBar value={action} onChange={onAction} />
    </div>
  );
}

function DuoRender({
  character,
  pet,
  action,
  actionNonce,
  onAction,
}: {
  character: CharacterChoice | undefined;
  pet: PetChoice | undefined;
  action: ActionId;
  actionNonce: number;
  onAction: (action: ActionId) => void;
}) {
  const characterAction = action === "HURT" ? "IDLE" : action;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-black/25">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-y-0 left-0 w-[62%]">
          <MonsterSpineStage
            key={`duo-${character?.id ?? "none"}-${characterAction}-${actionNonce}`}
            asset={character?.spineAsset ?? null}
            fallbackImageUrl={character?.fallbackImageUrl ?? null}
            monsterName={character?.label ?? ""}
            selectedMoveId={characterAction}
            imagePriority={false}
            showLoadingLabel={false}
            className="relative h-full w-full"
          />
        </div>
        <div className="absolute inset-y-0 right-0 w-[48%]">
          <MonsterSpineStage
            key={`pet-${pet?.id ?? "none"}-${pet?.selectedSkin ?? "default"}-${action}-${actionNonce}`}
            asset={pet?.spineAsset ?? null}
            fallbackImageUrl={pet?.fallbackImageUrl ?? null}
            monsterName={pet?.label ?? ""}
            selectedMoveId={action}
            selectedSkin={pet?.selectedSkin}
            imagePriority={false}
            showLoadingLabel={false}
            className="relative h-full w-full"
          />
        </div>
      </div>
      <ActionBar value={action} onChange={onAction} />
    </div>
  );
}

function AncientRender({ ancient }: { ancient: AncientChoice | undefined }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/25 p-3">
      {ancient && (
        <div className="flex min-w-0 items-center gap-3">
          <Image src={ancient.iconUrl} alt="" width={96} height={96} className="h-24 w-24 shrink-0 object-contain drop-shadow-2xl" />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-sky-100">{ancient.label}</div>
            <div className="mt-1 truncate text-xs text-zinc-500">{ancient.subtitle}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBar({ value, onChange }: { value: ActionId; onChange: (action: ActionId) => void }) {
  return (
    <div className="flex shrink-0 justify-center gap-1 border-t border-white/10 p-1">
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onChange(action.id)}
          aria-pressed={value === action.id}
          className={cn(
            "h-7 rounded border px-2 text-[11px] font-semibold transition-colors",
            value === action.id
              ? "border-amber-300/60 bg-amber-400/10 text-amber-100"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]",
          )}
        >
          {action.label}
        </button>
      ))}
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
