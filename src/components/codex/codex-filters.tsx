"use client";

import Image from "next/image";

export function FilterSection({
  trigger,
  label,
  children,
  sortDir,
  onSortToggle,
}: {
  trigger?: string;
  label: string;
  children: React.ReactNode;
  sortDir?: "asc" | "desc";
  onSortToggle?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 bg-[#3a5a5a]/60 rounded px-2 py-1">
        {trigger && (
          <span className="text-[10px] font-mono font-bold text-yellow-500/70 bg-yellow-500/10 rounded px-1 py-0.5 leading-none">
            {trigger}
          </span>
        )}
        <span className="text-sm text-gray-200 font-bold tracking-wide">
          {label}
        </span>
        {onSortToggle && (
          <button
            onClick={onSortToggle}
            className="ml-auto flex items-center px-1 py-0.5 rounded hover:bg-white/10 transition-colors"
            title="정렬 기준 변경"
          >
            {/* Game-style sort icon: stacked bars + arrow */}
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
              {/* Stacked horizontal bars */}
              <rect x="2" y="4" width="10" height="2" rx="0.5" fill="#eab308" />
              <rect x="2" y="8" width="8" height="2" rx="0.5" fill="#eab308" />
              <rect x="2" y="12" width="6" height="2" rx="0.5" fill="#eab308" />
              {/* Arrow */}
              {sortDir === "desc" ? (
                <>
                  <line x1="15" y1="5" x2="15" y2="14" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M12.5 11.5L15 14.5L17.5 11.5" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </>
              ) : (
                <>
                  <line x1="15" y1="14" x2="15" y2="5" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M12.5 7.5L15 4.5L17.5 7.5" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function IconFilterButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-9 h-9 rounded-lg border-2 transition-all ${
        active
          ? "border-yellow-500 bg-yellow-500/20"
          : "border-white/10 hover:border-white/30 bg-white/5"
      }`}
      title={label}
    >
      <Image
        src={icon}
        alt={label}
        width={28}
        height={28}
        className={`w-full h-full object-contain p-0.5 ${
          active ? "" : "opacity-50 group-hover:opacity-100"
        }`}
      />
      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </button>
  );
}

export function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded transition-all ${
        active
          ? "bg-yellow-500/15 text-yellow-400"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-all ${
          active ? "border-yellow-500 bg-yellow-500" : "border-gray-600"
        }`}
      >
        {active && (
          <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
