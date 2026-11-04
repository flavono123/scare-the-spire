import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import type { AttackEffect } from "../enums";
import { Color, Interpolation, MathUtils } from "../gdx";
import { CardCrawlGame, Gdx, Settings } from "../world";

const DURATION = 0.6;

/**
 * vfx/combat/FlashAtkImgEffect. Its switches go through the synthetic
 * `FlashAtkImgEffect$1` map, which lists SHIELD, SLASH_DIAGONAL, SLASH_HEAVY,
 * SLASH_HORIZONTAL, SLASH_VERTICAL, BLUNT_LIGHT, BLUNT_HEAVY, FIRE, POISON and
 * NONE; SMASH and LIGHTNING are not in it and always take the default branch.
 */
export class FlashAtkImgEffect extends AbstractGameEffect {
  private static blockSound = 0;
  img: AtlasRegion | null = null;
  private x = 0;
  private y = 0;
  private sY = 0;
  private tY = 0;
  private effect: AttackEffect;
  private triggered = false;

  /** `FlashAtkImgEffect(x, y, effect, mute)`: `mute` skips the hit sound. */
  constructor(x: number, y: number, effect: AttackEffect, mute: boolean);
  /** `FlashAtkImgEffect(x, y, effect)`: not muted. */
  constructor(x: number, y: number, effect: AttackEffect);
  constructor(x: number, y: number, effect: AttackEffect, mute = false) {
    super();
    this.duration = DURATION;
    this.startingDuration = DURATION;
    this.effect = effect;
    this.img = this.loadImage();
    if (this.img != null) {
      this.x = x - this.img.packedWidth / 2;
      y -= this.img.packedHeight / 2;
    }
    this.color = Color.WHITE.cpy();
    this.scale = Settings.scale;
    if (!mute) {
      this.playSound(effect);
    }
    this.y = y;
    switch (effect) {
      case "SHIELD":
        this.y = y + 80 * Settings.scale;
        this.sY = this.y;
        this.tY = y;
        break;
      default:
        this.y = y;
        this.sY = y;
        this.tY = y;
    }
  }

  private loadImage(): AtlasRegion | null {
    switch (this.effect) {
      case "SLASH_DIAGONAL":
        return ImageMaster.ATK_SLASH_D;
      case "SLASH_HEAVY":
        return ImageMaster.ATK_SLASH_HEAVY;
      case "SLASH_HORIZONTAL":
        return ImageMaster.ATK_SLASH_H;
      case "SLASH_VERTICAL":
        return ImageMaster.ATK_SLASH_V;
      case "BLUNT_LIGHT":
        return ImageMaster.ATK_BLUNT_LIGHT;
      case "BLUNT_HEAVY":
        this.rotation = MathUtils.random(360);
        return ImageMaster.ATK_BLUNT_HEAVY;
      case "FIRE":
        return ImageMaster.ATK_FIRE;
      case "POISON":
        return ImageMaster.ATK_POISON;
      case "SHIELD":
        return ImageMaster.ATK_SHIELD;
      case "NONE":
        return null;
      case "SMASH":
      case "LIGHTNING":
      default:
        return ImageMaster.ATK_SLASH_D;
    }
  }

  private playSound(effect: AttackEffect): void {
    switch (effect) {
      case "SLASH_HEAVY":
        CardCrawlGame.sound.play("ATTACK_HEAVY");
        break;
      case "BLUNT_LIGHT":
        CardCrawlGame.sound.play("BLUNT_FAST");
        break;
      case "BLUNT_HEAVY":
        CardCrawlGame.sound.play("BLUNT_HEAVY");
        break;
      case "FIRE":
        CardCrawlGame.sound.play("ATTACK_FIRE");
        break;
      case "POISON":
        CardCrawlGame.sound.play("ATTACK_POISON");
        break;
      case "SHIELD":
        this.playBlockSound();
        break;
      case "NONE":
        break;
      case "SLASH_DIAGONAL":
      case "SLASH_HORIZONTAL":
      case "SLASH_VERTICAL":
      case "SMASH":
      case "LIGHTNING":
      default:
        CardCrawlGame.sound.play("ATTACK_FAST");
    }
  }

  private playBlockSound(): void {
    if (FlashAtkImgEffect.blockSound === 0) {
      CardCrawlGame.sound.play("BLOCK_GAIN_1");
    } else if (FlashAtkImgEffect.blockSound === 1) {
      CardCrawlGame.sound.play("BLOCK_GAIN_2");
    } else {
      CardCrawlGame.sound.play("BLOCK_GAIN_3");
    }
    FlashAtkImgEffect.blockSound += 1;
    if (FlashAtkImgEffect.blockSound > 2) {
      FlashAtkImgEffect.blockSound = 0;
    }
  }

  update(): void {
    switch (this.effect) {
      case "SHIELD":
        this.duration -= Gdx.graphics.getDeltaTime();
        if (this.duration < 0) {
          this.isDone = true;
          this.color.a = 0;
        } else if (this.duration < 0.2) {
          this.color.a = this.duration * 5;
        } else {
          this.color.a = Interpolation.fade.apply(1, 0, (this.duration * 0.75) / DURATION);
        }
        this.y = Interpolation.exp10In.apply(this.tY, this.sY, this.duration / DURATION);
        if (this.duration < 0.4 && !this.triggered) {
          this.triggered = true;
        }
        break;
      default:
        super.update();
    }
  }

  render(sb: SpriteBatch): void {
    if (this.img != null) {
      sb.setColor(this.color);
      sb.draw(
        this.img,
        this.x,
        this.y,
        this.img.packedWidth / 2,
        this.img.packedHeight / 2,
        this.img.packedWidth,
        this.img.packedHeight,
        this.scale,
        this.scale,
        this.rotation,
      );
    }
  }

  dispose(): void {}
}
