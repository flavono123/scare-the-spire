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
          같은 시나리오(게임 요소 이미지, 가로 정렬, URL OG 카드, 유튜브 플레이어,
          업로드 없음, 서비스 폰트만)를 엔진마다 붙여 본다. 키워드 작성기(케미컬X)와
          구분한다. 프로덕션 라우트가 아니다.
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
