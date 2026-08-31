"use client";

import Link from "next/link";
import { PagestormEditorShell } from "./shell";
import { PAGESTORM_EDITOR_VARIANTS } from "./variants";

export default function PagestormEditorIndex() {
  return (
    <PagestormEditorShell>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PAGESTORM_EDITOR_VARIANTS.map((variant) => (
          <li key={variant.id}>
            <Link
              href={`/dev/pagestorm-editor/${variant.id}`}
              className="block rounded-lg border border-border bg-card/30 p-4 hover:border-primary/50"
            >
              <h2 className="font-game-title text-lg">{variant.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{variant.engine}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{variant.chrome}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-2 font-game-title text-foreground">같은 시나리오</h2>
        <p>
          점모 리젠트 공략 톤: 카드/유물 초상을 본문 이미지로 넣고, 가운데 정렬하고,
          유튜브는 플레이어, Steam URL은 OG 카드. 업로드·다른 폰트는 없다.
        </p>
      </section>
    </PagestormEditorShell>
  );
}
