import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx } from "../world";
import { BorderLongFlashEffect } from "./border-long-flash-effect";

const DUR = 2;

/** vfx/combat/LaserBeamEffect. */
export class LaserBeamEffect extends AbstractGameEffect {
  private static img: AtlasRegion | null = null;
  private x: number;
  private y: number;
  private playedSfx = false;

  constructor(x: number, y: number) {
    super();
    if (LaserBeamEffect.img === null) LaserBeamEffect.img = ImageMaster.vfxAtlas.findRegion("combat/laserThick");
    this.x = x;
    this.y = y;
    this.color = Color.CYAN.cpy();
    this.duration = DUR;
    this.startingDuration = DUR;
  }

  update(): void {
    if (!this.playedSfx) {
      AbstractDungeon.effectsQueue.push(new BorderLongFlashEffect(Color.SKY));
      this.playedSfx = true;
      CardCrawlGame.sound.play("ATTACK_MAGIC_BEAM");
      CardCrawlGame.screenShake.rumble(2);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.pow2In.apply(1, 0, this.duration - 1);
    } else {
      this.color.a = Interpolation.pow2Out.apply(0, 1, this.duration);
    }
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    const img = LaserBeamEffect.img as AtlasRegion;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(new Color(0.5, 0.7, 1, this.color.a));
    sb.draw(img, this.x, this.y - Math.trunc(img.packedHeight / 2), 0, img.packedHeight / 2, img.packedWidth,
      img.packedHeight, this.scale * 2 + MathUtils.random(-0.05, 0.05), this.scale * 1.5 + MathUtils.random(-0.1, 0.1),
      MathUtils.random(186, 189));
    sb.draw(img, this.x, this.y - Math.trunc(img.packedHeight / 2), 0, img.packedHeight / 2, img.packedWidth,
      img.packedHeight, this.scale * 2 + MathUtils.random(-0.05, 0.05), this.scale * 1.5 + MathUtils.random(-0.1, 0.1),
      MathUtils.random(186, 189));
    sb.setColor(this.color);
    sb.draw(img, this.x, this.y - Math.trunc(img.packedHeight / 2), 0, img.packedHeight / 2, img.packedWidth,
      img.packedHeight, this.scale * 2, this.scale / 2, MathUtils.random(187, 188));
    sb.draw(img, this.x, this.y - Math.trunc(img.packedHeight / 2), 0, img.packedHeight / 2, img.packedWidth,
      img.packedHeight, this.scale * 2, this.scale / 2, MathUtils.random(187, 188));
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
