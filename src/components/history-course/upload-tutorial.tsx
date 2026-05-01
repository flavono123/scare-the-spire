"use client";

import { Apple, Check, Copy, Terminal } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

const OS_HINT: Record<OS, string> = {
  macos:
    "Finder에서 Cmd+Shift+G 누르고 위 경로를 붙여넣은 뒤, 열린 steam 폴더 자체를 드롭존에 드래그하세요. Library 폴더가 기본 숨김이라 손으로 들어가긴 어렵습니다.",
  windows:
    "탐색기 주소창에 위 경로를 그대로 붙여넣고, 열린 steam 폴더 자체를 드롭존에 드래그하세요. %APPDATA% 가 자동으로 풀립니다.",
  linux:
    "위 경로의 steam 폴더를 통째로 드래그하세요. Steam Proton 환경이면 ~/.steam/steam/steamapps/compatdata/<app-id>/pfx/drive_c/users/steamuser/AppData/Roaming/SlayTheSpire2/ 아래에 있을 수 있습니다.",
};

function detectOS(): OS {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "windows";
}

function PathBox({ path }: { path: string }) {
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
    <div className="flex items-center gap-2 rounded-md bg-black/40 px-3 py-2 ring-1 ring-zinc-800">
      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-zinc-200">
        {path}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition",
          copied
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" aria-hidden /> 복사됨
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden /> 복사
          </>
        )}
      </button>
    </div>
  );
}

export function UploadTutorial() {
  const [active, setActive] = useState<OS>("windows");
  // Default tab follows the visitor's OS once we hit the client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(detectOS());
  }, []);

  return (
    <details className="group rounded-xl bg-zinc-900/40 ring-1 ring-zinc-800/80 open:ring-zinc-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-200">
        <span>
          내{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
            .run
          </code>{" "}
          파일은 어디에 있나요?
        </span>
        <span className="text-xs font-normal text-zinc-500 group-open:rotate-180 transition">
          ▾
        </span>
      </summary>
      <div className="space-y-3 border-t border-zinc-800/80 px-4 py-4">
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
                    ? "bg-amber-300/15 text-amber-200 ring-amber-300/30"
                    : "bg-zinc-900/60 text-zinc-400 ring-zinc-800 hover:text-zinc-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {OS_LABEL[os]}
              </button>
            );
          })}
        </div>

        <PathBox path={OS_PATH[active]} />

        <p className="text-xs leading-5 text-zinc-400">
          {OS_HINT[active]}
        </p>

        <ul className="space-y-1.5 text-xs leading-5 text-zinc-400">
          <li>
            <span className="text-zinc-500">·</span> 폴더 안의 하위 구조
            (steam-id / profile1 / saves / history) 는 신경쓰지 않아도 됩니다.{" "}
            <span className="text-zinc-300">
              .run 파일을 자동으로 모두 찾습니다.
            </span>
          </li>
          <li>
            <span className="text-zinc-500">·</span> 폴더 안의{" "}
            <code className="font-mono text-zinc-300">
              &lt;timestamp&gt;.run
            </code>{" "}
            파일들이 한 판씩의 기록입니다. 어떤 게 어떤 런인지는 올린 뒤
            골라주세요.
          </li>
          <li>
            <span className="text-zinc-500">·</span> 파일에는 시드/카드/맵만
            들어있고{" "}
            <span className="font-semibold text-zinc-300">
              계정·이메일·실명 같은 개인정보는 없습니다
            </span>
            .
          </li>
          <li>
            <span className="text-zinc-500">·</span> 업로드되는 곳은 본인
            브라우저뿐입니다. 익명으로 공유하려면 런 선택 후 별도 버튼이
            제공됩니다.
          </li>
        </ul>
      </div>
    </details>
  );
}
