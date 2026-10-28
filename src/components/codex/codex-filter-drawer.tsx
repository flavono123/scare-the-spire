"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { GameScrollArea } from "@/components/game-scroll-area";
import { cn } from "@/lib/utils";

interface CodexFilterDrawerState {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
}

export function useCodexFilterDrawer(defaultDesktopOpen = true): CodexFilterDrawerState {
  const [sidebarOpen, setSidebarOpen] = useState(defaultDesktopOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (e: { matches: boolean }) => {
      setIsMobile(e.matches);
      setSidebarOpen(e.matches ? false : defaultDesktopOpen);
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [defaultDesktopOpen]);

  return { sidebarOpen, setSidebarOpen, isMobile };
}

export function CompendiumIndexLayout({
  sidebarOpen,
  setSidebarOpen,
  isMobile,
  sidebar,
  children,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, sidebarOpen]);

  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-background text-foreground overflow-hidden">
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-x-0 bottom-0 top-12 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          border-r border-border bg-sidebar flex flex-col gap-2 overflow-hidden overscroll-contain transition-all duration-200 shrink-0
          ${
            isMobile
              ? `fixed z-50 bottom-0 top-12 left-0 w-52 touch-pan-y ${sidebarOpen ? "translate-x-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : "-translate-x-full p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"}`
              : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
          }
        `}
      >
        <GameScrollArea className="min-h-0 flex-1" size="small" scrollerClassName="flex flex-col gap-2 pr-1">
          {sidebar}
        </GameScrollArea>
      </aside>

      {children}
    </div>
  );
}

export function CompendiumIndexTopBar({
  sidebarOpen,
  setSidebarOpen,
  closeFiltersLabel,
  openFiltersLabel,
  title,
  count,
  trailing,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeFiltersLabel: string;
  openFiltersLabel: string;
  title: string;
  count: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-border bg-sidebar/80">
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground"
        aria-label={sidebarOpen ? closeFiltersLabel : openFiltersLabel}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          )}
        </svg>
      </button>
      <h1 className={`min-w-0 truncate text-base font-bold text-primary ${trailing ? "max-[430px]:sr-only" : ""}`}>{title}</h1>
      <div className="min-w-0 flex-1" />
      <span className={`${trailing ? "hidden sm:inline" : "inline"} text-sm text-muted-foreground shrink-0 tabular-nums`}>{count}</span>
      {trailing}
    </div>
  );
}

export {
  CompendiumIndexLayout as CodexLibraryShell,
  CompendiumIndexTopBar as CodexLibraryTopBar,
};

export function CompendiumIndexScroller({
  children,
  className,
  scrollerClassName,
}: {
  children: ReactNode;
  className?: string;
  scrollerClassName?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className, scrollerClassName)}>
      {children}
    </div>
  );
}

/** Lets a loading stand-in ask its overlay to keep the scroll rail's gutter. */
const ReserveRailGutterContext = createContext<(() => void) | null>(null);

export function CompendiumDetailOverlay({
  children,
  onClose,
  zClassName = "z-50",
  className,
  "aria-label": ariaLabel,
  ...rest
}: {
  children: ReactNode;
  onClose: () => void;
  zClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  // GameScrollArea adds the desktop rail gutter only once content overflows.
  // After a loading stand-in has been shown, keep that gutter so the frame does
  // not move sideways when the full detail arrives and starts to overflow.
  const [reserveRailGutter, setReserveRailGutter] = useState(false);
  const requestRailGutter = useCallback(() => setReserveRailGutter(true), []);
  return (
    <div
      className={cn("fixed inset-0 bg-black/70 backdrop-blur-sm", zClassName, className)}
      role={ariaLabel ? "dialog" : rest.role}
      aria-modal={ariaLabel ? true : rest["aria-modal"]}
      aria-label={ariaLabel}
      {...rest}
    >
      <GameScrollArea
        className={cn("h-full", reserveRailGutter && "md:pr-[calc(var(--game-scroll-rail-width)+0.35rem)]")}
        size="large"
        scrollerClassName="min-h-full"
      >
        <div
          className="flex min-h-full w-full items-start justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <ReserveRailGutterContext.Provider value={requestRailGutter}>
            {children}
          </ReserveRailGutterContext.Provider>
        </div>
      </GameScrollArea>
    </div>
  );
}

/**
 * Stands in for a list modal's detail until the data chunks it reads have
 * loaded, so the modal never shows partial rows or empty-result text.
 */
export function CompendiumDetailLoading({
  title,
  titleId,
  backToListTitle,
  closeLabel,
  loadingLabel,
  onClose,
  className,
  largeControls = false,
}: {
  title: string;
  /** Id for the title, when the dialog is labelled by the detail's own heading id. */
  titleId?: string;
  backToListTitle: string;
  closeLabel: string;
  loadingLabel: string;
  onClose: () => void;
  /**
   * The detail's own root width and padding, when they differ from the
   * default, so the back link and close button stay put when it loads.
   */
  className?: string;
  /** Use 44px header controls, for details whose header uses them. */
  largeControls?: boolean;
}) {
  const requestRailGutter = useContext(ReserveRailGutterContext);
  useLayoutEffect(() => {
    requestRailGutter?.();
  }, [requestRailGutter]);
  return (
    <div className={cn("mx-auto w-full max-w-6xl p-4 sm:p-6", className)} aria-busy="true">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "text-sm text-gray-400 transition-colors hover:text-gray-200",
            largeControls && "flex min-h-11 items-center",
          )}
        >
          ← {backToListTitle}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10",
            largeControls && "h-11 w-11",
          )}
          aria-label={closeLabel}
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 text-center">
        <h2 id={titleId} className="font-game-title text-3xl font-bold text-gray-100 sm:text-4xl">{title}</h2>
        <p className="font-service text-xs text-gray-500" aria-live="polite">
          {loadingLabel}
        </p>
      </div>
    </div>
  );
}

