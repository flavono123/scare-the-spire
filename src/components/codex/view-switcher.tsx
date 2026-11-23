"use client";

/** The compendium top bar's segmented toggle (bestiary tabs, gallery/list). */
export function CompendiumViewSwitcher<T extends string>({
  options,
  active,
  onChange,
  ariaLabel,
}: {
  options: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-border bg-black/20 p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={active === option.key}
          onClick={() => onChange(option.key)}
          className={`px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
            active === option.key ? "rounded bg-primary/20 text-primary" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
