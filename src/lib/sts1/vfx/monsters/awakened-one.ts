import type { SpriteBatch } from "../batch";
import { AwakenedEyeParticle } from "../effects/awakened-eye-particle";
import { AwakenedWingParticle } from "../effects/awakened-wing-particle";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { AbstractDungeon, Gdx, type Creature } from "../world";

const FIRE_TIME = 0.1;
const IDLE_1 = "Idle_1";
const IDLE_2 = "Idle_2";

/** Move keys `getMove` picks while `form1` is true. */
const FORM_1_MOVES = new Set(["SLASH", "SOUL_STRIKE"]);
/** Move keys `getMove` picks once `form1` is false. */
const FORM_2_MOVES = new Set(["DARK_ECHO", "SLUDGE", "TACKLE"]);
/** Set by `damage` when the first form falls: `form1` is already false, the rebirth is still to come. */
const REBIRTH = "REBIRTH";

/**
 * monsters/beyond/AwakenedOne: once reborn, eye particles and the wing
 * particles it keeps and draws itself around its skeleton.
 */
export class AwakenedOne implements MonsterBehavior {
  private form1 = true;
  private fireTimer = 0;
  private animateParticles = false;
  private wParticles: AwakenedWingParticle[] = [];
  /** The looping clip on track 0, as the class's `setAnimation`/`addAnimation` calls leave it. */
  private idle = IDLE_1;

  onMove(key: string | null): void {
    if (key === null) return;
    if (FORM_1_MOVES.has(key)) {
      if (!this.form1 || this.animateParticles) this.enterForm1();
    } else if (FORM_2_MOVES.has(key)) {
      if (this.form1 || !this.animateParticles) {
        this.form1 = false;
        this.animateParticles = true;
        this.idle = IDLE_2;
      }
    } else if (key === REBIRTH) {
      // `damage` at 0 HP: Hit then Idle_1 (form1 was still true), then form1 = false.
      this.enterForm1();
      this.form1 = false;
    }
  }

  private enterForm1(): void {
    this.form1 = true;
    this.animateParticles = false;
    this.wParticles.length = 0;
    this.idle = IDLE_1;
  }

  idleAnimation(): string | null {
    return this.idle === IDLE_1 ? null : this.idle;
  }

  changeState(key: string): void {
    switch (key) {
      case "REBIRTH":
        this.idle = IDLE_2;
        this.animateParticles = true;
        break;
      case "ATTACK_1":
        this.idle = IDLE_1;
        break;
      case "ATTACK_2":
        this.idle = IDLE_2;
        break;
    }
  }

  update(monster: Creature): void {
    if (this.animateParticles) {
      this.fireTimer -= Gdx.graphics.getDeltaTime();
      if (this.fireTimer < 0) {
        this.fireTimer = FIRE_TIME;
        const skeleton = monster.skeleton;
        const eye = skeleton?.findBone("Eye");
        if (skeleton && eye) {
          AbstractDungeon.effectList.push(
            new AwakenedEyeParticle(skeleton.getX() + eye.getWorldX(), skeleton.getY() + eye.getWorldY()),
          );
          this.wParticles.push(new AwakenedWingParticle());
        }
      }
    }
    for (let index = 0; index < this.wParticles.length; index += 1) {
      const particle = this.wParticles[index];
      particle.update();
      if (particle.isDone) {
        this.wParticles.splice(index, 1);
        index -= 1;
      }
    }
  }

  renderBehind(sb: SpriteBatch, monster: Creature): void {
    this.renderWings(sb, monster, true);
  }

  renderFront(sb: SpriteBatch, monster: Creature): void {
    this.renderWings(sb, monster, false);
  }

  private renderWings(sb: SpriteBatch, monster: Creature, behind: boolean): void {
    const skeleton = monster.skeleton;
    const back = skeleton?.findBone("Hips");
    if (!skeleton || !back) return;
    for (const particle of this.wParticles) {
      if (particle.renderBehind === behind) {
        particle.render(sb, skeleton.getX() + back.getWorldX(), skeleton.getY() + back.getWorldY());
      }
    }
  }
}

export const createAwakenedOne: MonsterBehaviorFactory = () => new AwakenedOne();
