"use client";

import { useEffect, useState } from "react";

interface CodexFilterDrawerState {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
}

export function useCodexFilterDrawer(): CodexFilterDrawerState {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (e: { matches: boolean }) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return { sidebarOpen, setSidebarOpen, isMobile };
}

export function CodexLibraryShell({
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
          border-r border-white/10 bg-[#16162a] flex flex-col gap-2 overflow-y-auto overscroll-contain transition-all duration-200 shrink-0
          ${
            isMobile
              ? `fixed z-50 bottom-0 top-12 left-0 w-52 touch-pan-y ${sidebarOpen ? "translate-x-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : "-translate-x-full p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"}`
              : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
          }
        `}
      >
        {sidebar}
      </aside>

      {children}
    </div>
  );
}

export function CodexLibraryTopBar({
  sidebarOpen,
  setSidebarOpen,
  closeFiltersLabel,
  openFiltersLabel,
  title,
  search,
  count,
  trailing,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeFiltersLabel: string;
  openFiltersLabel: string;
  title: string;
  search: React.ReactNode;
  count: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-white/10 bg-[#16162a]/80">
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 text-gray-400"
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
      <h1 className="text-base font-bold text-yellow-500 shrink-0">{title}</h1>
      <div className="min-w-0 flex-1 max-w-xl mx-auto">{search}</div>
      <span className={`${trailing ? "hidden sm:inline" : "inline"} text-sm text-gray-500 shrink-0 tabular-nums`}>{count}</span>
      {trailing}
    </div>
  );
}
