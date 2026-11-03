#!/usr/bin/env python3
"""Extract the Vexing Puzzlebox images from the local PCK.

Outputs:
  - public/images/sts2/ui/hands/{character}_{point,paper,rock}.webp  (scenes/ui/hand_image.tscn)
  - public/images/sts2/ui/hands/merchant_point.webp                  (merchant_room/hand arm + sleeve)
  - public/images/sts2/ui/hands/fake_merchant_point.webp             (fake_merchant_room/hand)
  - public/images/sts2/ui/speech_bubble3.webp                        (scenes/merchant/merchant_rug_dialogue.tscn)
  - public/images/sts2/ui/speech_bubble3_purple.webp                 (vfx_speech_bubble.tscn, VfxColor.Purple)
  - public/images/sts2/ui/combat/{end_turn_button,end_turn_button_glow,draw_pile,discard_pile,pile_button_count}.webp
  - public/images/sts2/ui/submenu/{submenu_panel_short,submenu_load,submenu_card_library,submenu_unknown}.webp
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

CHARACTERS = ("ironclad", "silent", "regent", "necrobinder", "defect")
# Rock and paper are the grab poses NHandImage.GrabRelic swaps between.
POSES = ("point", "paper", "rock")
OUTPUT_ROOT = Path("public/images/sts2/ui")
MERCHANT_HAND_PATH = "animations/backgrounds/merchant_room/hand/merchanthand.png"
# Regions from merchanthand.atlas: arm is stored rotated 90 degrees clockwise.
MERCHANT_ARM_BOUNDS = (2, 2, 415, 1175)
MERCHANT_SLEEVE_BOUNDS = (1184, 395, 475, 516)
# Where the sleeve cuff swallows the cut end of the arm, in the upright arm's pixels.
MERCHANT_SLEEVE_TOP = 760
MERCHANT_FADE_START = 1040
FAKE_MERCHANT_HAND_PATH = "animations/backgrounds/fake_merchant_room/hand/fakemerchanthand.png"
# Region from fakemerchanthand.atlas: the hand comes with its own sleeve, stored rotated.
FAKE_MERCHANT_HAND_BOUNDS = (2, 334, 335, 844)
FAKE_MERCHANT_FADE_SHARE = 0.72
COMBAT_UI = ("end_turn_button", "end_turn_button_glow", "draw_pile", "discard_pile", "pile_button_count")
# Main menu submenu buttons (submenu_button_short.tscn) for the beta art mode tabs.
SUBMENU_UI = {
    "submenu_panel_short": "images/packed/common_ui/submenu_panel_short.png",
    "submenu_load": "images/ui/main_menu/submenu_load.png",
    "submenu_card_library": "images/ui/main_menu/submenu_card_library.png",
    "submenu_unknown": "images/ui/main_menu/submenu_unknown.png",
}
# NSpeechBubbleVfx VfxColor.Purple.
PURPLE_HSV = (0.3, 0.6, 0.5)


def read_texture(pck: PCKReader, source_path: str) -> Image.Image:
    import_data = pck.read_file(f"{source_path}.import")
    ctex_path = parse_import_file(import_data)
    if ctex_path is None:
        raise SystemExit(f"No texture in {source_path}.import")
    image = ctex_to_image(pck.read_file(ctex_path))
    if image is None:
        raise SystemExit(f"Could not decode {ctex_path}")
    return image.convert("RGBA")


def save(image: Image.Image, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, "WEBP", quality=90, method=6)
    print(f"{output_path} {image.size}")


def crop(atlas: Image.Image, bounds: tuple[int, int, int, int], rotated: bool) -> Image.Image:
    x, y, width, height = bounds
    if rotated:
        # Spine stores rotated regions turned clockwise, so the stored box is height x width.
        return atlas.crop((x, y, x + height, y + width)).rotate(90, expand=True)
    return atlas.crop((x, y, x + width, y + height))


def merchant_arm(pck: PCKReader) -> Image.Image:
    """Stand the merchant's pointing arm upright in its sleeve, faded like the multiplayer hands."""
    atlas = read_texture(pck, MERCHANT_HAND_PATH)
    arm = crop(atlas, MERCHANT_ARM_BOUNDS, rotated=True)
    sleeve = crop(atlas, MERCHANT_SLEEVE_BOUNDS, rotated=False)
    alpha = arm.getchannel("A")
    # Center the sleeve on the forearm just above the cut.
    row = MERCHANT_SLEEVE_TOP + 200
    columns = [x for x in range(arm.width) if alpha.getpixel((x, row)) > 128]
    forearm_center = (columns[0] + columns[-1]) / 2 if columns else arm.width / 2
    sleeve_left = round(forearm_center - sleeve.width / 2)
    left_pad = max(0, -sleeve_left)
    width = max(arm.width, sleeve_left + sleeve.width) + left_pad
    height = MERCHANT_SLEEVE_TOP + sleeve.height
    canvas = Image.new("RGBA", (width, height))
    canvas.alpha_composite(arm, (left_pad, 0))
    canvas.alpha_composite(sleeve, (sleeve_left + left_pad, MERCHANT_SLEEVE_TOP))
    fade = Image.new("L", canvas.size, 255)
    for y in range(MERCHANT_FADE_START, height):
        share = (y - MERCHANT_FADE_START) / (height - MERCHANT_FADE_START)
        fade.paste(round(255 * (1 - share) ** 1.6), (0, y, width, y + 1))
    canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"), fade))
    return canvas.crop(canvas.getbbox())


def fake_merchant_arm(pck: PCKReader) -> Image.Image:
    """Stand the fake merchant's pointing hand upright, its sleeve faded at the bottom."""
    atlas = read_texture(pck, FAKE_MERCHANT_HAND_PATH)
    arm = crop(atlas, FAKE_MERCHANT_HAND_BOUNDS, rotated=True)
    fade_start = round(arm.height * FAKE_MERCHANT_FADE_SHARE)
    fade = Image.new("L", arm.size, 255)
    for y in range(fade_start, arm.height):
        share = (y - fade_start) / (arm.height - fade_start)
        fade.paste(round(255 * (1 - share) ** 1.6), (0, y, arm.width, y + 1))
    arm.putalpha(ImageChops.multiply(arm.getchannel("A"), fade))
    return arm.crop(arm.getbbox())


def hsv_shift(image: Image.Image, h: float, s: float, v: float) -> Image.Image:
    """shaders/hsv.gdshader: rotate hue and scale chroma in YIQ, then scale value."""
    angle = (1.0 - h) * 2 * math.pi
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    pixels = image.load()
    out = image.copy()
    target = out.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            r, g, b = r / 255, g / 255, b / 255
            yy = 0.2989 * r + 0.5870 * g + 0.1140 * b
            ii = 0.5959 * r - 0.2774 * g - 0.3216 * b
            qq = 0.2115 * r - 0.5229 * g + 0.3114 * b
            # GLSL `col *= m` dots the row vector with each column of m.
            ii, qq = ii * cos_a - qq * sin_a, ii * sin_a + qq * cos_a
            ii, qq = ii * s, qq * s
            yy, ii, qq = yy * v, ii * v, qq * v
            r2 = yy + 0.9563 * ii + 0.6210 * qq
            g2 = yy - 0.2721 * ii - 0.6474 * qq
            b2 = yy - 1.1070 * ii + 1.7046 * qq
            target[x, y] = (
                max(0, min(255, round(r2 * 255))),
                max(0, min(255, round(g2 * 255))),
                max(0, min(255, round(b2 * 255))),
                a,
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", type=Path, default=default_pck_path())
    args = parser.parse_args()

    pck = PCKReader(args.pck)
    for character in CHARACTERS:
        for pose in POSES:
            save(
                read_texture(pck, f"images/ui/hands/multiplayer_hand_{character}_{pose}.png"),
                OUTPUT_ROOT / "hands" / f"{character}_{pose}.webp",
            )
    save(merchant_arm(pck), OUTPUT_ROOT / "hands" / "merchant_point.webp")
    save(fake_merchant_arm(pck), OUTPUT_ROOT / "hands" / "fake_merchant_point.webp")
    for name in COMBAT_UI:
        save(read_texture(pck, f"images/packed/combat_ui/{name}.png"), OUTPUT_ROOT / "combat" / f"{name}.webp")
    for name, source in SUBMENU_UI.items():
        save(read_texture(pck, source), OUTPUT_ROOT / "submenu" / f"{name}.webp")
    bubble = read_texture(pck, "images/packed/vfx/speech_bubble3.png")
    save(bubble, OUTPUT_ROOT / "speech_bubble3.webp")
    save(hsv_shift(bubble, *PURPLE_HSV), OUTPUT_ROOT / "speech_bubble3_purple.webp")


if __name__ == "__main__":
    main()
