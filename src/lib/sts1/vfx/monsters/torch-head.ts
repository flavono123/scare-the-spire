import { TorchHeadFireEffect } from "../effects/torch-head-fire-effect";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { AbstractDungeon, Gdx, Settings, type Creature } from "../world";

const FIRE_TIME = 0.04;

/** monsters/city/TorchHead: the torch flame at its `fireslot` bone. */
export class TorchHead implements MonsterBehavior {
  private fireTimer = 0;

  update(monster: Creature): void {
    this.fireTimer -= Gdx.graphics.getDeltaTime();
    if (this.fireTimer < 0) {
      this.fireTimer = FIRE_TIME;
      const skeleton = monster.skeleton;
      const fireslot = skeleton?.findBone("fireslot");
      if (!skeleton || !fireslot) return;
      AbstractDungeon.effectList.push(
        new TorchHeadFireEffect(
          skeleton.getX() + fireslot.getX() + 10 * Settings.scale,
          skeleton.getY() + fireslot.getY() + 110 * Settings.scale,
        ),
      );
    }
  }
}

export const createTorchHead: MonsterBehaviorFactory = () => new TorchHead();
