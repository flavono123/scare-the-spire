"use client";

interface VersionSelectorProps {
  versions: string[];
  currentVersion: string;
  selectedVersion: string;
  onChange: (v: string) => void;
}

export function VersionSelector({
  versions,
  currentVersion,
  selectedVersion,
  onChange,
}: VersionSelectorProps) {
  const isOlderVersion = selectedVersion !== currentVersion;

  return (
    <div className="relative shrink-0">
      <select
        value={selectedVersion}
        onChange={(e) => onChange(e.target.value)}
        className={`
          appearance-none text-xs font-mono px-2 py-1 pr-6 rounded-md border cursor-pointer
          bg-[#1a1a2e] focus:outline-none focus:ring-1 focus:ring-yellow-500/50
          ${isOlderVersion
            ? "border-yellow-500/50 text-yellow-400"
            : "border-white/10 text-gray-400 hover:border-white/30"
          }
        `}
      >
        {versions.map((v) => (
          <option key={v} value={v}>
            v{v}{v === currentVersion ? " (latest)" : ""}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
        fill="none"
        stroke={isOlderVersion ? "#fbbf24" : "#9ca3af"}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
