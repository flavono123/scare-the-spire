#!/usr/bin/env python3
"""Extract STS2 mini "TinyCard" sprite parts from the local PCK.

The end-stats and run-history screens render each card as a tiny composite
icon (`scenes/cards/tiny_card.tscn`) made of dedicated sprites in
`images/packed/run_history/`:

    - card_back.png            — outer card silhouette
    - desc_box.png             — description-area overlay
    - banner.png               — title ribbon
    - banner_shadow.png        — banner drop-shadow companion
    - attack_portrait.png      — type-specific "art window" replacement
    - attack_portrait_shadow.png
    - skill_portrait.png
    - skill_portrait_shadow.png
    - power_portrait.png
    - power_portrait_shadow.png

The scene tints these via `modulate` (character HSV on CardBack, rarity
HSV on Banner) — we replicate the same layering on the React side using
CSS `filter: hue-rotate/saturate/brightness`.

Outputs to `public/images/sts2/tiny-card/<name>.png`.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


ASSET_NAMES = (
    "card_back",
    "desc_box",
    "banner",
    "banner_shadow",
    "attack_portrait",
    "attack_portrait_shadow",
    "skill_portrait",
    "skill_portrait_shadow",
    "power_portrait",
    "power_portrait_shadow",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/tiny-card",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0
    missing = 0

    with PCKReader(args.pck) as reader:
        for name in ASSET_NAMES:
            import_path = f"images/packed/run_history/{name}.png.import"
            if import_path not in reader.entries:
                print(f"missing in PCK: {import_path}")
                missing += 1
                continue
            output_path = output_root / f"{name}.png"
            if output_path.exists() and not args.force:
                skipped += 1
                continue
            try:
                ctex_path = parse_import_file(reader.read_file(import_path))
                if not ctex_path:
                    raise ValueError("could not resolve .ctex path")
                image = ctex_to_image(reader.read_file(ctex_path))
                if image is None:
                    raise ValueError("decode failed")
            except Exception as exc:
                print(f"skip {import_path}: {exc}")
                skipped += 1
                continue

            if args.dry_run:
                print(f"would write {output_path}")
                extracted += 1
                continue

            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path)
            extracted += 1
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")

    print(f"done: {extracted} extracted, {skipped} skipped, {missing} missing")
    print(f"output: {output_root}")


if __name__ == "__main__":
    main()
