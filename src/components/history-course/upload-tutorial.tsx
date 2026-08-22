"use client";

import { Apple, Check, Copy, Terminal } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

type OS = "macos" | "windows" | "linux";

// lucide-react doesn't ship a Windows logo; the four-square mark is a
// trivial inline SVG that reads even at 12px next to the OS label.
function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M3 5.7L10.5 4.65v6.85H3V5.7zm0 12.6V12.5h7.5v6.85L3 18.3zm8.5-13.7L21 3v8.5h-9.5V4.6zm0 14.8V12.5H21V21l-9.5-1.6z" />
    </svg>
  );
}

const OS_LABEL: Record<OS, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

const OS_ICON: Record<OS, ComponentType<SVGProps<SVGSVGElement>>> = {
  macos: Apple,
  windows: WindowsIcon,
  linux: Terminal,
};

const OS_PATH: Record<OS, string> = {
  macos: "~/Library/Application Support/SlayTheSpire2/steam",
  windows: "%APPDATA%\\SlayTheSpire2\\steam",
  linux: "~/.local/share/SlayTheSpire2/steam",
};

function detectOS(): OS {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "windows";
}

function PathBox({ path, copyLabel, copiedLabel }: { path: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers without clipboard API
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 ring-1 ring-border dark:bg-black/40 dark:ring-zinc-800">
      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
        {path}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition",
          copied
            ? "bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "bg-card text-muted-foreground ring-1 ring-border hover:bg-accent dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" aria-hidden /> {copiedLabel}
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden /> {copyLabel}
          </>
        )}
      </button>
    </div>
  );
}

export function UploadTutorial() {
  const copy = serviceMessages[useServiceLocale()].historyCourse.tutorial;
  const [active, setActive] = useState<OS>("windows");
  // Default tab follows the visitor's OS once we hit the client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(detectOS());
  }, []);

  return (
    <details className="group rounded-xl border border-border bg-card/80 ring-1 ring-border open:ring-foreground/20 dark:border-transparent dark:bg-zinc-900/40 dark:ring-zinc-800/80 dark:open:ring-zinc-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
        <span>
          {copy.summary.split("{runFile}")[0]}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground dark:bg-black/40 dark:text-zinc-300">
            .run
          </code>
          {copy.summary.split("{runFile}")[1]}
        </span>
        <span className="text-xs font-normal text-muted-foreground transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4 dark:border-zinc-800/80">
        <div className="flex gap-1.5">
          {(Object.keys(OS_LABEL) as OS[]).map((os) => {
            const Icon = OS_ICON[os];
            return (
              <button
                type="button"
                key={os}
                onClick={() => setActive(os)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-inset transition",
                    os === active
                    ? "bg-primary/15 text-primary ring-primary/30"
                    : "bg-muted/60 text-muted-foreground ring-border hover:text-foreground dark:bg-zinc-900/60 dark:ring-zinc-800 dark:hover:text-zinc-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {OS_LABEL[os]}
              </button>
            );
          })}
        </div>

        <PathBox path={OS_PATH[active]} copyLabel={copy.copy} copiedLabel={copy.copied} />

        <p className="text-xs leading-5 text-muted-foreground">
          {copy.hints[active]}
        </p>

        <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
          {copy.bullets.map((text) => (
            <li key={text}>
              <span className="text-muted-foreground/70">·</span> {text}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
