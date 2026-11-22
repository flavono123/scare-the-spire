import registryPayload from "@/data/place-registry.json";
import {
  getDebateNavTitle,
  getDecisionsDecisionsNavTitle,
  getDefragmentNavTitle,
  getPagestormNavTitle,
  getTransfigureNavTitle,
  getVexingPuzzleboxNavTitle,
} from "@/lib/borrowed-game-copy";
import { getCodexNavGameLabel } from "@/lib/codex-nav-game-labels";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { getSts1NavLabel } from "@/lib/sts1/nav-labels";
import type { Sts1ResourceType } from "@/lib/sts1/types";
import { isLatestByrdispatchNewSection, isLatestByrdispatchOnOrBefore } from "@/lib/toy-box-news";
import { serviceMessages } from "@/messages/service";

export const PLACE_AREAS = ["sts2", "sts1", "zzapper", "toybox"] as const;
export type PlaceArea = (typeof PLACE_AREAS)[number];

const PLACE_KINDS = ["page", "hub", "game", "tool"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

const GAME_LABELS = {
  defragment: getDefragmentNavTitle,
  transfigure: getTransfigureNavTitle,
  decisionsDecisions: getDecisionsDecisionsNavTitle,
  pagestorm: getPagestormNavTitle,
  vexingPuzzlebox: getVexingPuzzleboxNavTitle,
  debate: getDebateNavTitle,
} as const satisfies Record<string, (gameLocale: GameLocale) => string>;

type CodexMessageKey = {
  [Key in keyof typeof serviceMessages.ko.codex]:
    (typeof serviceMessages.ko.codex)[Key] extends string ? Key : never;
}[keyof typeof serviceMessages.ko.codex];

export type PlaceLabel =
  | { ko: string; en: string }
  | { game: keyof typeof GAME_LABELS }
  /** Game nav label; falls back to `message` or the codex message of the same key. */
  | { codex: string; message?: string }
  | { sts1: Sts1ResourceType }
  /** Dotted path into serviceMessages, e.g. "nav.combo". */
  | { message: string };

export type Place = {
  id: string;
  area: PlaceArea;
  kind: PlaceKind;
  href: string;
  /** Older path some links still use (STS1 /cards, /relics, /potions). */
  legacyHref?: string;
  label: PlaceLabel;
  token: string;
  tokenClassName?: string;
  art?: string;
  /** Id of the place this one is listed under (조각모음's services). */
  parent?: string;
  /** Always listed last (low-activity services). */
  fold?: boolean;
  /** Shown under its parent's page but not as its own menu row. */
  menuHidden?: boolean;
  /** Ship date; Toy Box services list newest first. */
  createdAt?: string;
  byrdispatchSectionTitle?: string;
  /** Announced as new until a later byrdispatch than this date is published. */
  announceNewThrough?: string;
  /** The Worker serves this exact path from a static page. */
  exactRoute?: boolean;
  /** Extra search words; places without it are still searchable by name. */
  search?: { ko: string; en: string };
};

function fail(message: string): never {
  throw new Error(`place-registry.json: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(entry: Record<string, unknown>, key: string, id: string): string | undefined {
  const value = entry[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value) fail(`${id}.${key} must be a non-empty string`);
  return value;
}

function optionalBoolean(entry: Record<string, unknown>, key: string, id: string): boolean | undefined {
  const value = entry[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(`${id}.${key} must be a boolean`);
  return value;
}

function messageAt(path: string, serviceLocale: ServiceLocale): string | undefined {
  let node: unknown = serviceMessages[serviceLocale];
  for (const part of path.split(".")) {
    if (!isRecord(node)) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function parseLabel(value: unknown, id: string): PlaceLabel {
  if (!isRecord(value)) fail(`${id}.label must be an object`);
  if (typeof value.ko === "string" && typeof value.en === "string") return { ko: value.ko, en: value.en };
  if (typeof value.game === "string") {
    if (!(value.game in GAME_LABELS)) fail(`${id}.label.game "${value.game}" has no borrowed game title`);
    return { game: value.game as keyof typeof GAME_LABELS };
  }
  if (typeof value.codex === "string") {
    const message = value.message === undefined ? undefined : String(value.message);
    if (message !== undefined && messageAt(message, "ko") === undefined) fail(`${id}.label.message "${message}" is not a message`);
    if (message === undefined && messageAt(`codex.${value.codex}`, "ko") === undefined) {
      fail(`${id}.label.codex "${value.codex}" needs a codex message or a message fallback`);
    }
    return { codex: value.codex, message };
  }
  if (typeof value.sts1 === "string") return { sts1: value.sts1 as Sts1ResourceType };
  if (typeof value.message === "string") {
    if (messageAt(value.message, "ko") === undefined || messageAt(value.message, "en") === undefined) {
      fail(`${id}.label.message "${value.message}" is not a message in both languages`);
    }
    return { message: value.message };
  }
  fail(`${id}.label has no known form`);
}

function parsePlace(value: unknown, index: number): Place {
  if (!isRecord(value)) fail(`places[${index}] must be an object`);
  const id = value.id;
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`places[${index}].id must be a kebab-case string`);
  const area = value.area;
  if (!PLACE_AREAS.includes(area as PlaceArea)) fail(`${id}.area must be one of ${PLACE_AREAS.join(", ")}`);
  const kind = value.kind ?? "page";
  if (!PLACE_KINDS.includes(kind as PlaceKind)) fail(`${id}.kind must be one of ${PLACE_KINDS.join(", ")}`);
  const href = value.href;
  if (typeof href !== "string" || !/^\/[a-z0-9/-]*$/.test(href) || (href !== "/" && href.endsWith("/"))) {
    fail(`${id}.href must be an absolute path without a locale prefix or trailing slash`);
  }
  const token = value.token;
  if (typeof token !== "string" || !token.startsWith("/images/")) fail(`${id}.token must be an /images/ path`);
  const search = value.search;
  if (search !== undefined && (!isRecord(search) || typeof search.ko !== "string" || typeof search.en !== "string")) {
    fail(`${id}.search must be {ko, en}`);
  }

  return {
    id,
    area: area as PlaceArea,
    kind: kind as PlaceKind,
    href,
    legacyHref: optionalString(value, "legacyHref", id),
    label: parseLabel(value.label, id),
    token,
    tokenClassName: optionalString(value, "tokenClassName", id),
    art: optionalString(value, "art", id),
    parent: optionalString(value, "parent", id),
    fold: optionalBoolean(value, "fold", id),
    menuHidden: optionalBoolean(value, "menuHidden", id),
    createdAt: optionalString(value, "createdAt", id),
    byrdispatchSectionTitle: optionalString(value, "byrdispatchSectionTitle", id),
    announceNewThrough: optionalString(value, "announceNewThrough", id),
    exactRoute: optionalBoolean(value, "exactRoute", id),
    search: search as Place["search"],
  };
}

/** Validates the JSON once at import, so a typo fails the build instead of a page. */
export function parsePlaceRegistry(payload: unknown): readonly Place[] {
  if (!isRecord(payload) || !Array.isArray(payload.places)) fail("must have a places array");
  const places = payload.places.map(parsePlace);
  const ids = new Set<string>();
  for (const place of places) {
    if (ids.has(place.id)) fail(`duplicate id ${place.id}`);
    ids.add(place.id);
  }
  for (const place of places) {
    if (place.parent && !ids.has(place.parent)) fail(`${place.id}.parent "${place.parent}" is not a place`);
  }
  return places;
}

export const PLACES: readonly Place[] = parsePlaceRegistry(registryPayload);

export function placesInArea(area: PlaceArea): Place[] {
  return PLACES.filter((place) => place.area === area);
}

export function getPlace(id: string): Place | undefined {
  return PLACES.find((place) => place.id === id);
}

export function placeLabel(place: Place, serviceLocale: ServiceLocale, gameLocale: GameLocale): string {
  const label = place.label;
  if ("ko" in label) return serviceLocale === "ko" ? label.ko : label.en;
  if ("game" in label) return GAME_LABELS[label.game](gameLocale);
  if ("codex" in label) {
    return getCodexNavGameLabel(gameLocale, label.codex)
      ?? messageAt(label.message ?? `codex.${label.codex}`, serviceLocale)
      ?? place.id;
  }
  if ("sts1" in label) return getSts1NavLabel(gameLocale, label.sts1);
  return messageAt(label.message, serviceLocale) ?? place.id;
}

/** The codex message key of a Codex kind, for callers typed on CodexLabelKey. */
export function placeCodexKey(place: Place): CodexMessageKey | null {
  return "codex" in place.label && messageAt(`codex.${place.label.codex}`, "ko") !== undefined
    ? place.label.codex as CodexMessageKey
    : null;
}

export function placeIsNew(place: Place): boolean {
  if (place.announceNewThrough && isLatestByrdispatchOnOrBefore(place.announceNewThrough)) return true;
  return Boolean(place.byrdispatchSectionTitle && isLatestByrdispatchNewSection(place.byrdispatchSectionTitle));
}
