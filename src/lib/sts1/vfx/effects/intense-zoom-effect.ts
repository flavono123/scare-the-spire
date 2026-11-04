import { AbstractGameEffect } from "../effect";
import { Color } from "../gdx";
import { AbstractDungeon, Settings } from "../world";
import { BorderFlashEffect } from "./border-flash-effect";
import { IntenseZoomParticle } from "./intense-zoom-particle";

const AMT = 10;

/** vfx/combat/IntenseZoomEffect. */
export class IntenseZoomEffect extends AbstractGameEffect {
  private isBlack: boolean;
  private x: number;
  private y: number;

  constructor(x: number, y: number, isBlack: boolean) {
    super();
    this.x = x;
    this.y = y;
    this.isBlack = isBlack;
  }

  update(): void {
    if (this.isBlack) {
      AbstractDungeon.effectsQueue.push(new BorderFlashEffect(Color.BLACK, this.isBlack));
    } else {
      AbstractDungeon.effectsQueue.push(new BorderFlashEffect(Settings.GOLD_COLOR, this.isBlack));
    }
    for (let i = 0; i < AMT; i += 1) {
      AbstractDungeon.effectsQueue.push(new IntenseZoomParticle(this.x, this.y, this.isBlack));
    }
    this.isDone = true;
  }

  render(): void {}
}
