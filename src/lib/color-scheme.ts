export const COLOR_SCHEME_STORAGE_KEY = "sts-color-scheme";
export const COLOR_SCHEME_CHANGE_EVENT = "sts-color-scheme-change";

export const COLOR_SCHEME_PREFERENCES = ["dark", "light", "system"] as const;
export type ColorSchemePreference = (typeof COLOR_SCHEME_PREFERENCES)[number];
export type ResolvedColorScheme = "dark" | "light";

export const DEFAULT_COLOR_SCHEME_PREFERENCE: ColorSchemePreference = "dark";

/** Matches layout metadata `theme-color` for the dark default. */
export const THEME_COLOR_DARK = "#1a1a2e";
/** Warm paper, same family as `.light --background`. */
export const THEME_COLOR_LIGHT = "#f4f1ea";

export function isColorSchemePreference(value: string | null | undefined): value is ColorSchemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function parseColorSchemePreference(raw: string | null | undefined): ColorSchemePreference {
  return isColorSchemePreference(raw) ? raw : DEFAULT_COLOR_SCHEME_PREFERENCE;
}

export function resolveColorScheme(
  preference: ColorSchemePreference,
  systemPrefersLight: boolean,
): ResolvedColorScheme {
  if (preference === "system") return systemPrefersLight ? "light" : "dark";
  return preference;
}

export function systemPrefersLight(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function readStoredColorSchemePreference(): ColorSchemePreference {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME_PREFERENCE;
  try {
    return parseColorSchemePreference(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
  } catch {
    return DEFAULT_COLOR_SCHEME_PREFERENCE;
  }
}

export function writeStoredColorSchemePreference(preference: ColorSchemePreference): void {
  if (typeof window === "undefined") return;
  const next = parseColorSchemePreference(preference);
  try {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
  } catch {
    // Private browsing / blocked storage: still apply in this tab.
  }
  applyResolvedColorScheme(document.documentElement, resolveColorScheme(next, systemPrefersLight()));
  window.dispatchEvent(new CustomEvent<ColorSchemePreference>(COLOR_SCHEME_CHANGE_EVENT, { detail: next }));
}

export function applyResolvedColorScheme(root: HTMLElement, resolved: ResolvedColorScheme): void {
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved !== "light");
  root.style.colorScheme = resolved;
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "light" ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
  }
}

export function getColorSchemeBootScript(): string {
  return `(function(){var k=${JSON.stringify(COLOR_SCHEME_STORAGE_KEY)};var darkMeta=${JSON.stringify(THEME_COLOR_DARK)};var lightMeta=${JSON.stringify(THEME_COLOR_LIGHT)};function apply(){try{var stored=null;try{stored=localStorage.getItem(k);}catch(e){}var preference=stored==="light"||stored==="system"||stored==="dark"?stored:${JSON.stringify(DEFAULT_COLOR_SCHEME_PREFERENCE)};var systemLight=window.matchMedia("(prefers-color-scheme: light)").matches;var resolved=preference==="system"?(systemLight?"light":"dark"):preference;var root=document.documentElement;root.classList.toggle("light",resolved==="light");root.classList.toggle("dark",resolved!=="light");root.style.colorScheme=resolved;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",resolved==="light"?lightMeta:darkMeta);}catch(e){}}apply();try{window.matchMedia("(prefers-color-scheme: light)").addEventListener("change",apply);window.addEventListener("storage",function(e){if(e.key===null||e.key===k)apply();});window.addEventListener(${JSON.stringify(COLOR_SCHEME_CHANGE_EVENT)},apply);}catch(e){}})();`;
}

export const COLOR_SCHEME_BOOT_SCRIPT = getColorSchemeBootScript();
