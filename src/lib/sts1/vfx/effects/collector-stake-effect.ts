import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { AdditiveSlashImpactEffect } from "./additive-slash-impact-effect";

/** vfx/CollectorStakeEffect. */
export class CollectorStakeEffect extends AbstractGameEffect {
  private static img: AtlasRegion | null = null;
  private x: number;
  private y: number;
  private sX: number;
  private sY: number;
  private tX: number;
  private tY: number;
  private targetAngle: number;
  private startingAngle: number;
  private targetScale: number;
  private shownSlash = false;

  constructor(x: number, y: number) {
    super();
    if (CollectorStakeEffect.img === null) CollectorStakeEffect.img = ImageMaster.vfxAtlas.findRegion("combat/stake");
    const img = CollectorStakeEffect.img;
    const angle = 0.017453292 * MathUtils.random(-50, 230);
    this.x = MathUtils.cos(angle) * MathUtils.random(200, 600) * Settings.scale + x;
    this.y = MathUtils.sin(angle) * MathUtils.random(200, 500) * Settings.scale + y;
    this.duration = 1;
    this.scale = 0.01;
    this.targetScale = MathUtils.random(0.4, 1.1);
    this.targetAngle = MathUtils.atan2(y - this.y, x - this.x) * 57.295776 + 90;
    this.startingAngle = MathUtils.random(0, 360);
    this.rotation = this.startingAngle;
    this.x -= Math.trunc(img.packedWidth / 2);
    this.y -= Math.trunc(img.packedHeight / 2);
    this.sX = this.x;
    this.sY = this.y;
    this.tX = x - Math.trunc(img.packedWidth / 2);
    this.tY = y - Math.trunc(img.packedHeight / 2);
    this.color = new Color(MathUtils.random(0.5, 1), MathUtils.random(0, 0.4), MathUtils.random(0.5, 1), 0);
  }

  update(): void {
    const img = CollectorStakeEffect.img as AtlasRegion;
    this.rotation = Interpolation.elasticIn.apply(this.targetAngle, this.startingAngle, this.duration);
    if (this.duration > 0.5) {
      this.scale = Interpolation.elasticIn.apply(this.targetScale, this.targetScale * 10, (this.duration - 0.5) * 2)
        * Settings.scale;
      this.color.a = Interpolation.fade.apply(0.6, 0, (this.duration - 0.5) * 2);
    } else {
      this.x = Interpolation.exp10Out.apply(this.tX, this.sX, this.duration * 2);
      this.y = Interpolation.exp10Out.apply(this.tY, this.sY, this.duration * 2);
    }
    if (this.duration < 0.05 && !this.shownSlash) {
      AbstractDungeon.effectsQueue.push(new AdditiveSlashImpactEffect(this.tX + img.packedWidth / 2,
        this.tY + img.packedHeight / 2, this.color.cpy()));
      this.shownSlash = true;
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
      CardCrawlGame.screenShake.shake("MED", "SHORT", MathUtils.randomBoolean());
      CardCrawlGame.sound.play("ATTACK_FAST", 0.2);
    }
  }

  render(sb: SpriteBatch): void {
    const img = CollectorStakeEffect.img as AtlasRegion;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(img, this.x, this.y, img.packedWidth / 2, img.packedHeight / 2, img.packedWidth, img.packedHeight,
      this.scale * MathUtils.random(1, 1.2), this.scale * MathUtils.random(1, 1.2), this.rotation);
    sb.draw(img, this.x, this.y, img.packedWidth / 2, img.packedHeight / 2, img.packedWidth, img.packedHeight,
      this.scale * MathUtils.random(0.9, 1.1), this.scale * MathUtils.random(0.9, 1.1), this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
