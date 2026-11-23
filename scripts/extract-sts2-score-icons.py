#!/usr/bin/env python3
"""Extract the STS2 game-over score line icons (NGameOverScreen.AnimateScoreLines) from the local PCK.

Outputs:
  public/images/sts2/ui/game_over_screen/score_{floor,gold,elite,boss,dread,ascension}.webp

Run from the repo root: PYTHONPATH=. python3 scripts/extract-sts2-score-icons.py [--force]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

NAMES = ["score_floor", "score_gold", "score_elite", "score_boss", "score_dread", "score_ascension"]
OUT = Path("public/images/sts2/ui/game_over_screen")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    with PCKReader(args.pck) as reader:
        for name in NAMES:
            path = OUT / f"{name}.webp"
            if path.exists() and not args.force:
                print(f"skip {path}")
                continue
            import_path = f"images/ui/game_over_screen/{name}.png.import"
            ctex_path = parse_import_file(reader.read_file(import_path))
            image = ctex_to_image(reader.read_file(ctex_path)) if ctex_path else None
            if image is None:
                raise ValueError(f"Could not decode {import_path}")
            path.parent.mkdir(parents=True, exist_ok=True)
            image.convert("RGBA").save(path, format="WEBP", quality=90, method=6)
            print(f"wrote {path} ({image.size[0]}x{image.size[1]})")


if __name__ == "__main__":
    main()
