"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { replaceNavForce, useNavSeen } from "@/hooks/use-nav-seen";
import {
  NAV_SEEN_SURFACES,
  readNavForce,
  type NavForceMap,
  type NavSeenSurface,
} from "@/lib/nav-seen";
import { supabaseEnv } from "@/lib/supabase";

function IndicatorChip({
  surface,
  on,
  onToggle,
}: {
  surface: NavSeenSurface;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
        on ? "border-[#2AEBBE] bg-[#2AEBBE]/15 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}
    >
      <span>{surface.label}</span>
      <span className={on ? "text-[#14997a]" : "text-muted-foreground"}>{on ? "켜짐" : "꺼짐"}</span>
    </button>
  );
}

export default function NavIndicatorsDevPage() {
  const pathname = usePathname();
  const navSeen = useNavSeen(pathname);
  const [force, setForce] = useState<NavForceMap>({});
  const toySurfaces = NAV_SEEN_SURFACES.filter((surface) => surface.id !== "patches");
  const patchSurface = NAV_SEEN_SURFACES.find((surface) => surface.id === "patches");
  const litToy = toySurfaces.filter((surface) => navSeen.unreadIds.includes(surface.id));

  useEffect(() => {
    setForce(readNavForce(window.localStorage));
  }, [navSeen.unreadIds]);

  function toggle(id: string) {
    const next = { ...readNavForce(window.localStorage), [id]: !navSeen.unreadIds.includes(id) };
    setForce(next);
    replaceNavForce(next);
  }

  function clearForces() {
    setForce({});
    replaceNavForce({});
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-service text-xl font-bold">상단바 안 읽음</h1>
        <p className="text-sm text-muted-foreground">
          이 브라우저의 {supabaseEnv} 표시를 강제한다. 칩을 누르면 상단바 점이 바로 바뀐다.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-service text-sm font-semibold">패치노트</h2>
          <span className="text-xs text-muted-foreground">{navSeen.patches ? "켜짐" : "꺼짐"}</span>
        </div>
        {patchSurface && (
          <IndicatorChip surface={patchSurface} on={navSeen.patches} onToggle={() => toggle(patchSurface.id)} />
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-service text-sm font-semibold">장난감 상자</h2>
          <span className={`text-xs font-semibold ${navSeen.toyBox ? "text-[#14997a]" : "text-muted-foreground"}`}>
            {navSeen.toyBox ? "켜짐" : "꺼짐"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {navSeen.toyBox
            ? `하위 점이 켜져 있다: ${litToy.map((surface) => surface.label).join(", ")}`
            : "하위가 모두 꺼지면 상자 점도 꺼진다."}
        </p>
        <div className="flex flex-wrap gap-2">
          {toySurfaces.map((surface) => (
            <IndicatorChip
              key={surface.id}
              surface={surface}
              on={navSeen.unreadIds.includes(surface.id)}
              onToggle={() => toggle(surface.id)}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={clearForces}
        disabled={Object.keys(force).length === 0}
        className="w-fit cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        강제 표시 지우기
      </button>
    </main>
  );
}
