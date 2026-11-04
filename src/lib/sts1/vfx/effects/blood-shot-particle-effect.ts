import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { AdditiveSlashImpactEffect } from "./additive-slash-impact-effect";

/** vfx/combat/BloodShotParticleEffect. */
export class BloodShotParticleEffect extends AbstractGameEffect {
  private sX: number;
  private sY: number;
  private tX: number;
  private tY: number;
  private x: number;
  private y: number;
  private vY: number;
  private vX: number;
  private img: AtlasRegion;
  private activated = false;

  constructor(sX: number, sY: number, tX: number, tY: number) {
    super();
    this.img = ImageMaster.GLOW_SPARK_2;
    this.sX = sX + MathUtils.random(-90, 90) * Settings.scale;
    this.sY = sY + MathUtils.random(-90, 90) * Settings.scale;
    this.tX = tX + MathUtils.random(-50, 50) * Settings.scale;
    this.tY = tY + MathUtils.random(-50, 50) * Settings.scale;
    this.vX = this.sX + MathUtils.random(-200, 200) * Settings.scale;
    this.vY = this.sY + MathUtils.random(-200, 200) * Settings.scale;
    this.x = this.sX;
    this.y = this.sY;
    this.scale = 0.01;
    this.startingDuration = 0.8;
    this.duration = this.startingDuration;
    this.renderBehind = MathUtils.randomBoolean(0.2);
    this.color = new Color(1, 0.1, MathUtils.random(0.2, 0.5), 1);
  }

  update(): void {
    if (this.duration > this.startingDuration / 2) {
      this.scale = Interpolation.pow3In.apply(2.5, this.startingDuration / 2,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2)) * Settings.scale;
      this.x = Interpolation.swingIn.apply(this.sX, this.vX,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2));
      this.y = Interpolation.swingIn.apply(this.sY, this.vY,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2));
    } else {
      this.scale = Interpolation.pow3Out.apply(2, 2.5, this.duration / (this.startingDuration / 2)) * Settings.scale;
      this.x = Interpolation.swingOut.apply(this.tX, this.vX, this.duration / (this.startingDuration / 2));
      this.y = Interpolation.swingOut.apply(this.tY, this.vY, this.duration / (this.startingDuration / 2));
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < this.startingDuration / 2 && !this.activated) {
      this.activated = true;
      this.sX = this.x;
      this.sY = this.y;
    }
    if (this.duration < 0) {
      AbstractDungeon.effectsQueue.push(new AdditiveSlashImpactEffect(this.tX, this.tY, this.color.cpy()));
      CardCrawlGame.screenShake.shake("MED", "SHORT", MathUtils.randomBoolean());
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(Color.BLACK);
    sb.draw(this.img, this.x, this.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale * 2, this.scale * 2, this.rotation);
    sb.setColor(this.color);
    sb.draw(this.img, this.x, this.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale, this.scale, this.rotation);
  }

  dispose(): void {}
}
