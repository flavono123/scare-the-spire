import Link from "next/link";
import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  PAGESTORM_EDITOR_VARIANTS,
  type PagestormEditorVariantId,
} from "./variants";

export function PagestormEditorShell({
  variantId,
  children,
}: {
  variantId?: PagestormEditorVariantId;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Image
            src="/images/sts2/powers/pagestorm_power.webp"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <p className="font-game-title text-sm text-muted-foreground">DEV · 서류 작성기 목</p>
        </div>
        <h1 className="font-game-title text-2xl">서류 작성기 비교</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          같은 시나리오를 엔진마다 붙인다. {"{"} 자동완성, 편집 중 비링크, 발행 시 링크
          토글, 리사이즈, 애셋 옆 Enter/Backspace는 공통 요구사항이다. 키워드 작성기의
          골드 칩과 달리 여기 {"{"} 는 초상을 넣는다.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/dev/pagestorm-editor"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            variantId == null
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          목록
        </Link>
        {PAGESTORM_EDITOR_VARIANTS.map((variant) => (
          <Link
            key={variant.id}
            href={`/dev/pagestorm-editor/${variant.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              variantId === variant.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {variant.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
