"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import type { CodexAncient } from "@/lib/codex-types";
import { EventVfxStage } from "./event-vfx-stage";
import { MonsterSpineStage } from "./monster-spine-stage";

export function AncientSceneStage({ ancient, children }: { ancient: CodexAncient; children?: ReactNode }) {
  const { sceneAsset, spineAsset } = ancient;
  const [readyBodyId, setReadyBodyId] = useState<string | null>(null);
  const bodyReady = !sceneAsset.spine || readyBodyId === ancient.id;
  const onBodyReady = useCallback(() => setReadyBodyId(ancient.id), [ancient.id]);
  const behindVfx = sceneAsset.vfx.manifestPaths.behindBody;
  const frontVfx = sceneAsset.vfx.manifestPaths.inFrontOfBody;
  const viewportOverride = useMemo(() => sceneAsset.spine ? ({
    x: 0,
    y: 0,
    width: sceneAsset.spine.viewport.width,
    height: sceneAsset.spine.viewport.height,
    padLeft: "0%",
    padRight: "0%",
    padTop: "0%",
    padBottom: "0%",
  } as const) : null, [sceneAsset.spine]);
  const skeletonTransform = useMemo(() => sceneAsset.spine ? ({
    coordinateHeight: sceneAsset.spine.viewport.height,
    ...sceneAsset.spine.transform,
  }) : null, [sceneAsset.spine]);

  return (
    <section
      className="relative min-h-[34rem] w-full overflow-hidden bg-[#070910] sm:min-h-[32rem] lg:aspect-[2560/1200] lg:min-h-0"
      data-ancient-art-stage
      data-ancient-id={ancient.id}
      data-ancient-vfx-support={sceneAsset.vfx.support}
    >
      <div className="absolute left-1/2 top-1/2 aspect-[2560/1200] h-full min-w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        {sceneAsset.baseArt && (
          <Image
            src={sceneAsset.baseArt.path}
            alt={sceneAsset.spine ? "" : ancient.name}
            fill
            sizes="(max-width: 1024px) 100vw, 72rem"
            className="z-0 object-cover"
            priority
          />
        )}

        {behindVfx && <EventVfxStage sceneUrl={behindVfx} offsetX={0} offsetY={0} />}

        {sceneAsset.spine && spineAsset && (
          <MonsterSpineStage
            asset={spineAsset}
            fallbackImageUrl={null}
            monsterName={ancient.name}
            selectedMoveId="IDLE"
            showLoadingLabel={false}
            viewportTransitionTime={0}
            viewportOverride={viewportOverride}
            skeletonTransform={skeletonTransform}
            onReady={onBodyReady}
            className="absolute inset-0 z-20"
          />
        )}

        {sceneAsset.spine && !bodyReady && (
          <Image
            src={sceneAsset.fallback.path}
            alt={ancient.name}
            fill
            sizes="(max-width: 1024px) 100vw, 72rem"
            className="z-20 object-cover motion-safe:transition-opacity motion-reduce:transition-none"
            priority
          />
        )}

        {frontVfx && <div className="absolute inset-0 z-30"><EventVfxStage sceneUrl={frontVfx} offsetX={0} offsetY={0} /></div>}
      </div>
      {children && <div className="absolute inset-0 z-40">{children}</div>}
    </section>
  );
}
