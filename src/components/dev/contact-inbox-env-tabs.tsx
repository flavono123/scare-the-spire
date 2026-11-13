"use client";

import { useState, type ReactNode } from "react";

const ENVS = [
  { id: "production", label: "운영" },
  { id: "development", label: "개발" },
] as const;

/** Second-level toggle of the dev inquiry inbox; the panels are server-rendered. */
export function ContactInboxEnvTabs({
  panels,
  counts,
}: {
  panels: Record<(typeof ENVS)[number]["id"], ReactNode>;
  counts: Record<(typeof ENVS)[number]["id"], number>;
}) {
  const [env, setEnv] = useState<(typeof ENVS)[number]["id"]>("production");
  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1.5 text-xs font-semibold">
        {ENVS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={env === id}
            onClick={() => setEnv(id)}
            className={`rounded-full border px-3 py-1 ${env === id ? "border-primary/60 bg-primary/12 text-primary" : "border-border text-muted-foreground"}`}
          >
            {label} {counts[id]}
          </button>
        ))}
      </div>
      {panels[env]}
    </div>
  );
}
