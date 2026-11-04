import { NemesisFireParticle } from "../effects/nemesis-fire-particle";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { AbstractDungeon, Gdx, type Creature } from "../world";

const FIRE_TIME = 0.05;

/**
 * monsters/beyond/Nemesis: fire from its three eyes. Its `changeState("ATTACK")`
 * only plays the Attack clip, which the move's timeline already does.
 */
export class Nemesis implements MonsterBehavior {
  private fireTimer = 0;

  update(monster: Creature): void {
    this.fireTimer -= Gdx.graphics.getDeltaTime();
    if (this.fireTimer < 0) {
      this.fireTimer = FIRE_TIME;
      const skeleton = monster.skeleton;
      const eye1 = skeleton?.findBone("eye0");
      const eye2 = skeleton?.findBone("eye1");
      const eye3 = skeleton?.findBone("eye2");
      if (!skeleton || !eye1 || !eye2 || !eye3) return;
      AbstractDungeon.effectList.push(
        new NemesisFireParticle(skeleton.getX() + eye1.getWorldX(), skeleton.getY() + eye1.getWorldY()),
      );
      AbstractDungeon.effectList.push(
        new NemesisFireParticle(skeleton.getX() + eye2.getWorldX(), skeleton.getY() + eye2.getWorldY()),
      );
      AbstractDungeon.effectList.push(
        new NemesisFireParticle(skeleton.getX() + eye3.getWorldX(), skeleton.getY() + eye3.getWorldY()),
      );
    }
  }
}

export const createNemesis: MonsterBehaviorFactory = () => new Nemesis();
