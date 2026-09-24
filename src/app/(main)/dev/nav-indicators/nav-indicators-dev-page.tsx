"use client";

import { useEffect, useState } from "react";
import { replaceNavSeen } from "@/hooks/use-nav-seen";
import {
  NAV_SEEN_SURFACES,
  readNavSeen,
  type NavSeenMap,
} from "@/lib/nav-seen";
import { supabaseEnv } from "@/lib/supabase";

function shiftHours(iso: string, hours: number): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return new Date().toISOString();
  return new Date(time + hours * 60 * 60 * 1000).toISOString();
}

export default function NavIndicatorsDevPage() {
  const [seen, setSeen] = useState<NavSeenMap | null>(null);

  useEffect(() => {
    setSeen(readNavSeen(window.localStorage));
  }, []);

  function save(next: NavSeenMap) {
    setSeen(next);
    replaceNavSeen(next);
  }

  function update(id: string, value: string) {
    if (!seen) return;
    save({ ...seen, [id]: value });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-service text-xl font-bold">상단바 안 읽음</h1>
        <p className="text-sm text-muted-foreground">
          이 브라우저의 {supabaseEnv} 읽음 시각이다. 그 시각 이후의 글만 점으로 표시한다.
          시각을 되돌리면 그 사이 글이 다시 안 읽음이 된다.
        </p>
      </header>
      {seen && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
              onClick={() => save(Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, new Date().toISOString()])))}
            >
              모두 읽음
            </button>
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
              onClick={() => save(Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, shiftHours(seen[surface.id] ?? new Date().toISOString(), -24)])))}
            >
              모두 하루 전으로
            </button>
          </div>
          {NAV_SEEN_SURFACES.map((surface) => (
            <section key={surface.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="font-service text-sm font-semibold">{surface.label}</h2>
              <p className="font-mono text-xs text-muted-foreground">{seen[surface.id]}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                  onClick={() => update(surface.id, new Date().toISOString())}
                >
                  읽음
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                  onClick={() => update(surface.id, shiftHours(seen[surface.id] ?? new Date().toISOString(), -24))}
                >
                  하루 전
                </button>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
