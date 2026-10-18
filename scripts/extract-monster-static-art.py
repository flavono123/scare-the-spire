#!/usr/bin/env python3
"""Extract the still monster art that older builds drew instead of a Spine skeleton.

Source: the archived 0.104.0 build (see AGENTS.md "STS2 구 빌드 아카이브"); the
images are identical in every build from 0.98.0 to 0.104.0.
Output: public/images/sts2/monsters-beta/ (used by src/lib/monster-static-art.ts).

Usage: python3 scripts/extract-monster-static-art.py [--build 0.104.0] [--force]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public/images/sts2/monsters-beta"
BUILDS = Path(os.environ.get("STS2_BUILDS_DIR", Path.home() / "sts2-builds"))
PCK = "SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck"
MAX_HEIGHT = 1024

# source png in the PCK -> output file
TARGETS = {
    **{f"images/monsters/beta/door_maker_placeholder_{n}.png": f"doormaker_placeholder_{n}.webp" for n in (1, 2, 3, 4)},
    "images/monsters/skulkling_colomy.png": "skulking_colony_static.webp",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", default="0.104.0")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    reader = PCKReader(str(BUILDS / args.build / PCK))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for source, name in TARGETS.items():
        out = OUT_DIR / name
        if out.exists() and not args.force:
            print("skip", name)
            continue
        ctex = parse_import_file(reader.read_file(source + ".import"))
        image = ctex_to_image(reader.read_file(ctex)).convert("RGBA")
        if image.height > MAX_HEIGHT:
            image = image.resize((round(image.width * MAX_HEIGHT / image.height), MAX_HEIGHT), Image.LANCZOS)
        image.save(out, quality=88, method=6)
        print("wrote", name, image.size)
    reader.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
