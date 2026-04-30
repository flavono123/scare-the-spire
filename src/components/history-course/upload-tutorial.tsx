"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type OS = "macos" | "windows" | "linux";

const OS_LABEL: Record<OS, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

const OS_PATH: Record<OS, string> = {
  macos:
    "~/Library/Application Support/SlayTheSpire2/steam/<steam-id>/profile1/saves/history",
  windows:
    "%APPDATA%\\SlayTheSpire2\\steam\\<steam-id>\\profile1\\saves\\history",
  linux:
    "~/.local/share/SlayTheSpire2/steam/<steam-id>/profile1/saves/history",
};

const OS_HINT: Record<OS, string> = {
  macos:
    "Finder에서 Cmd+Shift+G 누르고 위 경로 붙여넣기. Library 폴더는 기본 숨김이라 직접 들어가긴 어렵습니다.",
  windows:
    "탐색기 주소창에 위 경로를 그대로 붙여넣으세요. %APPDATA% 가 자동으로 풀립니다.",
  linux:
    "Steam Proton 환경이라면 ~/.steam/steam/steamapps/compatdata/<app-id>/pfx/drive_c/users/steamuser/AppData/Roaming/SlayTheSpire2/... 아래에 있을 수 있습니다.",
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
          {(Object.keys(OS_LABEL) as OS[]).map((os) => (
            <button
              type="button"
              key={os}
              onClick={() => setActive(os)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-inset transition",
                os === active
                  ? "bg-amber-300/15 text-amber-200 ring-amber-300/30"
                  : "bg-zinc-900/60 text-zinc-400 ring-zinc-800 hover:text-zinc-200",
              )}
            >
              {OS_LABEL[os]}
            </button>
          ))}
        </div>

        <PathBox path={OS_PATH[active]} />

        <p className="text-xs leading-5 text-zinc-400">
          {OS_HINT[active]}
        </p>

        <ul className="space-y-1.5 text-xs leading-5 text-zinc-400">
          <li>
            <span className="text-zinc-500">·</span>{" "}
            <code className="font-mono text-zinc-300">&lt;steam-id&gt;</code>{" "}
            는 17자리 숫자 폴더입니다. 보통 하나만 있습니다.
          </li>
          <li>
            <span className="text-zinc-500">·</span> 한 번 한 적이 있으면{" "}
            <code className="font-mono text-zinc-300">profile1</code>,
            여럿이면{" "}
            <code className="font-mono text-zinc-300">profile2</code>{" "}
            등으로 나옵니다.
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
        </ul>
      </div>
    </details>
  );
}
