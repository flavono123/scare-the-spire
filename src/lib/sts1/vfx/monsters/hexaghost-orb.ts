import { BobEffect } from "../effects/bob-effect";
import { GhostIgniteEffect } from "../effects/ghost-ignite-effect";
import { GhostlyFireEffect } from "../effects/ghostly-fire-effect";
import { GhostlyWeakFireEffect } from "../effects/ghostly-weak-fire-effect";
import { Color, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { MathHelper } from "./math-helper";

const PARTICLE_INTERVAL = 0.06;

/**
 * monsters/exordium/HexaghostOrb: one of Hexaghost's six flames. It draws
 * nothing itself; it keeps spawning fire particles at its spot.
 */
export class HexaghostOrb {
  private effect = new BobEffect(2);
  private activateTimer: number;
  activated = false;
  hidden = false;
  playedSfx = false;
  private color: Color;
  private x: number;
  private y: number;
  private particleTimer = 0;

  constructor(x: number, y: number, count: number) {
    this.x = x * Settings.scale + MathUtils.random(-10, 10) * Settings.scale;
    this.y = y * Settings.scale + MathUtils.random(-10, 10) * Settings.scale;
    this.activateTimer = count * 0.3;
    this.color = Color.CHARTREUSE.cpy();
    this.color.a = 0;
    this.hidden = true;
  }

  /** `activate(oX, oY)`: the game passes the monster's position and ignores it. */
  activate(): void {
    this.playedSfx = false;
    this.activated = true;
    this.hidden = false;
  }

  deactivate(): void {
    this.activated = false;
  }

  hide(): void {
    this.hidden = true;
  }

  update(oX: number, oY: number): void {
    if (!this.hidden) {
      if (this.activated) {
        this.activateTimer -= Gdx.graphics.getDeltaTime();
        if (this.activateTimer < 0) {
          if (!this.playedSfx) {
            this.playedSfx = true;
            AbstractDungeon.effectsQueue.push(new GhostIgniteEffect(this.x + oX, this.y + oY));
            if (MathUtils.randomBoolean()) {
              CardCrawlGame.sound.play("GHOST_ORB_IGNITE_1", 0.3);
            } else {
              CardCrawlGame.sound.play("GHOST_ORB_IGNITE_2", 0.3);
            }
          }
          this.color.a = MathHelper.fadeLerpSnap(this.color.a, 1);
          this.effect.update();
          this.effect.update();
          this.particleTimer -= Gdx.graphics.getDeltaTime();
          if (this.particleTimer < 0) {
            AbstractDungeon.effectList.push(
              new GhostlyFireEffect(this.x + oX + this.effect.y * 2, this.y + oY + this.effect.y * 2),
            );
            this.particleTimer = PARTICLE_INTERVAL;
          }
        }
      } else {
        this.effect.update();
        this.particleTimer -= Gdx.graphics.getDeltaTime();
        if (this.particleTimer < 0) {
          AbstractDungeon.effectList.push(
            new GhostlyWeakFireEffect(this.x + oX + this.effect.y * 2, this.y + oY + this.effect.y * 2),
          );
          this.particleTimer = PARTICLE_INTERVAL;
        }
      }
    } else {
      this.color.a = MathHelper.fadeLerpSnap(this.color.a, 0);
    }
  }
}
