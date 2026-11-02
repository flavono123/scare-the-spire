"use client";

import { useEffect, useMemo, useState } from "react";
import { BetaArtGallery } from "@/components/vexing-puzzlebox/beta-art-gallery";
import { BetaArtQuiz } from "@/components/vexing-puzzlebox/beta-art-quiz";
import { BetaArtViewer } from "@/components/vexing-puzzlebox/beta-art-viewer";
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
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("mode");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mode lives in the URL of a static page
    if (requested === "gallery" || requested === "quiz") setMode(requested);
  }, []);

  const changeMode = (next: BetaArtMode) => {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "watch") url.searchParams.delete("mode");
    else url.searchParams.set("mode", next);
    url.searchParams.delete("set");
    window.history.replaceState(window.history.state, "", url);
  };

  const characterColors = useMemo(() => new Set(characters.map((item) => item.color)), [characters]);
  const filtered = useMemo(() => entries.filter((entry) => {
    if (typeFilter && entry.type !== typeFilter) return false;
    if (earlyAccessOnly && !entry.earlyAccess) return false;
    if (colorFilter === OTHER_COLOR_FILTER) return !characterColors.has(entry.color ?? "");
    if (colorFilter) return entry.color === colorFilter;
    return true;
  }), [entries, typeFilter, colorFilter, earlyAccessOnly, characterColors]);

  const modes: { id: BetaArtMode; label: string }[] = [
    { id: "watch", label: copy.modeWatch },
    { id: "gallery", label: copy.modeGallery },
    { id: "quiz", label: copy.modeQuiz },
  ];
  const typeFilters: { id: BetaArtType | null; label: string }[] = [
    { id: null, label: copy.filterAll },
    { id: "card", label: copy.filterCard },
    { id: "relic", label: copy.filterRelic },
    { id: "power", label: copy.filterPower },
    { id: "epoch", label: copy.filterEpoch },
  ];
  const chipClass = (selected: boolean) => (
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${
      selected
        ? "border-primary bg-primary/15 text-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`
  );

  return (
    <section data-beta-art-mode={mode}>
      <div className="flex justify-center">
        <div role="tablist" aria-label={copy.modesLabel} className="inline-flex rounded-lg border border-border bg-card/80 p-0.5">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              onClick={() => changeMode(item.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode !== "quiz" && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {typeFilters.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={typeFilter === item.id}
              onClick={() => {
                setTypeFilter(item.id);
                if (item.id !== "card") setColorFilter(null);
              }}
              className={chipClass(typeFilter === item.id)}
            >
              {item.label}
            </button>
          ))}
          {typeFilter === "card" && (
            <>
              {characters.map((character) => (
                <button
                  key={character.color}
                  type="button"
                  aria-pressed={colorFilter === character.color}
                  onClick={() => setColorFilter(colorFilter === character.color ? null : character.color)}
                  className={chipClass(colorFilter === character.color)}
                >
                  {character.name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={colorFilter === OTHER_COLOR_FILTER}
                onClick={() => setColorFilter(colorFilter === OTHER_COLOR_FILTER ? null : OTHER_COLOR_FILTER)}
                className={chipClass(colorFilter === OTHER_COLOR_FILTER)}
              >
                {copy.filterOther}
              </button>
              <button
                type="button"
                aria-pressed={earlyAccessOnly}
                onClick={() => setEarlyAccessOnly(!earlyAccessOnly)}
                className={chipClass(earlyAccessOnly)}
              >
                {copy.filterEarlyAccess}
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-5">
        {mode !== "quiz" && filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">{copy.filtersEmpty}</p>
        )}
        {mode === "watch" && filtered.length > 0 && (
          <BetaArtViewer
            entries={filtered}
            focusKey={focusKey}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        )}
        {mode === "gallery" && filtered.length > 0 && (
          <BetaArtGallery
            entries={filtered}
            serviceLocale={serviceLocale}
            onOpen={(key) => {
              setFocusKey(key);
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
