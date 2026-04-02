"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function CodexBackButton() {
  const pathname = usePathname();

  // Hide on codex index page
  if (pathname === "/codex") {
    return null;
  }

  return (
    <Link
      href="/codex"
      className="fixed left-0 bottom-8 z-50 group"
      aria-label="백과사전으로 돌아가기"
    >
      <div className="relative w-[160px] h-[80px]">
        {/* Shadow layer */}
        <Image
          src="/images/sts2/ui/back_button.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain opacity-25 blur-[1px] translate-x-[-2px] translate-y-[2px]"
          aria-hidden
        />
        {/* Outline (visible on hover) */}
        <Image
          src="/images/sts2/ui/back_button_outline.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain opacity-0 group-hover:opacity-80 transition-opacity duration-200 mix-blend-screen"
          aria-hidden
        />
        {/* Main button body */}
        <Image
          src="/images/sts2/ui/back_button.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain group-hover:brightness-125 transition-all duration-200"
          aria-hidden
        />
        {/* Arrow icon */}
        <div className="absolute inset-0 flex items-center justify-center pl-4">
          <Image
            src="/images/sts2/ui/back_button_arrow.png"
            alt="뒤로가기"
            width={48}
            height={40}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-200"
          />
        </div>
      </div>
    </Link>
  );
}
