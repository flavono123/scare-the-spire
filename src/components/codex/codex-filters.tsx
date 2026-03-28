"use client";

import Image from "next/image";

export function FilterSection({
  trigger,
  label,
  children,
}: {
  trigger?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {trigger && (
          <span className="text-[10px] font-mono font-bold text-yellow-500/70 bg-yellow-500/10 rounded px-1 py-0.5 leading-none">
            {trigger}
          </span>
        )}
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
          {label}
        </span>
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
