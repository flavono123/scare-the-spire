import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { BorderFlashEffect } from "./border-flash-effect";
import { DamageImpactCurvyEffect } from "./damage-impact-curvy-effect";
import { UpgradeShineParticleEffect } from "./upgrade-shine-particle-effect";

const EFFECT_DUR = 1;

/** vfx/combat/WeightyImpactEffect. */
export class WeightyImpactEffect extends AbstractGameEffect {
  private x = 0;
  private y = 0;
  private targetY = 0;
  private static img: AtlasRegion | null = null;
  private impactHook = false;

  /** `WeightyImpactEffect(x, y)`: `new Color(1, 1, 0.1, 0)`. */
  constructor(x: number, y: number);
  /** `WeightyImpactEffect(x, y, newColor)`. */
  constructor(x: number, y: number, newColor: Color);
  constructor(x: number, y: number, newColor?: Color) {
    super();
    if (WeightyImpactEffect.img == null) {
      WeightyImpactEffect.img = ImageMaster.vfxAtlas.findRegion("combat/weightyImpact");
    }
    this.scale = Settings.scale;
    this.x = x - WeightyImpactEffect.img.packedWidth / 2;
    this.y = Settings.HEIGHT - WeightyImpactEffect.img.packedHeight / 2;
    this.duration = EFFECT_DUR;
    this.targetY = y - 180 * Settings.scale;
    this.rotation = MathUtils.random(-1, 1);
    this.color = newColor ?? new Color(1, 1, 0.1, 0);
  }

  update(): void {
    const img = WeightyImpactEffect.img!;
    this.y = Interpolation.fade.apply(Settings.HEIGHT, this.targetY, 1 - this.duration / EFFECT_DUR);
    this.scale += Gdx.graphics.getDeltaTime();
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
      CardCrawlGame.sound.playA("ATTACK_IRON_2", -0.5);
    } else if (this.duration < 0.2) {
      if (!this.impactHook) {
        this.impactHook = true;
        AbstractDungeon.effectsQueue.push(new BorderFlashEffect(Color.ORANGE));
        CardCrawlGame.screenShake.shake("HIGH", "MED", true);
        for (let i = 0; i < 5; i++) {
          // The game offsets y by the region's width as well.
          AbstractDungeon.effectsQueue.push(
            new DamageImpactCurvyEffect(this.x + img.packedWidth / 2, this.y + img.packedWidth / 2),
          );
        }
        for (let i = 0; i < 30; i++) {
          AbstractDungeon.effectsQueue.push(
            new UpgradeShineParticleEffect(
              this.x + MathUtils.random(-100, 100) * Settings.scale + img.packedWidth / 2,
              this.y + MathUtils.random(-50, 120) * Settings.scale + img.packedHeight / 2,
            ),
          );
        }
      }
      this.color.a = Interpolation.fade.apply(0, 0.5, 0.2 / this.duration);
    } else {
      this.color.a = Interpolation.pow2Out.apply(0.6, 0, this.duration / EFFECT_DUR);
    }
  }

  render(sb: SpriteBatch): void {
    const img = WeightyImpactEffect.img!;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    this.color.g = 1;
    sb.setColor(this.color);
    sb.draw(
      img,
      this.x,
      this.y + 140 * Settings.scale,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight * (this.duration + 0.2) * 5,
      this.scale * MathUtils.random(0.99, 1.01) * 0.3,
      this.scale * MathUtils.random(0.99, 1.01) * 2 * (this.duration + 0.8),
      this.rotation,
    );
    this.color.g = 0.6;
    sb.setColor(this.color);
    sb.draw(
      img,
      this.x,
      this.y + 40 * Settings.scale,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight * (this.duration + 0.2) * 5,
      this.scale * MathUtils.random(0.99, 1.01) * 0.7,
      this.scale * MathUtils.random(0.99, 1.01) * 1.3 * (this.duration + 0.8),
      this.rotation,
    );
    this.color.g = 0.2;
    sb.setColor(this.color);
    sb.draw(
      img,
      this.x,
      this.y,
      img.packedWidth / 2,
      img.packedHeight / 2,
      img.packedWidth,
      img.packedHeight * (this.duration + 0.2) * 5,
      this.scale * MathUtils.random(0.99, 1.01),
      this.scale * MathUtils.random(0.99, 1.01) * (this.duration + 0.8),
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
