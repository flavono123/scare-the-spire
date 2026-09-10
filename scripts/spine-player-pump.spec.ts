import assert from "node:assert/strict";
import { pumpSpinePlayerUntilSkeleton, type SpinePlayer } from "../src/lib/spine-player-runtime";

function fakePlayer(opts?: { complete?: boolean }): SpinePlayer & {
  drawCalls: number;
  complete: boolean;
} {
  const player = {
    drawCalls: 0,
    complete: opts?.complete ?? false,
    skeleton: null as { name: string } | null,
    error: false,
    assetManager: {
      isLoadingComplete() {
        return player.complete;
      },
    },
    drawFrame() {
      player.drawCalls += 1;
      if (player.complete) player.skeleton = { name: "loaded" };
    },
  };
  return player as unknown as SpinePlayer & { drawCalls: number; complete: boolean };
}

async function main() {
  {
    const player = fakePlayer({ complete: true });
    const stop = pumpSpinePlayerUntilSkeleton(player, () => false);
    assert.equal(player.drawCalls, 1);
    assert.ok(player.skeleton);
    stop();
  }

  {
    const player = fakePlayer({ complete: false });
    let disposed = false;
    const stop = pumpSpinePlayerUntilSkeleton(player, () => disposed);
    assert.equal(player.drawCalls, 0);
    disposed = true;
    stop();
    player.complete = true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(player.drawCalls, 0);
  }

  {
    const player = fakePlayer({ complete: false });
    pumpSpinePlayerUntilSkeleton(player, () => false);
    assert.equal(player.drawCalls, 0);
    player.complete = true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(player.drawCalls, 1);
    assert.ok(player.skeleton);
  }

  console.log("spine-player-pump.spec.ts: ok");
}

void main();
