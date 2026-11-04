import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import type { Color } from "../gdx";
import { GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/AdditiveSlashImpactEffect. */
export class AdditiveSlashImpactEffect extends AbstractGameEffect {
  private x = 0;
  private y = 0;
  private targetScale = 0;
  private static img: AtlasRegion | null = null;

  /** `AdditiveSlashImpactEffect(x, y, color)`: `color` is kept, not copied. */
  constructor(x: number, y: number, color: Color) {
    super();
    if (AdditiveSlashImpactEffect.img == null) {
      AdditiveSlashImpactEffect.img = ImageMaster.vfxAtlas.findRegion("ui/impactLineThick");
    }
    this.x = x - AdditiveSlashImpactEffect.img.packedWidth / 2;
    this.y = y - AdditiveSlashImpactEffect.img.packedHeight / 2;
    this.color = color;
    this.duration = 0.4;
    this.scale = 0.01;
    this.targetScale = MathUtils.random(3, 5);
    this.rotation = MathUtils.random(360);
  }

  update(): void {
    if (this.duration > 0.2) {
      this.color.a = Interpolation.fade.apply(0, 0.8, (this.duration - 0.2) * 5);
      this.scale = Interpolation.fade.apply(0.01, this.targetScale, (this.duration - 0.2) * 5) * Settings.scale;
    } else {
      this.color.a = Interpolation.fade.apply(0, 0.8, this.duration * 5);
      this.scale = Interpolation.fade.apply(0.01, this.targetScale, this.duration * 5) * Settings.scale;
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    const img = AdditiveSlashImpactEffect.img!;
    sb.setColor(this.color);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale / 3,
      this.scale,
      this.rotation,
    );
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale / 6,
      this.scale * 0.5,
      this.rotation + 90,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
