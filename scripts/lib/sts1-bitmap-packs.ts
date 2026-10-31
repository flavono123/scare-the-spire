// Node-only: register every STS1 glyph pack so specs can measure any locale.
// Pages register one pack each through Sts1BitmapPackScope instead.
import jpn from "../../src/lib/sts1/bitmap-fonts/jpn.json";
import kor from "../../src/lib/sts1/bitmap-fonts/kor.json";
import latin from "../../src/lib/sts1/bitmap-fonts/latin.json";
import rus from "../../src/lib/sts1/bitmap-fonts/rus.json";
import tha from "../../src/lib/sts1/bitmap-fonts/tha.json";
import zhs from "../../src/lib/sts1/bitmap-fonts/zhs.json";
import { registerSts1BitmapPack, type Sts1BitmapPack } from "../../src/lib/sts1/bitmap-font";

export function registerAllSts1BitmapPacks() {
  registerSts1BitmapPack("kor", kor as Sts1BitmapPack);
  registerSts1BitmapPack("latin", latin as Sts1BitmapPack);
  registerSts1BitmapPack("jpn", jpn as Sts1BitmapPack);
  registerSts1BitmapPack("zhs", zhs as Sts1BitmapPack);
  registerSts1BitmapPack("rus", rus as Sts1BitmapPack);
  registerSts1BitmapPack("tha", tha as Sts1BitmapPack);
}
