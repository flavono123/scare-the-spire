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
  const options = versions.includes(currentVersion) ? versions : [currentVersion, ...versions];

  return (
    <div className="relative shrink-0">
      <select
        value={selectedVersion}
        onChange={(e) => onChange(e.target.value)}
        className={`
          appearance-none text-xs font-mono px-2 py-1 pr-6 rounded-md border cursor-pointer
          bg-card focus:outline-none focus:ring-1 focus:ring-primary/50 dark:bg-[#1a1a2e]
          ${isOlderVersion
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground hover:border-foreground/30 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/30"
          }
        `}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            v{v}{v === currentVersion ? " (latest)" : ""}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <svg
        className={`absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none ${
          isOlderVersion ? "text-primary" : "text-muted-foreground"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
