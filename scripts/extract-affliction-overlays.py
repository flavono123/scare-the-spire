#!/usr/bin/env python3
"""Extract STS2 card affliction overlay textures from the local PCK."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover
    Image = None  # type: ignore
    ImageChops = None  # type: ignore


OUT_ROOT = ROOT / "public/images/sts2/affliction-overlays"

TEXTURES: dict[str, list[str]] = {
    "common": [
        "images/vfx/ui/ui_card_mask.png",
        "images/vfx/ui/card/ui_card_border_vignette.png",
        "images/vfx/ui/card/ui_card_border_glow.png",
        "images/vfx/noise/vfx_noise_1.png",
    ],
    "bound": [
        "images/vfx/ui/card/afflictions/bound/ui_card_bound_main.png",
    ],
    "entangled": [
        "images/vfx/ui/card/afflictions/entangled/ui_card_entangled_main.png",
        "images/vfx/ui/card/afflictions/entangled/ui_card_entangled_leaf.png",
    ],
    "galvanized": [
        "images/vfx/ui/card/afflictions/galvanized/ui_card_galvanized_main.png",
        "images/vfx/ui/card/afflictions/galvanized/ui_card_galvanized_lightning_corner_flipbook.png",
    ],
    "hexed": [
        "images/vfx/ui/card/afflictions/hexed/ui_card_hexed_main.png",
    ],
    "ringing": [
        "images/vfx/ui/card/afflictions/ringing/ui_card_ringing_main.png",
        "images/vfx/ui/card/afflictions/ringing/ui_card_ringing_beast_frame_horns_only.png",
    ],
    "smog": [
        "images/vfx/ui/card/afflictions/smog/ui_card_smog_mask.png",
        "images/vfx/ui/card/afflictions/smog/ui_card_smog_mask_outer.png",
    ],
}


@dataclass(frozen=True)
class Target:
    group: str
    source: str
    output: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output-root", default=str(OUT_ROOT), help="Texture output directory")
    parser.add_argument("--force", action="store_true", help="Rewrite existing output files")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing files")
    return parser.parse_args()


def target_name(source: str) -> str:
    return Path(source).stem.removeprefix("ui_card_").replace("_flipbook", "")


def build_targets(output_root: Path) -> list[Target]:
    targets: list[Target] = []
    for group, sources in TEXTURES.items():
        for source in sources:
            targets.append(Target(group, source, output_root / group / f"{target_name(source)}.webp"))
    return targets


def extract_image(reader: PCKReader, source: str):
    import_path = f"{source}.import"
    if import_path not in reader.entries:
        raise FileNotFoundError(f"missing import: {import_path}")
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        raise FileNotFoundError(f"missing ctex for {source}: {ctex_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"unsupported texture payload: {ctex_path}")
    return image


def channel_alpha(image, color: tuple[int, int, int], mode: str):
    if Image is None or ImageChops is None:
        raise RuntimeError("Pillow is required to build preview textures")

    r, g, b, _a = image.convert("RGBA").split()
    if mode == "rg":
        alpha = ImageChops.lighter(r, g)
        alpha = alpha.point(lambda v: max(0, min(255, int((v - 18) * 2.4))))
    else:
        alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
        alpha = alpha.point(lambda v: max(0, min(190, int((v - 20) * 1.5))))
    base = Image.new("RGBA", image.size, (*color, 0))
    base.putalpha(alpha)
    return base


def write_preview_textures(output_root: Path, dry_run: bool) -> int:
    previews = [
        (
            output_root / "galvanized/galvanized_main.webp",
            output_root / "galvanized/galvanized_main_preview.webp",
            (106, 220, 255),
            "rg",
        ),
        (
            output_root / "ringing/ringing_main.webp",
            output_root / "ringing/ringing_main_preview.webp",
            (185, 246, 255),
            "rgb",
        ),
    ]
    written = 0
    for source, output, color, mode in previews:
        if dry_run:
            print(f"would write {output}")
            continue
        image = Image.open(source).convert("RGBA")
        preview = channel_alpha(image, color, mode)
        preview.save(output, "WEBP", lossless=True)
        written += 1
    return written


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root)
    written = 0

    with PCKReader(args.pck) as reader:
        for target in build_targets(output_root):
            if target.output.exists() and not args.force:
                continue
            if args.dry_run:
                print(f"would write {target.output}")
                continue
            image = extract_image(reader, target.source)
            target.output.parent.mkdir(parents=True, exist_ok=True)
            image.save(target.output, "WEBP", lossless=True)
            written += 1

    written += write_preview_textures(output_root, args.dry_run)
    print(f"affliction overlay textures written={written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
