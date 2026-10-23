#!/usr/bin/env python3
"""Bake the STS2 ancient-card overlays that the card scene composites at runtime.

scenes/cards/card.tscn draws, over the masked AncientPortrait:

  AncientBorderGlassOverlay  ui_card_mask.png with debug_ancient_card_border_overlay
                             (screen + 0.15, mixed toward white by mask.g * 0.2,
                             alpha and color scaled by ui_card_mask.a * border_main.a)
  AncientBorder              ancient_card_border, modulate (1, .978, .906, .502),
                             CanvasItemMaterial blend_mode ADD

Both depend only on textures, so they reduce to fixed maps:

  glass:  out = dst * P + Q      → a black layer with alpha 1 - P, then a white
                                   plus-lighter layer with alpha Q
  border: out = dst + tex * mod  → a plus-lighter layer with the tint and alpha baked

Outputs to public/images/game-assets/card-misc/:
  ancient_glass_shade.png, ancient_glass_light.png, ancient_card_border_add.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from scripts.lib.ctex import ctex_to_image
from scripts.lib.pck import PCKReader, default_pck_path

UI_CARD_MASK = ".godot/imported/ui_card_mask.png-cf81bd19e2a1e322db0041368602a584.ctex"
BORDER_MAIN = ".godot/imported/ui_card_ancient_border_main.png-e63ec77a59f27f557069148d287ce936.bptc.ctex"
# ShaderMaterial_ot5sw in card.tscn
ADD_AMOUNT = 0.15
CORNER_WEIGHT = 0.2
# AncientBorder.modulate in card.tscn
BORDER_MODULATE = (1.0, 0.9776916, 0.9058309, 0.502)


def bake_glass(mask_image, border_image):
    from PIL import Image

    size = mask_image.size
    main_alpha = mask_image.convert("RGBA").split()[3]
    border = border_image.convert("RGBA").resize(size, Image.BILINEAR)
    _, border_green, _, border_alpha = border.split()
    shade = Image.new("L", size)
    light = Image.new("L", size)
    main_px, green_px, alpha_px = main_alpha.load(), border_green.load(), border_alpha.load()
    shade_px, light_px = shade.load(), light.load()
    for y in range(size[1]):
        for x in range(size[0]):
            mask_a = alpha_px[x, y] / 255
            k = green_px[x, y] / 255 * CORNER_WEIGHT
            m = main_px[x, y] / 255 * mask_a
            # COLOR = mix(screen + add, white, k) * m, alpha = mix(mask.a, 1, k) * m; blend_mix.
            alpha = (mask_a * (1 - k) + k) * m
            p = 1 - alpha + alpha * m * (1 - k)
            q = alpha * m * (ADD_AMOUNT * (1 - k) + k)
            shade_px[x, y] = round((1 - p) * 255)
            light_px[x, y] = round(min(1.0, q) * 255)
    black = Image.new("RGBA", size, (0, 0, 0, 0))
    black.putalpha(shade)
    white = Image.new("RGBA", size, (255, 255, 255, 0))
    white.putalpha(light)
    return black, white


def bake_border(border_image):
    from PIL import Image

    red, green, blue, alpha = border_image.convert("RGBA").split()
    r, g, b, a = BORDER_MODULATE
    return Image.merge(
        "RGBA",
        (
            red.point(lambda v: round(v * r)),
            green.point(lambda v: round(v * g)),
            blue.point(lambda v: round(v * b)),
            alpha.point(lambda v: round(v * a)),
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--output", default="public/images/game-assets/card-misc")
    args = parser.parse_args()

    from PIL import Image

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    reader = PCKReader(args.pck)
    shade, light = bake_glass(ctex_to_image(reader.read_file(UI_CARD_MASK)), ctex_to_image(reader.read_file(BORDER_MAIN)))
    shade.save(out / "ancient_glass_shade.png", optimize=True)
    light.save(out / "ancient_glass_light.png", optimize=True)
    # ancient_card_border.png is the extracted compressed_atlas region (821×1148, no margin).
    border = Image.open(out / "ancient_card_border.png")
    bake_border(border).save(out / "ancient_card_border_add.png", optimize=True)
    print("wrote ancient_glass_shade.png, ancient_glass_light.png, ancient_card_border_add.png")


if __name__ == "__main__":
    main()
