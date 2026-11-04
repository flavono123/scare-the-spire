"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PortaledHoverTipLayer } from "@/components/codex/card-keyword-tip-stack";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { HoverTip } from "@/components/codex/hover-tip";
import Image from "@/components/ui/static-image";
import { BetaArtGallery } from "@/components/vexing-puzzlebox/beta-art-gallery";
import { BetaArtQuiz } from "@/components/vexing-puzzlebox/beta-art-quiz";
import { BetaArtViewer } from "@/components/vexing-puzzlebox/beta-art-viewer";
import { useAuth } from "@/hooks/use-auth";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import type { VexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import type {
  BetaArtCharacter,
  BetaArtEntry,
  BetaArtType,
} from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

type BetaArtMode = "watch" | "gallery" | "quiz";

const OTHER_COLOR_FILTER = "other";
const SUBMENU_ROOT = "/images/sts2/ui/submenu";
/** Main menu submenu art for each mode. */
const MODE_ICONS: Record<BetaArtMode, string> = {
  watch: `${SUBMENU_ROOT}/submenu_load.webp`,
  gallery: `${SUBMENU_ROOT}/submenu_card_library.webp`,
  quiz: `${SUBMENU_ROOT}/submenu_unknown.webp`,
};
/** The Compendium menu's type tokens. */
const TYPE_TOKENS: Record<BetaArtType, string> = {
  card: "/images/sts2/nav/stats_cards.png",
  relic: "/images/sts2/relics/bing_bong.webp",
  power: "/images/sts2/nav/unmovable_power_beta.webp",
  epoch: "/images/sts2/relics/planisphere.webp",
};
/** Yummy Cookie's character variants stand for each character's cards. */
const CHARACTER_TOKENS: Record<string, string> = {
  ironclad: "/images/sts2/relics/yummy_cookie_ironclad.webp",
  silent: "/images/sts2/relics/yummy_cookie_silent.webp",
  regent: "/images/sts2/relics/yummy_cookie_regent.webp",
  necrobinder: "/images/sts2/relics/yummy_cookie_necro.webp",
  defect: "/images/sts2/relics/yummy_cookie_defect.webp",
};
const OTHER_CARDS_TOKEN = "/images/game-assets/card-misc/energy_colorless.png";

/** submenu_button_short.tscn: a parchment panel, the title in gold over the art, a cream description. */
function ModeButton({
  label,
  description,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`group/mode relative aspect-[490/560] w-[6.5rem] min-w-0 shrink transition-[transform,filter] duration-150 sm:w-[8.5rem] ${
        selected
          ? "scale-105 drop-shadow-[0_0_10px_rgba(239,200,81,0.55)]"
          : "brightness-75 hover:scale-[1.03] hover:brightness-95"
      }`}
    >
      <Image
        src={`${SUBMENU_ROOT}/submenu_panel_short.webp`}
        alt=""
        width={490}
        height={660}
        className="absolute inset-0 h-full w-full"
      />
      <span className="absolute inset-x-[8%] top-[5%] flex h-[17%] items-center justify-center">
        <span
          className="font-game-title text-sm font-bold leading-none sm:text-base"
          style={{
            color: "#efc851",
            WebkitTextStroke: "3px #333127",
            paintOrder: "stroke fill",
            textShadow: "2px 2px 0 rgba(0,0,0,0.13)",
          }}
        >
          {label}
        </span>
      </span>
      <Image
        src={icon}
        alt=""
        width={378}
        height={288}
        className="absolute left-1/2 top-[25%] w-[72%] -translate-x-1/2"
      />
      <span
        className="absolute inset-x-[10%] bottom-[7%] text-center text-[10px] leading-tight sm:text-[11px]"
        style={{ color: "#fff6e2", textShadow: "1.5px 1px 0 rgba(0,0,0,0.25)" }}
      >
        {description}
      </span>
    </button>
  );
}

/** A filter shown as a bare token; its name appears as a hover tip. */
function TokenFilter({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onClick}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`flex h-9 w-9 items-center justify-center transition-[transform,filter,opacity] duration-150 ${
          selected
            ? "scale-110 opacity-100 drop-shadow-[0_0_6px_rgba(239,200,81,0.8)]"
            : "opacity-55 grayscale-[35%] hover:scale-105 hover:opacity-90"
        }`}
      >
        <Image src={icon} alt="" width={36} height={36} className="h-8 w-8 object-contain" />
      </button>
      {hovered && (
        <PortaledHoverTipLayer pin="top-left">
          <HoverTip title={label} compact />
        </PortaledHoverTipLayer>
      )}
    </span>
  );
}

export function BetaArtClient({
  entries,
  characters,
  gameCopy,
  serviceLocale,
  gameLocale,
}: {
  entries: BetaArtEntry[];
  characters: BetaArtCharacter[];
  gameCopy: VexingPuzzleboxGameCopy;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const [mode, setMode] = useState<BetaArtMode>("watch");
  const [typeFilter, setTypeFilter] = useState<BetaArtType | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [earlyAccessOnly, setEarlyAccessOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState(false);
  const { userId, ready, ensureUser } = useAuth();
  const auth = useMemo(() => ({ userId, ready, ensureUser }), [userId, ready, ensureUser]);
  const engagement = useEngagementCounts({ enabled: mode !== "quiz" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("mode");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mode lives in the URL of a static page
    if (requested === "gallery" || requested === "quiz") setMode(requested);
    // A comment link from a profile opens that art with its thread.
    const art = params.get("art");
    if (art && entries.some((entry) => entry.key === art)) {
      setFocusKey(art);
      setOpenComments(window.location.hash === "#comments");
    }
  }, [entries]);

  const changeMode = (next: BetaArtMode) => {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "watch") url.searchParams.delete("mode");
    else url.searchParams.set("mode", next);
    url.searchParams.delete("set");
    window.history.replaceState(window.history.state, "", url);
  };

  const characterColors = useMemo(() => new Set(characters.map((item) => item.color)), [characters]);
  const needle = mode === "gallery" ? query.trim().toLocaleLowerCase() : "";
  const filtered = useMemo(() => entries.filter((entry) => {
    if (typeFilter && entry.type !== typeFilter) return false;
    if (typeFilter === "card" && earlyAccessOnly && !entry.earlyAccess) return false;
    if (typeFilter === "card" && colorFilter === OTHER_COLOR_FILTER && characterColors.has(entry.color ?? "")) return false;
    if (typeFilter === "card" && colorFilter && colorFilter !== OTHER_COLOR_FILTER && entry.color !== colorFilter) return false;
    if (needle && !entry.name.toLocaleLowerCase().includes(needle) && !entry.nameEn.toLocaleLowerCase().includes(needle)) {
      return false;
    }
    return true;
  }), [entries, typeFilter, colorFilter, earlyAccessOnly, characterColors, needle]);

  const modes: { id: BetaArtMode; label: string; description: string }[] = [
    { id: "watch", label: copy.modeWatch, description: copy.modeWatchDescription },
    { id: "gallery", label: copy.modeGallery, description: copy.modeGalleryDescription },
    { id: "quiz", label: copy.modeQuiz, description: copy.modeQuizDescription },
  ];
  const typeFilters: { id: BetaArtType; label: string }[] = [
    { id: "card", label: copy.filterCard },
    { id: "relic", label: copy.filterRelic },
    { id: "power", label: copy.filterPower },
    { id: "epoch", label: copy.filterEpoch },
  ];

  return (
    <section data-beta-art-mode={mode}>
      <div role="tablist" aria-label={copy.modesLabel} className="flex justify-center gap-2 sm:gap-4">
        {modes.map((item) => (
          <ModeButton
            key={item.id}
            label={item.label}
            description={item.description}
            icon={MODE_ICONS[item.id]}
            selected={mode === item.id}
            onSelect={() => changeMode(item.id)}
          />
        ))}
      </div>

      {mode !== "quiz" && (
        <div className="mt-5" data-beta-art-filters>
          {/* Search sits left and the tokens stay centered; watching keeps the search's room so nothing shifts. */}
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <label
              className={`relative flex items-center sm:justify-self-start ${mode === "gallery" ? "" : "invisible"}`}
              aria-hidden={mode === "gallery" ? undefined : true}
            >
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                tabIndex={mode === "gallery" ? undefined : -1}
                disabled={mode !== "gallery"}
                className="h-8 w-full rounded-md border border-border bg-background/80 pl-7 pr-2 text-sm sm:w-52"
              />
            </label>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {typeFilters.map((item) => (
                <TokenFilter
                  key={item.id}
                  label={item.label}
                  icon={TYPE_TOKENS[item.id]}
                  selected={typeFilter === item.id}
                  onClick={() => {
                    setTypeFilter(typeFilter === item.id ? null : item.id);
                    setColorFilter(null);
                    setEarlyAccessOnly(false);
                  }}
                />
              ))}
            </div>
          </div>
          {/* The card row reserves the room it needs (two lines on phones, where the tokens and the
              checkbox wrap), so picking a type never moves the page. It may still grow, never clip:
              a fixed height let the wrapped checkbox fall under the art below. */}
          <div className="mt-1 flex min-h-[5.25rem] flex-wrap content-center items-center justify-center gap-2 sm:min-h-10" data-beta-art-card-filters={typeFilter === "card" ? "" : undefined}>
            {typeFilter === "card" && (
              <>
                {characters.map((character) => (
                  <TokenFilter
                    key={character.color}
                    label={character.name}
                    icon={CHARACTER_TOKENS[character.color] ?? OTHER_CARDS_TOKEN}
                    selected={colorFilter === character.color}
                    onClick={() => setColorFilter(colorFilter === character.color ? null : character.color)}
                  />
                ))}
                <TokenFilter
                  label={copy.filterOther}
                  icon={OTHER_CARDS_TOKEN}
                  selected={colorFilter === OTHER_COLOR_FILTER}
                  onClick={() => setColorFilter(colorFilter === OTHER_COLOR_FILTER ? null : OTHER_COLOR_FILTER)}
                />
                <span className="ml-2">
                  <GameCheckboxToggle
                    checked={earlyAccessOnly}
                    label={copy.filterEarlyAccess}
                    onCheckedChange={() => setEarlyAccessOnly(!earlyAccessOnly)}
                  />
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        {mode !== "quiz" && filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">{copy.filtersEmpty}</p>
        )}
        {mode === "watch" && filtered.length > 0 && (
          <BetaArtViewer
            key={`${typeFilter}-${colorFilter}-${earlyAccessOnly}-${focusKey}-${openComments}`}
            entries={filtered}
            focusKey={focusKey}
            likes={engagement.likes}
            comments={engagement.comments}
            auth={auth}
            initialCommentsOpen={openComments}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        )}
        {mode === "gallery" && filtered.length > 0 && (
          <BetaArtGallery
            entries={filtered}
            likes={engagement.likes}
            comments={engagement.comments}
            auth={auth}
            serviceLocale={serviceLocale}
            onOpen={(key, options) => {
              setFocusKey(key);
              setOpenComments(Boolean(options?.comments));
              setQuery("");
              changeMode("watch");
            }}
          />
        )}
        {mode === "quiz" && (
          <BetaArtQuiz
            entries={entries}
            gameCopy={gameCopy}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        )}
      </div>
    </section>
  );
}
