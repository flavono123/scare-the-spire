"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import Image from "@/components/ui/static-image";
import { localizeHref, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import {
  STS1_STAGE_HEIGHT,
  STS1_STAGE_WIDTH,
  buttonGlowAlpha,
  characterOptionGlowAlpha,
  fadeLerpSnap,
  popLerpSnap,
  startScreenShake,
  stepScreenShake,
  uiLerpSnap,
  type ScreenShakeState,
} from "@/lib/sts1/char-select-motion";
import { sts1GameLocale } from "@/lib/sts1/locale";
import {
  sts1CharSelectUiUrl,
  sts1CharacterIconUrl,
  sts1CharacterPortraitUrl,
  sts1DetailPath,
  sts1SoundUrl,
} from "@/lib/sts1/paths";
import type { Sts1Character, Sts1CharacterId, Sts1CharacterSelectUi } from "@/lib/sts1/types";
import { Sts1SmartText, gdxFontEffects } from "./smart-text";

export interface Sts1CharacterSelectRelic {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  outlineUrl: string;
}

// Settings.*_COLOR (RGBA8888 ints from Settings.<clinit>).
const GOLD = "#efc851";
const CREAM = "#fff6e2";
const RED_TEXT = "#ff6563";
const LIGHT_YELLOW = "#ffeda7";
const DARK_GRAY = "#3f3f3f";

const INFO_Y = STS1_STAGE_HEIGHT / 2;
const START_INFO_X = -800;

type Layout = {
  destInfoX: number;
  buttonY: number;
  chooseY: number;
  name: { dx: number; dy: number; size: number };
  hp: { iconDx: number; textDx: number; iconDy: number; textDy: number; size: number };
  gold: { iconDx: number; textDx: number };
  flavor: { dx: number; dy: number; size: number; lineHeight: number; selectedOnly: boolean };
  relic: {
    centerDy: number;
    scale: number;
    nameDx: number;
    nameDy: number;
    nameSize: number;
    descDy: number;
    descSize: number;
    descSelectedOnly: boolean;
  };
  buttonLabelSize: number;
};

// CharacterOption.renderInfo / CharacterSelectScreen.positionButtons, desktop branch.
const DESKTOP_LAYOUT: Layout = {
  destInfoX: 200,
  buttonY: 190,
  chooseY: 340,
  name: { dx: -35, dy: 200, size: 72 },
  hp: { iconDx: -10, textDx: 18, iconDy: 95, textDy: 102, size: 23 },
  gold: { iconDx: 190, textDx: 220 },
  flavor: { dx: -26, dy: 40, size: 23, lineHeight: 30, selectedOnly: false },
  relic: {
    centerDy: -60,
    scale: 1,
    nameDx: 44,
    nameDy: -40,
    nameSize: 23,
    descDy: -66,
    descSize: 22,
    descSelectedOnly: false,
  },
  buttonLabelSize: 32,
};

// Settings.isMobile branch of the same methods.
const MOBILE_LAYOUT: Layout = {
  destInfoX: 160,
  buttonY: 230,
  chooseY: 380,
  name: { dx: -35, dy: 350, size: 72 * 1.1 },
  hp: { iconDx: -10, textDx: 18, iconDy: 230, textDy: 243, size: 37 * 0.8 },
  gold: { iconDx: 260, textDx: 290 },
  flavor: { dx: -26, dy: 170, size: 37 * 0.9, lineHeight: 40, selectedOnly: true },
  relic: {
    centerDy: 30,
    scale: 1.4,
    nameDx: 60,
    nameDy: 60,
    nameSize: 26,
    descDy: 24,
    descSize: 26,
    descSelectedOnly: true,
  },
  buttonLabelSize: 37,
};

// ConfirmButton / MenuCancelButton constants.
const CONFIRM_SHOW_X = STS1_STAGE_WIDTH - 256;
const CONFIRM_HIDE_X = CONFIRM_SHOW_X + 400;
const CANCEL_SHOW_X = 256;
const CANCEL_HIDE_X = CANCEL_SHOW_X - 400;
const BUTTON_DRAW_Y = 128;

const MUTE_STORAGE_KEY = "sts1-sfx-muted";

function top(y: number): number {
  return STS1_STAGE_HEIGHT - y;
}

function fontFamilies(gameLocale: GameLocale): { ui: string; banner: string } {
  const locale = sts1GameLocale(gameLocale);
  if (locale === "kor") {
    return { ui: '"STS GC Batang", var(--font-service)', banner: '"STS GC Batang", var(--font-service)' };
  }
  if (locale === "zhs" || locale === "jpn" || locale === "tha" || locale === "rus" || locale === "pol") {
    return { ui: "var(--font-service)", banner: "var(--font-service)" };
  }
  return { ui: '"STS Kreon", var(--font-service)', banner: '"STS1 Banner", "STS Kreon", serif' };
}

const MUTE_CHANGE_EVENT = "sts1-sfx-muted-change";

function readMuted(): boolean {
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

function subscribeMuted(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(MUTE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(MUTE_CHANGE_EVENT, onChange);
  };
}

function useSts1Sfx() {
  const muted = useSyncExternalStore(subscribeMuted, readMuted, () => false);
  const cache = useRef(new Map<string, HTMLAudioElement>());

  const toggle = useCallback(() => {
    window.localStorage.setItem(MUTE_STORAGE_KEY, readMuted() ? "0" : "1");
    window.dispatchEvent(new Event(MUTE_CHANGE_EVENT));
  }, []);

  /** SoundMaster.playA: volume SOUND_VOLUME * MASTER_VOLUME (0.5 * 0.5), pitch 1 + adjust. */
  const play = useCallback((key: string | undefined, pitchAdjust = 0) => {
    if (!key || readMuted()) return;
    let base = cache.current.get(key);
    if (!base) {
      base = new Audio(sts1SoundUrl(key));
      base.preload = "auto";
      cache.current.set(key, base);
    }
    const audio = base.cloneNode() as HTMLAudioElement;
    audio.volume = 0.25;
    audio.preservesPitch = false;
    audio.playbackRate = 1 + pitchAdjust;
    void audio.play().catch(() => undefined);
  }, []);

  return { muted, toggle, play };
}

export function Sts1CharacterSelect({
  characters,
  relics,
  ui,
  title,
  serviceLocale,
  gameLocale,
}: {
  characters: Sts1Character[];
  relics: Record<string, Sts1CharacterSelectRelic>;
  ui: Sts1CharacterSelectUi;
  title: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const router = useRouter();
  const fonts = fontFamilies(gameLocale);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0, left: 0, top: 0, mobile: false });
  const [selectedId, setSelectedId] = useState<Sts1CharacterId | null>(null);
  const [portraitId, setPortraitId] = useState<Sts1CharacterId | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedRef = useRef<Sts1CharacterId | null>(null);
  const sfx = useSts1Sfx();
  const layout = fit.mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const shakeRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const infoRefs = useRef(new Map<string, HTMLDivElement>());
  const highlightRefs = useRef(new Map<string, HTMLDivElement>());
  const confirmRef = useRef<HTMLDivElement>(null);
  const confirmGlowRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLDivElement>(null);
  const cancelGlowRef = useRef<HTMLDivElement>(null);

  const sim = useRef({
    infoX: Object.fromEntries(characters.map((character) => [character.id, START_INFO_X])) as Record<string, number>,
    bgAlpha: 0,
    // MenuPanelScreen darkens the main menu to 0.8 before the character select opens.
    screenAlpha: 0.8,
    confirmX: CONFIRM_HIDE_X,
    cancelX: CANCEL_HIDE_X,
    confirmGlow: 0,
    cancelGlow: 0,
    shake: { duration: 0, startDuration: 0, intensity: 0, vertical: false } as ScreenShakeState,
  });

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      const scale = Math.min(width / STS1_STAGE_WIDTH, height / STS1_STAGE_HEIGHT);
      setFit({
        scale,
        left: (width - STS1_STAGE_WIDTH * scale) / 2,
        top: (height - STS1_STAGE_HEIGHT * scale) / 2,
        mobile: window.matchMedia("(max-width: 767px)").matches,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      const state = sim.current;
      const selected = selectedRef.current;
      const anySelected = selected !== null;
      const destInfoX = layoutRef.current.destInfoX;

      for (const character of characters) {
        const target = character.id === selected ? destInfoX : START_INFO_X;
        state.infoX[character.id] = uiLerpSnap(state.infoX[character.id], target, delta);
        const node = infoRefs.current.get(character.id);
        if (node) node.style.transform = `translateX(${state.infoX[character.id]}px)`;
        const highlight = highlightRefs.current.get(character.id);
        if (highlight) {
          highlight.style.opacity = String(character.id === selected ? characterOptionGlowAlpha(Date.now()) : 0.5);
        }
      }

      state.bgAlpha = fadeLerpSnap(state.bgAlpha, anySelected ? 1 : 0, delta);
      state.screenAlpha = popLerpSnap(state.screenAlpha, anySelected ? 1 : 0.8, delta);
      state.confirmX = uiLerpSnap(state.confirmX, anySelected ? CONFIRM_SHOW_X : CONFIRM_HIDE_X, delta);
      state.cancelX = uiLerpSnap(state.cancelX, CANCEL_SHOW_X, delta);
      if (anySelected) state.confirmGlow += delta * 3;
      state.cancelGlow += delta * 3;

      const shake = stepScreenShake(state.shake, delta, Date.now());
      state.shake = shake.state;

      if (shakeRef.current) shakeRef.current.style.transform = shake.transform;
      if (screenRef.current) screenRef.current.style.opacity = String(state.screenAlpha);
      if (portraitRef.current) portraitRef.current.style.opacity = String(state.bgAlpha);
      if (confirmRef.current) confirmRef.current.style.transform = `translateX(${state.confirmX - CONFIRM_SHOW_X}px)`;
      if (cancelRef.current) cancelRef.current.style.transform = `translateX(${state.cancelX - CANCEL_SHOW_X}px)`;
      if (confirmGlowRef.current) confirmGlowRef.current.style.opacity = String(buttonGlowAlpha(state.confirmGlow));
      if (cancelGlowRef.current) cancelGlowRef.current.style.opacity = String(buttonGlowAlpha(state.cancelGlow));

      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [characters]);

  const select = useCallback((character: Sts1Character) => {
    if (selectedRef.current === character.id) return;
    selectedRef.current = character.id;
    setSelectedId(character.id);
    setPortraitId(character.id);
    if (sim.current.confirmX === CONFIRM_HIDE_X) sim.current.confirmGlow = 0;
    const effect = character.selectEffect;
    const pitchMin = effect.pitchMin ?? 0;
    const pitchMax = effect.pitchMax ?? 0;
    sfx.play(effect.sound, pitchMin + Math.random() * (pitchMax - pitchMin));
    sim.current.shake = startScreenShake(effect.shakeIntensity, effect.shakeDuration, effect.shakeVertical);
  }, [sfx]);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? null,
    [characters, selectedId],
  );
  const detailHref = selected ? localizeHref(sts1DetailPath("characters", selected.slug), serviceLocale) : null;

  const embark = useCallback(() => {
    if (detailHref) router.push(detailHref);
  }, [detailHref, router]);

  const leave = useCallback(() => {
    const fromSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (fromSite && window.history.length > 1) router.back();
    else router.push(localizeHref("/compendium", serviceLocale));
  }, [router, serviceLocale]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const index = characters.findIndex((character) => character.id === selectedRef.current);
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = index < 0
          ? characters[step > 0 ? 0 : characters.length - 1]
          : characters[(index + step + characters.length) % characters.length];
        select(next);
      } else if (event.key === "Enter" && selectedRef.current) {
        event.preventDefault();
        embark();
      } else if (event.key === "Escape") {
        leave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [characters, embark, leave, select]);

  const uiFont = (size: number, extra: CSSProperties = {}): CSSProperties => ({
    fontFamily: fonts.ui,
    fontSize: size,
    lineHeight: 1,
    whiteSpace: "pre",
    ...extra,
  });
  // FontHelper.tipHeaderFont: 2px DARK_GRAY border, 1px 0.33 shadow.
  const tipHeaderShadow = gdxFontEffects({ border: 2, borderColor: DARK_GRAY, shadowX: 1, shadowY: 1, shadowColor: "rgba(0,0,0,0.33)" });
  // FontHelper.buttonLabelFont: 4px quarter-black border, 3px quarter-black shadow.
  const buttonLabelShadow = gdxFontEffects({ border: 4, borderColor: "rgba(0,0,0,0.25)", shadowX: 3, shadowY: 3 });

  const buttonOffsetX = STS1_STAGE_WIDTH / 2 - 330;

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col bg-black">
      <h1 className="sr-only">{title}</h1>
      <div
        ref={viewportRef}
        className={`relative w-full overflow-hidden ${fit.mobile ? "aspect-video flex-none" : "min-h-0 flex-1"}`}
      >
        <div
          className="absolute origin-top-left select-none [&_img]:max-w-none"
          style={{
            width: STS1_STAGE_WIDTH,
            height: STS1_STAGE_HEIGHT,
            left: fit.left,
            top: fit.top,
            transform: `scale(${fit.scale})`,
            visibility: fit.scale > 0 ? "visible" : "hidden",
          }}
        >
          <div ref={shakeRef} className="absolute inset-0 origin-top-left overflow-hidden">
            <Image
              src={sts1CharSelectUiUrl("title-bg")}
              alt=""
              width={STS1_STAGE_WIDTH}
              height={STS1_STAGE_HEIGHT}
              priority
              className="absolute inset-0 h-full w-full"
            />
            <div ref={screenRef} className="absolute inset-0 bg-black" style={{ opacity: 0.8 }} />
            <div ref={portraitRef} className="absolute left-0" style={{ top: -60, width: 1920, height: 1200, opacity: 0 }}>
              {portraitId ? (
                <Image
                  src={sts1CharacterPortraitUrl(portraitId)}
                  alt=""
                  width={1920}
                  height={1200}
                  priority
                  className="h-full w-full"
                />
              ) : null}
            </div>

            <StageButton
              refContainer={cancelRef}
              refGlow={cancelGlowRef}
              x={CANCEL_SHOW_X}
              kind="cancel"
              label={ui.back}
              labelStyle={uiFont(layout.buttonLabelSize, { color: LIGHT_YELLOW, textShadow: buttonLabelShadow, letterSpacing: -2.5 })}
              onHover={() => sfx.play("UI_HOVER")}
              onPress={() => sfx.play("UI_CLICK_1")}
              onActivate={leave}
            />
            <StageButton
              refContainer={confirmRef}
              refGlow={confirmGlowRef}
              x={CONFIRM_SHOW_X}
              kind="confirm"
              label={ui.embark}
              href={detailHref}
              labelStyle={uiFont(layout.buttonLabelSize, { color: LIGHT_YELLOW, textShadow: buttonLabelShadow, letterSpacing: -2.5 })}
              onHover={() => sfx.play("UI_HOVER")}
              onPress={() => sfx.play("UI_CLICK_1")}
            />

            {characters.map((character, index) => {
              const centerX = buttonOffsetX + index * 220;
              const centerTop = top(layout.buttonY);
              const isSelected = character.id === selectedId;
              const lit = isSelected || hoveredId === character.id;
              return (
                <div key={character.id}>
                  <div
                    ref={(node) => {
                      if (node) highlightRefs.current.set(character.id, node);
                      else highlightRefs.current.delete(character.id);
                    }}
                    aria-hidden
                    className="pointer-events-none absolute"
                    style={{
                      left: centerX - 110,
                      top: centerTop - 110,
                      width: 200,
                      height: 200,
                      opacity: 0.5,
                      backgroundColor: isSelected ? "rgb(255,204,51)" : "black",
                      WebkitMaskImage: `url("${sts1CharSelectUiUrl("highlight")}")`,
                      maskImage: `url("${sts1CharSelectUiUrl("highlight")}")`,
                      WebkitMaskSize: "100% 100%",
                      maskSize: "100% 100%",
                    }}
                  />
                  <Image
                    src={sts1CharacterIconUrl(character.id)}
                    alt=""
                    width={220}
                    height={220}
                    className="pointer-events-none absolute"
                    style={{
                      left: centerX - 110,
                      top: centerTop - 110,
                      width: 220,
                      height: 220,
                      filter: lit ? undefined : "brightness(0.75)",
                    }}
                  />
                  <Link
                    href={localizeHref(sts1DetailPath("characters", character.slug), serviceLocale)}
                    aria-label={character.name}
                    aria-current={isSelected ? "true" : undefined}
                    className="absolute rounded-full outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70"
                    style={{ left: centerX - 75, top: centerTop - 75, width: 150, height: 150 }}
                    onPointerEnter={() => {
                      setHoveredId(character.id);
                      sfx.play("UI_HOVER", -0.3);
                    }}
                    onPointerLeave={() => setHoveredId((current) => (current === character.id ? null : current))}
                    onPointerDown={(event) => {
                      if (event.button === 0) sfx.play("UI_CLICK_1", -0.4);
                    }}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                      event.preventDefault();
                      select(character);
                    }}
                  />
                </div>
              );
            })}

            {characters.map((character) => {
              const relic = relics[character.startingRelicIds[0] ?? ""];
              const isSelected = character.id === selectedId;
              const relicSize = 128 * layout.relic.scale;
              return (
                <div
                  key={character.id}
                  ref={(node) => {
                    if (node) infoRefs.current.set(character.id, node);
                    else infoRefs.current.delete(character.id);
                  }}
                  aria-hidden={!isSelected}
                  className="pointer-events-none absolute left-0 top-0"
                  style={{ transform: `translateX(${START_INFO_X}px)` }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: layout.name.dx,
                      top: top(INFO_Y + layout.name.dy),
                      ...uiFont(layout.name.size, {
                        fontFamily: fonts.banner,
                        color: GOLD,
                        letterSpacing: -2,
                        textShadow: gdxFontEffects({ border: 4, borderColor: "rgba(0,0,0,0.33)" }),
                      }),
                    }}
                  >
                    {character.name}
                  </div>
                  <Image
                    src={sts1CharSelectUiUrl("hp")}
                    alt=""
                    width={64}
                    height={64}
                    className="absolute"
                    style={{ left: layout.hp.iconDx - 32, top: top(INFO_Y + layout.hp.iconDy) - 32, width: 64, height: 64 }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: layout.hp.textDx,
                      top: top(INFO_Y + layout.hp.textDy),
                      ...uiFont(layout.hp.size, { color: RED_TEXT, textShadow: tipHeaderShadow }),
                    }}
                  >
                    {`${ui.hp}${character.hp}/${character.maxHp}`}
                  </div>
                  <Image
                    src={sts1CharSelectUiUrl("gold")}
                    alt=""
                    width={64}
                    height={64}
                    className="absolute"
                    style={{ left: layout.gold.iconDx - 32, top: top(INFO_Y + layout.hp.iconDy) - 32, width: 64, height: 64 }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: layout.gold.textDx,
                      top: top(INFO_Y + layout.hp.textDy),
                      ...uiFont(layout.hp.size, { color: GOLD, textShadow: tipHeaderShadow }),
                    }}
                  >
                    {`${ui.gold}${character.gold}`}
                  </div>
                  {!layout.flavor.selectedOnly || isSelected ? (
                    <Sts1SmartText
                      text={character.flavor}
                      color={CREAM}
                      className="absolute"
                      style={{
                        left: layout.flavor.dx,
                        top: top(INFO_Y + layout.flavor.dy),
                        ...uiFont(layout.flavor.size, { lineHeight: `${layout.flavor.lineHeight}px`, textShadow: tipHeaderShadow }),
                      }}
                    />
                  ) : null}
                  {relic ? (
                    <>
                      <div
                        className="absolute"
                        style={{
                          left: -relicSize / 2,
                          top: top(INFO_Y + layout.relic.centerDy) - relicSize / 2,
                          width: relicSize,
                          height: relicSize,
                          opacity: 0.25,
                          backgroundColor: "black",
                          WebkitMaskImage: `url("${relic.outlineUrl}")`,
                          maskImage: `url("${relic.outlineUrl}")`,
                          WebkitMaskSize: "100% 100%",
                          maskSize: "100% 100%",
                        }}
                      />
                      <Image
                        src={relic.imageUrl}
                        alt=""
                        width={128}
                        height={128}
                        className="absolute"
                        style={{
                          left: -relicSize / 2,
                          top: top(INFO_Y + layout.relic.centerDy) - relicSize / 2,
                          width: relicSize,
                          height: relicSize,
                        }}
                      />
                      <div
                        className="absolute"
                        style={{
                          left: layout.relic.nameDx,
                          top: top(INFO_Y + layout.relic.nameDy),
                          ...uiFont(layout.relic.nameSize, { color: GOLD, textShadow: tipHeaderShadow }),
                        }}
                      >
                        {relic.name}
                      </div>
                      {!layout.relic.descSelectedOnly || isSelected ? (
                        <Sts1SmartText
                          text={relic.description}
                          color={CREAM}
                          className="absolute"
                          style={{
                            left: layout.relic.nameDx,
                            top: top(INFO_Y + layout.relic.descDy),
                            ...uiFont(layout.relic.descSize),
                          }}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}

            {selectedId === null ? (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: STS1_STAGE_WIDTH / 2,
                  top: top(layout.chooseY),
                  // FontHelper.losePowerFont at scale 1.2: 4px gray border, 3px quarter-black shadow.
                  ...uiFont(36 * 1.2, {
                    color: CREAM,
                    textShadow: gdxFontEffects({ border: 4, borderColor: "#4d4d4d", shadowX: 3, shadowY: 3 }),
                  }),
                }}
              >
                {ui.choose}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={sfx.toggle}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-amber-300/25 bg-black/50 text-amber-100/80 transition-colors hover:border-amber-300/60 hover:bg-black/70 hover:text-amber-200"
          aria-label={serviceLocale === "ko" ? (sfx.muted ? "효과음 켜기" : "효과음 끄기") : (sfx.muted ? "Unmute sound" : "Mute sound")}
          aria-pressed={!sfx.muted}
        >
          {sfx.muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {fit.mobile ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {selected ? (
            <div className="flex flex-col gap-2 font-game-text">
              <div className="font-game-title text-2xl" style={{ color: GOLD }}>{selected.name}</div>
              <div className="flex gap-4 text-sm">
                <span style={{ color: RED_TEXT }}>{`${ui.hp}${selected.hp}/${selected.maxHp}`}</span>
                <span style={{ color: GOLD }}>{`${ui.gold}${selected.gold}`}</span>
              </div>
              <Sts1SmartText text={selected.flavor} color={CREAM} className="text-sm leading-relaxed" />
              {relics[selected.startingRelicIds[0] ?? ""] ? (
                <div className="text-sm">
                  <div style={{ color: GOLD }}>{relics[selected.startingRelicIds[0]].name}</div>
                  <Sts1SmartText text={relics[selected.startingRelicIds[0]].description} color={CREAM} />
                </div>
              ) : null}
              {detailHref ? (
                <Link href={detailHref} className="mt-1 self-start rounded-md border border-amber-300/40 px-3 py-1.5 text-sm" style={{ color: LIGHT_YELLOW }}>
                  {ui.embark}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="text-center font-game-text text-sm" style={{ color: CREAM }}>{ui.choose}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StageButton({
  refContainer,
  refGlow,
  x,
  kind,
  label,
  labelStyle,
  href,
  onHover,
  onPress,
  onActivate,
}: {
  refContainer: React.RefObject<HTMLDivElement | null>;
  refGlow: React.RefObject<HTMLDivElement | null>;
  x: number;
  kind: "confirm" | "cancel";
  label: string;
  labelStyle: CSSProperties;
  href?: string | null;
  onHover: () => void;
  onPress: () => void;
  onActivate?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const image = sts1CharSelectUiUrl(kind === "confirm" ? "confirm-button" : "cancel-button");
  // Confirm glows white, the menu cancel button glows Settings.GOLD_COLOR.
  const glowColor = kind === "confirm" ? "white" : GOLD;
  const textX = kind === "confirm" ? 136 : -136;
  const hitboxX = kind === "confirm" ? 106 : -106;
  const left = x - 256;
  const imageTop = top(BUTTON_DRAW_Y - 128) - 256;
  const handlers = {
    onPointerEnter: () => {
      setHovered(true);
      onHover();
    },
    onPointerLeave: () => {
      setHovered(false);
      setPressed(false);
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      setPressed(true);
      onPress();
    },
    onPointerUp: () => setPressed(false),
  };
  const hitboxStyle: CSSProperties = {
    left: x + hitboxX - 150,
    top: top(BUTTON_DRAW_Y + 60) - 50,
    width: 300,
    height: 100,
  };
  return (
    <div
      ref={refContainer}
      className="absolute left-0 top-0"
      style={{ transform: `translateX(${kind === "confirm" ? 400 : -400}px)` }}
    >
      <Image
        src={sts1CharSelectUiUrl(kind === "confirm" ? "confirm-button-shadow" : "cancel-button-shadow")}
        alt=""
        width={512}
        height={256}
        className="pointer-events-none absolute"
        style={{ left, top: imageTop, width: 512, height: 256 }}
      />
      <div
        ref={refGlow}
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left,
          top: imageTop,
          width: 512,
          height: 256,
          backgroundColor: glowColor,
          WebkitMaskImage: `url("${sts1CharSelectUiUrl(kind === "confirm" ? "confirm-button-outline" : "cancel-button-outline")}")`,
          maskImage: `url("${sts1CharSelectUiUrl(kind === "confirm" ? "confirm-button-outline" : "cancel-button-outline")}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      />
      <Image
        src={image}
        alt=""
        width={512}
        height={256}
        className="pointer-events-none absolute"
        style={{ left, top: imageTop, width: 512, height: 256 }}
      />
      {hovered && !pressed ? (
        <Image
          src={image}
          alt=""
          width={512}
          height={256}
          className="pointer-events-none absolute"
          style={{
            left,
            top: imageTop,
            width: 512,
            height: 256,
            opacity: kind === "confirm" ? 0.3 : 0.4,
            mixBlendMode: "plus-lighter",
          }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: x + textX,
          top: top(BUTTON_DRAW_Y + 57),
          ...labelStyle,
          ...(pressed ? { color: "#bfbfbf" } : {}),
        }}
      >
        {label}
      </div>
      {href ? (
        <Link href={href} aria-label={label} className="absolute outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70" style={hitboxStyle} {...handlers} />
      ) : onActivate ? (
        <button type="button" aria-label={label} className="absolute outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70" style={hitboxStyle} onClick={onActivate} {...handlers} />
      ) : null}
    </div>
  );
}
