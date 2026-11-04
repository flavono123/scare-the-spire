import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { BorderFlashEffect } from "./border-flash-effect";

/** vfx/combat/ViceCrushEffect. */
export class ViceCrushEffect extends AbstractGameEffect {
  private static img: AtlasRegion | null = null;
  private impactHook = false;
  private x = 0;
  private x2 = 0;
  private y = 0;
  private startX = 0;
  private startX2 = 0;
  private targetX = 0;
  private targetX2 = 0;

  constructor(x: number, y: number) {
    super();
    if (ViceCrushEffect.img == null) {
      ViceCrushEffect.img = ImageMaster.vfxAtlas.findRegion("combat/weightyImpact");
    }
    this.startX = x - 300 * Settings.scale - ViceCrushEffect.img.packedWidth / 2;
    this.startX2 = x + 300 * Settings.scale - ViceCrushEffect.img.packedWidth / 2;
    this.targetX = x - 120 * Settings.scale - ViceCrushEffect.img.packedWidth / 2;
    this.targetX2 = x + 120 * Settings.scale - ViceCrushEffect.img.packedWidth / 2;
    this.x = this.startX;
    this.x2 = this.startX2;
    this.y = y - ViceCrushEffect.img.packedHeight / 2;
    this.scale = 1.1;
    this.duration = 0.7;
    this.startingDuration = 0.7;
    this.rotation = 90;
    this.color = Color.PURPLE.cpy();
    this.color.a = 0;
  }

  update(): void {
    if (this.duration === this.startingDuration) {
      CardCrawlGame.sound.playA("ATTACK_MAGIC_FAST_3", -0.4);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    } else if (this.duration < 0.2) {
      if (!this.impactHook) {
        this.impactHook = true;
        AbstractDungeon.effectsQueue.push(new BorderFlashEffect(Color.PURPLE));
        CardCrawlGame.screenShake.shake("HIGH", "MED", true);
      }
      this.color.a = Interpolation.fade.apply(0, 1, this.duration * 5);
    } else {
      this.color.a = Interpolation.fade.apply(1, 0, this.duration / this.startingDuration);
    }
    this.scale += 1.1 * Gdx.graphics.getDeltaTime();
    this.x = Interpolation.fade.apply(this.targetX, this.startX, this.duration / this.startingDuration);
    this.x2 = Interpolation.fade.apply(this.targetX2, this.startX2, this.duration / this.startingDuration);
  }

  render(sb: SpriteBatch): void {
    const img = ViceCrushEffect.img!;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(new Color(0.5, 0.5, 0.9, this.color.a));
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale * 0.5,
      this.scale * Settings.scale * (this.duration + 0.8),
      this.rotation,
    );
    sb.draw(
      img,
      this.x2,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale * 0.5,
      this.scale * Settings.scale * (this.duration + 0.8),
      this.rotation - 180,
    );
    sb.setColor(new Color(0.7, 0.5, 0.9, this.color.a));
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale * 0.75,
      this.scale * Settings.scale * (this.duration + 0.8),
      this.rotation,
    );
    sb.draw(
      img,
      this.x2,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale * 0.75,
      this.scale * Settings.scale * (this.duration + 0.8),
      this.rotation - 180,
    );
    sb.setColor(this.color);
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale,
      this.scale * Settings.scale * (this.duration + 1),
      this.rotation,
    );
    sb.draw(
      img,
      this.x2,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight,
      this.scale * this.scale * Settings.scale,
      this.scale * Settings.scale * (this.duration + 1),
      this.rotation - 180,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
