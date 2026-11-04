import { AbstractGameEffect } from "../effect";
import { AbstractDungeon, Gdx, Settings } from "../world";
import { WobblyLineEffect } from "./wobbly-line-effect";

const EFFECT_DUR = 1;
const VFX_INTERVAL = 0.016;

/** vfx/combat/IntimidateEffect. */
export class IntimidateEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private vfxTimer = 0;

  constructor(x: number, y: number) {
    super();
    this.duration = EFFECT_DUR;
    this.x = x;
    this.y = y;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    this.vfxTimer -= Gdx.graphics.getDeltaTime();
    if (this.vfxTimer < 0) {
      this.vfxTimer = VFX_INTERVAL;
      AbstractDungeon.effectsQueue.push(new WobblyLineEffect(this.x, this.y, Settings.CREAM_COLOR.cpy()));
    }
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(): void {}

  dispose(): void {}
}
