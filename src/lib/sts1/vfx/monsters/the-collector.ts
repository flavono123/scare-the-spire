import { GlowyFireEyesEffect } from "../effects/glowy-fire-eyes-effect";
import { StaffFireEffect } from "../effects/staff-fire-effect";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { AbstractDungeon, Gdx, Settings, type Creature } from "../world";

const FIRE_TIME = 0.07;

/** monsters/city/TheCollector: fire in both eyes and on the staff. */
export class TheCollector implements MonsterBehavior {
  private fireTimer = 0;

  update(monster: Creature): void {
    this.fireTimer -= Gdx.graphics.getDeltaTime();
    if (this.fireTimer < 0) {
      this.fireTimer = FIRE_TIME;
      const skeleton = monster.skeleton;
      const leftEye = skeleton?.findBone("lefteyefireslot");
      const rightEye = skeleton?.findBone("righteyefireslot");
      const fireslot = skeleton?.findBone("fireslot");
      if (!skeleton || !leftEye || !rightEye || !fireslot) return;
      AbstractDungeon.effectList.push(
        new GlowyFireEyesEffect(
          skeleton.getX() + leftEye.getX(),
          skeleton.getY() + leftEye.getY() + 140 * Settings.scale,
        ),
      );
      AbstractDungeon.effectList.push(
        new GlowyFireEyesEffect(
          skeleton.getX() + rightEye.getX(),
          skeleton.getY() + rightEye.getY() + 140 * Settings.scale,
        ),
      );
      AbstractDungeon.effectList.push(
        new StaffFireEffect(
          skeleton.getX() + fireslot.getX() - 120 * Settings.scale,
          skeleton.getY() + fireslot.getY() + 390 * Settings.scale,
        ),
      );
    }
  }
}

export const createTheCollector: MonsterBehaviorFactory = () => new TheCollector();
