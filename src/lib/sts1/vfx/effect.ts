import type { SpriteBatch } from "./batch";
import { Color } from "./gdx";
import { Gdx, Settings } from "./world";

/** vfx/AbstractGameEffect. */
export abstract class AbstractGameEffect {
  duration = 0;
  startingDuration = 0;
  // Java leaves this null until the subclass sets it.
  color: Color = new Color(1, 1, 1, 1);
  isDone = false;
  scale = Settings.scale;
  rotation = 0;
  renderBehind = false;

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < this.startingDuration / 2) {
      this.color.a = this.duration / (this.startingDuration / 2);
    }
    if (this.duration < 0) {
      this.isDone = true;
      this.color.a = 0;
    }
  }

  abstract render(sb: SpriteBatch): void;

  dispose(): void {}
}
