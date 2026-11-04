import type { Texture } from "../assets";
import { loadImage } from "../assets";
import type { SpriteBatch } from "../batch";
import { Color } from "../gdx";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { CardCrawlGame, Settings, type Creature } from "../world";
import { HexaghostBody } from "./hexaghost-body";
import { HexaghostOrb } from "./hexaghost-orb";

const IMAGE = "images/monsters/theBottom/boss/ghost/core.png";
const ACTIVATE_STATE = "Activate";
const ACTIVATE_ORB = "Activate Orb";
const DEACTIVATE_ALL_ORBS = "Deactivate";

/**
 * monsters/exordium/Hexaghost: no skeleton, so it draws its body (plasma
 * rings, then the core image) and keeps six orbs that light up by state.
 */
export class Hexaghost implements MonsterBehavior {
  private orbs: HexaghostOrb[] = [];
  private orbActiveCount = 0;
  private body: HexaghostBody;
  private img: Texture;

  constructor(monster: Creature) {
    this.img = loadImage(IMAGE);
    this.body = new HexaghostBody(monster);
    this.createOrbs();
  }

  private createOrbs(): void {
    this.orbs.push(new HexaghostOrb(-90, 380, this.orbs.length));
    this.orbs.push(new HexaghostOrb(90, 380, this.orbs.length));
    this.orbs.push(new HexaghostOrb(160, 250, this.orbs.length));
    this.orbs.push(new HexaghostOrb(90, 120, this.orbs.length));
    this.orbs.push(new HexaghostOrb(-90, 120, this.orbs.length));
    this.orbs.push(new HexaghostOrb(-160, 250, this.orbs.length));
  }

  changeState(key: string): void {
    switch (key) {
      case ACTIVATE_STATE:
        for (const orb of this.orbs) {
          orb.activate();
        }
        this.orbActiveCount = 6;
        this.body.targetRotationSpeed = 120;
        break;
      case ACTIVATE_ORB:
        for (const orb of this.orbs) {
          if (!orb.activated) {
            orb.activate();
            break;
          }
        }
        this.orbActiveCount += 1;
        // At 6 the game sets the Inferno intent here.
        break;
      case DEACTIVATE_ALL_ORBS:
        for (const orb of this.orbs) {
          orb.deactivate();
        }
        CardCrawlGame.sound.play("CARD_EXHAUST", 0.2);
        CardCrawlGame.sound.play("CARD_EXHAUST", 0.2);
        this.orbActiveCount = 0;
        break;
    }
  }

  update(monster: Creature): void {
    this.body.update();
    for (const orb of this.orbs) {
      orb.update(monster.drawX + monster.animX, monster.drawY + monster.animY);
    }
  }

  /** `render`: the body, then `AbstractMonster.render`'s still-image branch. */
  renderBody(sb: SpriteBatch, monster: Creature): void {
    this.body.render(sb);
    // `tint.color`: the monster's TintEffect, which stays white on the stage.
    sb.setColor(Color.WHITE);
    // draw(Texture, x, y, width, height, srcX, srcY, srcWidth, srcHeight, flipX, flipY)
    // through the overload with origin 0, scale 1 and rotation 0.
    sb.draw(
      this.img,
      monster.drawX - (this.img.getWidth() * Settings.scale) / 2 + monster.animX,
      monster.drawY + monster.animY,
      0,
      0,
      this.img.getWidth() * Settings.scale,
      this.img.getHeight() * Settings.scale,
      1,
      1,
      0,
      0,
      0,
      this.img.getWidth(),
      this.img.getHeight(),
      monster.flipHorizontal,
      false,
    );
  }

  dispose(): void {
    this.body.dispose();
  }
}

export const createHexaghost: MonsterBehaviorFactory = (monster) => new Hexaghost(monster);
