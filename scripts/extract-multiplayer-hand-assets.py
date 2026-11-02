#!/usr/bin/env python3
"""Extract the pointing multiplayer hands and the merchant speech bubble from the local PCK.

Outputs:
  - public/images/sts2/ui/hands/{character}_point.webp   (scenes/ui/hand_image.tscn)
  - public/images/sts2/ui/speech_bubble3.webp            (scenes/merchant/merchant_rug_dialogue.tscn)
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

CHARACTERS = ("ironclad", "silent", "regent", "necrobinder", "defect")
OUTPUT_ROOT = Path("public/images/sts2/ui")


def read_texture(pck: PCKReader, source_path: str) -> Image.Image:
    import_data = pck.read_file(f"{source_path}.import")
    ctex_path = parse_import_file(import_data)
    if ctex_path is None:
        raise SystemExit(f"No texture in {source_path}.import")
    image = ctex_to_image(pck.read_file(ctex_path))
    if image is None:
        raise SystemExit(f"Could not decode {ctex_path}")
    return image


def save_texture(pck: PCKReader, source_path: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image = read_texture(pck, source_path).convert("RGBA")
    image.save(output_path, "WEBP", quality=90, method=6)
    print(f"{output_path} {image.size}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", type=Path, default=default_pck_path())
    args = parser.parse_args()

    pck = PCKReader(args.pck)
    for character in CHARACTERS:
        save_texture(
            pck,
            f"images/ui/hands/multiplayer_hand_{character}_point.png",
            OUTPUT_ROOT / "hands" / f"{character}_point.webp",
        )
    save_texture(pck, "images/packed/vfx/speech_bubble3.png", OUTPUT_ROOT / "speech_bubble3.webp")


if __name__ == "__main__":
    main()
