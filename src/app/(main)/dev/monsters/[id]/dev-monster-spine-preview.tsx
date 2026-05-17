"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CodexMonster } from "@/lib/codex-types";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";

interface DevMonsterSpinePreviewProps {
  monster: CodexMonster;
  fallbackImageUrl: string | null;
}

interface PreviewAction {
  id: string;
  label: string;
  description: string;
}

export function DevMonsterSpinePreview({ monster, fallbackImageUrl }: DevMonsterSpinePreviewProps) {
  const imageSrc = fallbackImageUrl;
  const asset = monster.spineAsset;
  const actions = useMemo(() => buildPreviewActions(monster), [monster]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(
    actions[0]?.id ?? null,
  );
  const [selectedSkin, setSelectedSkin] = useState<string | null>(
    getDefaultMonsterSkin(monster),
  );
  const activeSkin = selectedSkin ?? getDefaultMonsterSkin(monster);
  const skinVariants = asset?.skinVariants ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dev/monsters" className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
        ← 몬스터 정리
      </Link>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / MONSTER PREVIEW
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">{monster.name}</h1>
        <p className="font-mono text-xs text-zinc-500">{monster.id}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#18182b]">
          <div className="relative flex min-h-[28rem] items-center justify-center overflow-hidden border-b border-white/10 px-4 py-6 sm:min-h-[36rem]">
            {imageSrc ? (
              <MonsterSpineStage
                key={`${monster.id}-${activeSkin ?? "base"}`}
                asset={asset}
                fallbackImageUrl={imageSrc}
                monsterName={monster.name}
                selectedMoveId={selectedActionId}
                selectedSkin={activeSkin}
                className="relative z-10 h-[24rem] w-full sm:h-[34rem]"
              />
            ) : (
              <div className="text-sm text-zinc-600">no art</div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1">
                {asset ? `${asset.animations.length} anim` : "no spine"}
              </span>
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1">
                {asset ? `${asset.skins.length} skin` : "no skin"}
              </span>
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1">
                {Object.keys(asset?.moveEffects ?? {}).length} vfx move
              </span>
            </div>

            {skinVariants.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">외형</span>
                <div className="flex flex-wrap gap-1">
                  {skinVariants.map((variant) => {
                    const selected = activeSkin === variant.id;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedSkin(variant.id)}
                        className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? "border-amber-300/70 bg-amber-300/15 text-amber-200"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        {variant.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          {monster.id === "DECIMILLIPEDE_SEGMENT" && (
            <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-4">
              <h2 className="mb-2 text-sm font-semibold text-sky-200">만각지네 Spine 진단</h2>
              <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
                <p>게임 DLL에서 `ShouldShowInCompendium`가 false라 기본 Spine 인덱싱 대상에서 제외됩니다.</p>
                <p>PCK에는 `decimillipede1/2/3.skel`과 `front/middle/back.atlas`가 따로 있고, Godot scene이 세 세그먼트를 조합합니다.</p>
                <p>현재 추출기는 `.tres`의 skeleton-data 매핑을 해석하지 않아 `rockstone` actor만 단독 추출합니다.</p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">행동/애니메이션</h2>
            {actions.length > 0 ? (
              <div className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
                {actions.map((action) => {
                  const selected = selectedActionId === action.id;
                  const effects = asset?.moveEffects[action.id] ?? [];

                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setSelectedActionId(action.id)}
                      className={`rounded border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-amber-300/60 bg-amber-300/12"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/10"
                      }`}
                    >
                      <span className="block text-sm font-medium text-zinc-100">{action.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-500">{action.id}</span>
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {action.description}
                        {effects.length > 0 ? ` + ${effects.length} VFX` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">재생 가능한 Spine 애니메이션이 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function buildPreviewActions(monster: CodexMonster): PreviewAction[] {
  const asset = monster.spineAsset;
  if (!asset) return [];

  const actions = new Map<string, PreviewAction>();
  for (const move of monster.bestiaryMoves) {
    const candidates = asset.moveAnimations[move.id] ?? [];
    if (candidates.length === 0 && !asset.moveEffects[move.id]) continue;
    actions.set(move.id, {
      id: move.id,
      label: move.name,
      description: `move: ${candidates.join(", ") || "effect only"}`,
    });
  }

  for (const animation of asset.animations) {
    actions.set(animation, {
      id: animation,
      label: animation,
      description: animation.startsWith("_ignore/") ? "raw ignored animation" : "raw animation",
    });
  }

  return [...actions.values()];
}

function getDefaultMonsterSkin(monster: CodexMonster): string | null {
  if (!monster.spineAsset) return null;
  if (monster.spineAsset.skin) return monster.spineAsset.skin;
  return monster.spineAsset.skinVariants?.some((variant) => variant.id === "default") ? "default" : null;
}
