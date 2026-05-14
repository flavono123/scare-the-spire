"use client";

import { Check, ChevronDown, LayoutPanelTop, Search, Shuffle, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import Image from "@/components/ui/static-image";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

export interface CharacterProfileOption {
  id: string;
  name: string;
  colorLabel: string;
  iconUrl: string;
  outlineUrl: string;
  portraitUrl: string;
  selectUrl: string;
  spineStatus: "ready" | "pending";
}

export interface AncientProfileOption {
  id: string;
  name: string;
  nameEn: string;
  epithet: string;
  imageUrl: string | null;
  backgroundUrl: string | null;
  backgroundStatus: "ready" | "beta" | "incomplete" | "missing";
  note: string;
}

export interface PetProfileOption {
  id: string;
  monsterId: string | null;
  label: string;
  nameEn: string;
  tokenUrl: string;
  imageUrl: string;
  spineAsset: MonsterSpineAsset | null;
  skin: string | null;
  source: "power-token" | "relic-token" | "monster-render";
  note: string;
}

export interface MiniEntityProfileOption {
  id: string;
  name: string;
  nameEn: string;
  imageUrl: string | null;
  meta: string;
}

export interface ProfileAssetAuditItem {
  label: string;
  value: string;
  tone: "ok" | "warn";
  detail: string;
}

interface ProfileDevPageProps {
  characters: CharacterProfileOption[];
  ancients: AncientProfileOption[];
  pets: PetProfileOption[];
  cards: MiniEntityProfileOption[];
  relics: MiniEntityProfileOption[];
  potions: MiniEntityProfileOption[];
  assetAudit: ProfileAssetAuditItem[];
  defaults: {
    character: string;
    ancient: string;
    pet: string;
    card: string;
    relic: string;
    potion: string;
  };
}

type TrophyKind = "card" | "relic" | "potion";
type PresentationMode = "page" | "modal";

const trophyLabels: Record<TrophyKind, string> = {
  card: "카드",
  relic: "유물",
  potion: "포션",
};

const colorChips: Record<string, string> = {
  red: "border-red-400/40 bg-red-500/10 text-red-100",
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  aqua: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  pink: "border-pink-300/40 bg-pink-500/10 text-pink-100",
  orange: "border-orange-300/40 bg-orange-500/10 text-orange-100",
  neutral: "border-zinc-500/40 bg-zinc-500/10 text-zinc-100",
};

export default function ProfileDevPage({
  characters,
  ancients,
  pets,
  cards,
  relics,
  potions,
  assetAudit,
  defaults,
}: ProfileDevPageProps) {
  const [nickname, setNickname] = useState("슬서운 방문자");
  const [presentationMode, setPresentationMode] = useState<PresentationMode>("page");
  const [selectedCharacterId, setSelectedCharacterId] = useState(defaults.character);
  const [selectedAncientId, setSelectedAncientId] = useState(defaults.ancient);
  const [selectedPetId, setSelectedPetId] = useState(defaults.pet);
  const [selectedCardId, setSelectedCardId] = useState(defaults.card);
  const [selectedRelicId, setSelectedRelicId] = useState(defaults.relic);
  const [selectedPotionId, setSelectedPotionId] = useState(defaults.potion);
  const [activeTrophy, setActiveTrophy] = useState<TrophyKind>("card");
  const [query, setQuery] = useState("");

  const selectedCharacter = findById(characters, selectedCharacterId) ?? characters[0];
  const selectedAncient = findById(ancients, selectedAncientId) ?? ancients[0];
  const selectedPet = findById(pets, selectedPetId) ?? pets[0];
  const selectedCard = findById(cards, selectedCardId) ?? cards[0];
  const selectedRelic = findById(relics, selectedRelicId) ?? relics[0];
  const selectedPotion = findById(potions, selectedPotionId) ?? potions[0];

  const trophyItems = activeTrophy === "card" ? cards : activeTrophy === "relic" ? relics : potions;
  const selectedTrophyId = activeTrophy === "card" ? selectedCardId : activeTrophy === "relic" ? selectedRelicId : selectedPotionId;
  const selectedTrophies = [selectedCard, selectedRelic, selectedPotion].filter(Boolean);

  const filteredTrophyItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const selectedFirst = trophyItems.toSorted((a, b) => {
      if (a.id === selectedTrophyId) return -1;
      if (b.id === selectedTrophyId) return 1;
      return 0;
    });
    if (!trimmed) return selectedFirst.slice(0, 96);
    return selectedFirst
      .filter((item) => {
        const haystack = `${item.id} ${item.name} ${item.nameEn} ${item.meta}`.toLowerCase();
        return haystack.includes(trimmed);
      })
      .slice(0, 96);
  }, [query, selectedTrophyId, trophyItems]);

  function selectTrophy(id: string) {
    if (activeTrophy === "card") setSelectedCardId(id);
    if (activeTrophy === "relic") setSelectedRelicId(id);
    if (activeTrophy === "potion") setSelectedPotionId(id);
  }

  function randomize() {
    setSelectedCharacterId(randomItem(characters)?.id ?? selectedCharacterId);
    setSelectedAncientId(randomItem(ancients)?.id ?? selectedAncientId);
    setSelectedPetId(randomItem(pets)?.id ?? selectedPetId);
    setSelectedCardId(randomItem(cards)?.id ?? selectedCardId);
    setSelectedRelicId(randomItem(relics)?.id ?? selectedRelicId);
    setSelectedPotionId(randomItem(potions)?.id ?? selectedPotionId);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
            DEV / RLS PROFILE MOCK
          </p>
          <h1 className="text-3xl font-bold text-zinc-100">프로필 식별 mock</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            Supabase RLS가 구분하는 휘발성 방문자 ID에 붙일 공개 속성 선택 화면입니다. 인증/인가와 개인정보 흐름은 포함하지 않습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentButton active={presentationMode === "page"} onClick={() => setPresentationMode("page")}>
            <LayoutPanelTop className="h-4 w-4" />
            페이지
          </SegmentButton>
          <SegmentButton active={presentationMode === "modal"} onClick={() => setPresentationMode("modal")}>
            <UserRound className="h-4 w-4" />
            모달
          </SegmentButton>
          <button
            type="button"
            onClick={randomize}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08]"
          >
            <Shuffle className="h-4 w-4 text-amber-200" />
            랜덤
          </button>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        {assetAudit.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
              <span className={cn("rounded border px-2 py-0.5 text-[11px] font-semibold", item.tone === "ok" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-amber-400/40 bg-amber-500/10 text-amber-100")}>
                {item.value}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{item.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(34rem,1.05fr)]">
        <section className="flex flex-col gap-4">
          <NavbarMock
            nickname={nickname}
            character={selectedCharacter}
            ancient={selectedAncient}
            pet={selectedPet}
          />
          <ProfilePreview
            mode={presentationMode}
            nickname={nickname}
            character={selectedCharacter}
            ancient={selectedAncient}
            pet={selectedPet}
            trophies={selectedTrophies}
          />
        </section>

        <section className="flex flex-col gap-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500" htmlFor="profile-nickname">
              Nickname
            </label>
            <input
              id="profile-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm font-semibold text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300/60"
              placeholder="댓글 닉네임"
            />
          </div>

          <ChooserSection title="캐릭터" count={characters.length}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setSelectedCharacterId(character.id)}
                  className={cn(
                    "group relative flex min-h-28 flex-col items-center justify-between rounded-lg border bg-black/20 p-3 text-center transition-colors",
                    selectedCharacter?.id === character.id
                      ? "border-amber-300/70 bg-amber-400/10"
                      : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  <SelectionCheck active={selectedCharacter?.id === character.id} />
                  <Image src={character.iconUrl} alt="" width={52} height={52} className="h-13 w-13 object-contain drop-shadow-lg" />
                  <span className="mt-2 text-sm font-semibold text-zinc-100">{character.name}</span>
                  <span className={cn("mt-1 rounded border px-1.5 py-0.5 text-[10px]", colorChips[character.colorLabel] ?? colorChips.neutral)}>
                    Spine 추출 대기
                  </span>
                </button>
              ))}
            </div>
          </ChooserSection>

          <ChooserSection title="고대의 존재" count={ancients.length}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ancients.map((ancient) => (
                <button
                  key={ancient.id}
                  type="button"
                  onClick={() => setSelectedAncientId(ancient.id)}
                  className={cn(
                    "group relative min-h-32 overflow-hidden rounded-lg border bg-black/25 p-3 text-left transition-colors",
                    selectedAncient?.id === ancient.id
                      ? "border-sky-300/70 bg-sky-400/10"
                      : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  {ancient.backgroundUrl && (
                    <Image src={ancient.backgroundUrl} alt="" width={240} height={120} className="absolute inset-0 h-full w-full object-cover opacity-35" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                  <SelectionCheck active={selectedAncient?.id === ancient.id} />
                  <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-zinc-100">{ancient.name}</div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-sky-100/80">{ancient.epithet}</div>
                      </div>
                      {ancient.imageUrl && (
                        <Image src={ancient.imageUrl} alt="" width={46} height={46} className="h-12 w-12 object-contain drop-shadow-lg" />
                      )}
                    </div>
                    <AncientStatusBadge status={ancient.backgroundStatus} note={ancient.note} />
                  </div>
                </button>
              ))}
            </div>
          </ChooserSection>

          <ChooserSection title="펫" count={pets.length}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setSelectedPetId(pet.id)}
                  className={cn(
                    "relative flex min-h-32 flex-col rounded-lg border bg-black/20 p-3 text-left transition-colors",
                    selectedPet?.id === pet.id
                      ? "border-emerald-300/70 bg-emerald-400/10"
                      : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  <SelectionCheck active={selectedPet?.id === pet.id} />
                  <div className="flex items-start gap-3">
                    <Image src={pet.tokenUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain drop-shadow-lg" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-zinc-100">{pet.label}</div>
                      <div className="mt-0.5 truncate text-[11px] text-zinc-500">{pet.nameEn}</div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {pet.source}
                    </span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", pet.spineAsset ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-zinc-500/40 bg-zinc-500/10 text-zinc-300")}>
                      {pet.spineAsset ? pet.skin ?? "spine" : "token-only"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ChooserSection>

          <ChooserSection title="대표 장비" count={trophyItems.length}>
            <div className="flex flex-wrap items-center gap-2">
              {(["card", "relic", "potion"] as const).map((kind) => (
                <SegmentButton key={kind} active={activeTrophy === kind} onClick={() => { setActiveTrophy(kind); setQuery(""); }}>
                  {trophyLabels[kind]}
                </SegmentButton>
              ))}
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-300/60"
                placeholder={`${trophyLabels[activeTrophy]} 검색`}
              />
            </div>
            <div className="mt-3 grid max-h-[34rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
              {filteredTrophyItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTrophy(item.id)}
                  className={cn(
                    "relative flex min-h-36 flex-col items-center justify-between rounded-lg border bg-black/20 p-3 text-center transition-colors",
                    selectedTrophyId === item.id
                      ? "border-amber-300/70 bg-amber-400/10"
                      : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  <SelectionCheck active={selectedTrophyId === item.id} />
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt="" width={activeTrophy === "card" ? 92 : 58} height={activeTrophy === "card" ? 128 : 58} className={cn("object-contain drop-shadow-lg", activeTrophy === "card" ? "h-24 w-18" : "h-14 w-14")} />
                  )}
                  <div className="mt-2 min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{item.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-zinc-500">{item.nameEn}</div>
                  </div>
                </button>
              ))}
            </div>
          </ChooserSection>
        </section>
      </div>
    </main>
  );
}

function NavbarMock({
  nickname,
  character,
  ancient,
  pet,
}: {
  nickname: string;
  character: CharacterProfileOption | undefined;
  ancient: AncientProfileOption | undefined;
  pet: PetProfileOption | undefined;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-3">
      <div className="flex h-12 items-center justify-between gap-3 rounded-md border border-white/10 bg-background/90 px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-yellow-500">
          <span className="truncate">슬서운 이야기</span>
          <Image src="/images/bone_tea.png" alt="" width={22} height={22} className="h-5 w-5 object-contain" />
        </div>
        <button
          type="button"
          className="group relative flex h-9 max-w-[13rem] items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 text-left transition-colors hover:border-amber-300/50 hover:bg-white/[0.07]"
        >
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
            {ancient?.backgroundUrl && (
              <Image src={ancient.backgroundUrl} alt="" width={56} height={56} className="absolute inset-0 h-full w-full object-cover opacity-80" />
            )}
            {character && <Image src={character.iconUrl} alt="" width={28} height={28} className="relative z-10 h-7 w-7 object-contain" />}
            {pet && <Image src={pet.tokenUrl} alt="" width={14} height={14} className="absolute -bottom-0.5 -right-0.5 z-20 h-4 w-4 object-contain drop-shadow" />}
          </div>
          <span className="min-w-0 truncate text-xs font-semibold text-zinc-100">{nickname || "방문자"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-amber-200" />
        </button>
      </div>
    </div>
  );
}

function ProfilePreview({
  mode,
  nickname,
  character,
  ancient,
  pet,
  trophies,
}: {
  mode: PresentationMode;
  nickname: string;
  character: CharacterProfileOption | undefined;
  ancient: AncientProfileOption | undefined;
  pet: PetProfileOption | undefined;
  trophies: MiniEntityProfileOption[];
}) {
  const stageAsset = pet?.spineAsset ?? null;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/10 bg-zinc-950/80", mode === "modal" && "mx-auto max-w-md shadow-2xl shadow-black/40")}>
      <div className="relative min-h-[34rem] overflow-hidden">
        {ancient?.backgroundUrl ? (
          <Image src={ancient.backgroundUrl} alt="" width={900} height={620} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,rgba(24,24,27,1),rgba(3,7,18,1))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/90" />

        <div className="relative z-10 flex min-h-[34rem] flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {character && <Image src={character.iconUrl} alt="" width={34} height={34} className="h-8 w-8 object-contain" />}
                <h2 className="truncate text-2xl font-bold text-zinc-50">{nickname || "방문자"}</h2>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {character && (
                  <span className={cn("rounded border px-2 py-0.5 text-xs font-semibold", colorChips[character.colorLabel] ?? colorChips.neutral)}>
                    {character.name}
                  </span>
                )}
                {ancient && (
                  <span className="rounded border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-100">
                    {ancient.name}
                  </span>
                )}
              </div>
            </div>
            {ancient?.imageUrl && (
              <Image src={ancient.imageUrl} alt="" width={86} height={86} className="h-20 w-20 shrink-0 object-contain drop-shadow-2xl" />
            )}
          </div>

          <div className="relative mt-6 flex flex-1 items-end justify-center">
            {character && (
              <Image
                src={character.portraitUrl}
                alt=""
                width={420}
                height={420}
                className="max-h-[25rem] w-auto object-contain drop-shadow-2xl"
              />
            )}

            {pet && (
              <div className="absolute bottom-2 right-2 flex w-36 flex-col items-center rounded-lg border border-white/10 bg-black/35 p-2 backdrop-blur-sm">
                <div className="relative h-28 w-full">
                  <MonsterSpineStage
                    asset={stageAsset}
                    fallbackImageUrl={pet.imageUrl}
                    monsterName={pet.label}
                    selectedMoveId={null}
                    imagePriority={false}
                    showLoadingLabel={false}
                    className="relative h-full w-full"
                  />
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Image src={pet.tokenUrl} alt="" width={18} height={18} className="h-5 w-5 object-contain" />
                  <span className="truncate text-xs font-semibold text-zinc-100">{pet.label}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {trophies.map((item) => (
              <div key={item.id} className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/35 p-2 text-center backdrop-blur-sm">
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt="" width={52} height={72} className="h-12 w-12 object-contain drop-shadow-lg" />
                )}
                <div className="mt-1 w-full truncate text-xs font-semibold text-zinc-100">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChooserSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-zinc-100">{title}</h2>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400">{count.toLocaleString("ko-KR")}</span>
      </div>
      {children}
    </section>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
        active
          ? "border-amber-300/60 bg-amber-400/10 text-amber-100"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]",
      )}
    >
      {children}
    </button>
  );
}

function SelectionCheck({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <span className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200/80 bg-amber-400 text-zinc-950">
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

function AncientStatusBadge({
  status,
  note,
}: {
  status: AncientProfileOption["backgroundStatus"];
  note: string;
}) {
  const className = status === "ready"
    ? "border-sky-300/40 bg-sky-500/10 text-sky-100"
    : status === "missing"
      ? "border-red-400/40 bg-red-500/10 text-red-100"
      : "border-amber-300/40 bg-amber-500/10 text-amber-100";

  return (
    <span className={cn("w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold", className)}>
      {note}
    </span>
  );
}

function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

function randomItem<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}
