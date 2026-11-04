import { MathUtils } from "../gdx";
import { Gdx } from "../world";

/** helpers/MathHelper, the parts the monster classes call. */
export const MathHelper = {
  fadeLerpSnap(startX: number, targetX: number): number {
    if (startX !== targetX) {
      startX = MathUtils.lerp(startX, targetX, Gdx.graphics.getDeltaTime() * 12);
      if (Math.abs(startX - targetX) < 0.01) {
        startX = targetX;
      }
    }
    return startX;
  },
};
