import type { SpriteBatch } from "../batch";
import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/GiantFireEffect. */
export class GiantFireEffect extends AbstractGameEffect {
  private img!: AtlasRegion;
  private brightness: number;
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;
  private flipX: boolean;
  private delayTimer: number;

  constructor() {
    super();
    this.flipX = MathUtils.randomBoolean();
    this.delayTimer = MathUtils.random(0.1);
    this.setImg();
    this.startingDuration = 1.5;
    this.duration = this.startingDuration;
    this.x = MathUtils.random(0, Settings.WIDTH) - this.img.packedWidth / 2;
    this.y = MathUtils.random(-200, -400) * Settings.scale - this.img.packedHeight / 2;
    this.vX = MathUtils.random(-70, 70) * Settings.scale;
    this.vY = MathUtils.random(500, 1700) * Settings.scale;
    this.color = new Color(1, 1, 1, 0);
    this.color.g -= MathUtils.random(0.5);
    this.color.b -= this.color.g - MathUtils.random(0, 0.2);
    this.rotation = MathUtils.random(-10, 10);
    this.scale = MathUtils.random(0.5, 7);
    this.brightness = MathUtils.random(0.2, 0.6);
  }

  update(): void {
    if (this.delayTimer > 0) {
      this.delayTimer -= Gdx.graphics.getDeltaTime();
      return;
    }
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    this.scale *= MathUtils.random(0.95, 1.05);
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    } else if (this.startingDuration - this.duration < 0.75) {
      this.color.a = Interpolation.fade.apply(0, this.brightness, (this.startingDuration - this.duration) / 0.75);
    } else if (this.duration < 1) {
      this.color.a = Interpolation.fade.apply(0, this.brightness, this.duration / 1);
    }
  }

  private setImg(): void {
    const roll = MathUtils.randomInt(2);
    if (roll === 0) {
      this.img = ImageMaster.FLAME_1;
    } else if (roll === 1) {
      this.img = ImageMaster.FLAME_2;
    } else {
      this.img = ImageMaster.FLAME_3;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    if (this.flipX && !this.img.isFlipX()) {
      this.img.flip(true, false);
    } else if (!this.flipX && this.img.isFlipX()) {
      this.img.flip(true, false);
    }
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * Settings.scale,
      this.scale * Settings.scale,
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }
}
