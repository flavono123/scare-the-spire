import type { Texture } from "../assets";
import { loadImage } from "../assets";
import type { SpriteBatch } from "../batch";
import { BobEffect } from "../effects/bob-effect";
import { Color } from "../gdx";
import { Gdx, Settings, type Creature } from "../world";
import { MathHelper } from "./math-helper";

const IMG_DIR = "images/monsters/theBottom/boss/ghost/";
const W = 512;
const BODY_OFFSET_Y = 256 * Settings.scale;

/** monsters/exordium/HexaghostBody: the plasma rings and shadow behind Hexaghost's core. */
export class HexaghostBody {
  private rotationSpeed = 1;
  targetRotationSpeed = 30;
  private effect = new BobEffect(0.75);
  private m: Creature;
  private plasma1: Texture;
  private plasma2: Texture;
  private plasma3: Texture;
  private shadow: Texture;
  private plasma1Angle = 0;
  private plasma2Angle = 0;
  private plasma3Angle = 0;

  constructor(m: Creature) {
    this.m = m;
    this.plasma1 = loadImage(`${IMG_DIR}plasma1.png`);
    this.plasma2 = loadImage(`${IMG_DIR}plasma2.png`);
    this.plasma3 = loadImage(`${IMG_DIR}plasma3.png`);
    this.shadow = loadImage(`${IMG_DIR}shadow.png`);
  }

  update(): void {
    this.effect.update();
    this.plasma1Angle += this.rotationSpeed * Gdx.graphics.getDeltaTime();
    this.plasma2Angle += (this.rotationSpeed / 2) * Gdx.graphics.getDeltaTime();
    this.plasma3Angle += (this.rotationSpeed / 3) * Gdx.graphics.getDeltaTime();
    this.rotationSpeed = MathHelper.fadeLerpSnap(this.rotationSpeed, this.targetRotationSpeed);
    this.effect.speed = this.rotationSpeed * Gdx.graphics.getDeltaTime();
  }

  render(sb: SpriteBatch): void {
    const m = this.m;
    // `m.tint.color`: the monster's TintEffect, which stays white on the stage.
    sb.setColor(Color.WHITE);
    sb.draw(
      this.plasma3,
      m.drawX - W / 2 + m.animX + 12 * Settings.scale,
      m.drawY + m.animY + this.effect.y * 2 - W / 2 + BODY_OFFSET_Y,
      W / 2,
      W / 2,
      W,
      W,
      Settings.scale * 0.95,
      Settings.scale * 0.95,
      this.plasma3Angle,
      0,
      0,
      W,
      W,
      false,
      false,
    );
    sb.draw(
      this.plasma2,
      m.drawX - W / 2 + m.animX + 6 * Settings.scale,
      m.drawY + m.animY + this.effect.y - W / 2 + BODY_OFFSET_Y,
      W / 2,
      W / 2,
      W,
      W,
      Settings.scale,
      Settings.scale,
      this.plasma2Angle,
      0,
      0,
      W,
      W,
      false,
      false,
    );
    sb.draw(
      this.plasma1,
      m.drawX - W / 2 + m.animX,
      m.drawY + m.animY + this.effect.y * 0.5 - W / 2 + BODY_OFFSET_Y,
      W / 2,
      W / 2,
      W,
      W,
      Settings.scale,
      Settings.scale,
      this.plasma1Angle,
      0,
      0,
      W,
      W,
      false,
      false,
    );
    sb.draw(
      this.shadow,
      m.drawX - W / 2 + m.animX + 12 * Settings.scale,
      m.drawY + m.animY + this.effect.y / 4 - 15 * Settings.scale - W / 2 + BODY_OFFSET_Y,
      W / 2,
      W / 2,
      W,
      W,
      Settings.scale,
      Settings.scale,
      0,
      0,
      0,
      W,
      W,
      false,
      false,
    );
  }

  /** The textures live in the shared sheet; nothing to free. */
  dispose(): void {}
}
