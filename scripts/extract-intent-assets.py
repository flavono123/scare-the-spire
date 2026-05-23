#!/usr/bin/env python3
"""Extract STS2 combat intent and block token assets from the local PCK."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


@dataclass(frozen=True)
class DirectImageSpec:
    source: str
    output: str


INTENT_IMAGES = [
    DirectImageSpec("images/packed/intents/attack/intent_attack_3.png.import", "intents/attack.png"),
    DirectImageSpec("images/packed/intents/intent_buff.png.import", "intents/buff.png"),
    DirectImageSpec("images/packed/intents/intent_card_debuff.png.import", "intents/card_debuff.png"),
    DirectImageSpec("images/packed/intents/intent_death_blow.png.import", "intents/death_blow.png"),
    DirectImageSpec("images/packed/intents/intent_debuff.png.import", "intents/debuff.png"),
    DirectImageSpec("images/packed/intents/intent_defend.png.import", "intents/defend.png"),
    DirectImageSpec("images/packed/intents/intent_escape.png.import", "intents/escape.png"),
    DirectImageSpec("images/packed/intents/intent_heal.png.import", "intents/heal.png"),
    DirectImageSpec("images/packed/intents/intent_hidden.png.import", "intents/hidden.png"),
    DirectImageSpec("images/packed/intents/intent_sleep.png.import", "intents/sleep.png"),
    DirectImageSpec("images/packed/intents/intent_status_card.png.import", "intents/status_card.png"),
    DirectImageSpec("images/packed/intents/intent_stun.png.import", "intents/stun.png"),
    DirectImageSpec("images/packed/intents/intent_summon.png.import", "intents/summon.png"),
    DirectImageSpec("images/packed/intents/intent_unknown.png.import", "intents/unknown.png"),
    DirectImageSpec("images/ui/combat/block.png.import", "ui/combat/block.png"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output", default="public/images/sts2", help="Output directory root")
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    raw_import = reader.read_file(import_path)
    ctex_path = parse_import_file(raw_import)
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")

    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image


def save_image(image: Image.Image, output_path: Path, *, dry_run: bool, force: bool) -> bool:
    if output_path.exists() and not force:
        return False
    if dry_run:
        print(f"would write {output_path}")
        return True

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    return True


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for spec in INTENT_IMAGES:
            output_path = output_root / spec.output
            try:
                image = open_import_image(reader, spec.source)
            except Exception as exc:
                print(f"skip {spec.source}: {exc}")
                skipped += 1
                continue

            if save_image(image, output_path, dry_run=args.dry_run, force=args.force):
                extracted += 1
                print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")
            else:
                skipped += 1

    print(f"done: {extracted} extracted, {skipped} skipped")
    print(f"output: {output_root}")


if __name__ == "__main__":
    main()
