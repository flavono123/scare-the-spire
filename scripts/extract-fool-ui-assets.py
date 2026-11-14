#!/usr/bin/env python3
"""Extract the Fool's combat UI images: the melody symbols (Wah, Cho, Ki), their glow and the arrow UI.

Source (game package): images/packed/fool/{symbol_wah,symbol_cho,symbol_ki,fool_symbol_glow,arrow,arrow_stroke}.png
Output: public/images/sts2/combat-ui/fool/<name>.webp and data/sts2/fool-ui-assets.json (sizes, URLs and
the glow tint per symbol from NFoolCombatSymbol.SetVisualsAndHoverTip, Godot "RRGGBBAA").

    python3 scripts/extract-fool-ui-assets.py [--archive-version 0.113.0]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader  # noqa: E402

NAMES = ["symbol_wah", "symbol_cho", "symbol_ki", "fool_symbol_glow", "arrow", "arrow_stroke"]
# NFoolCombatSymbol.SetVisualsAndHoverTip (0.113.0): CardTag.Wah / Cho / Ki
GLOW = {"symbol_wah": "FF009980", "symbol_cho": "0048FFC0", "symbol_ki": "FF770080"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-version", default="0.113.0")
    parser.add_argument("--builds-dir", default=os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds"))
    args = parser.parse_args()
    pck = os.path.join(args.builds_dir, args.archive_version, "SlayTheSpire2.app", "Contents", "Resources", "Slay the Spire 2.pck")
    reader = PCKReader(pck)
    out_dir = os.path.join(ROOT, "public", "images", "sts2", "combat-ui", "fool")
    os.makedirs(out_dir, exist_ok=True)
    assets: dict[str, dict] = {}
    for name in NAMES:
        source = f"images/packed/fool/{name}.png"
        image = ctex_to_image(reader.read_file(parse_import_file(reader.read_file(f"{source}.import")))).convert("RGBA")
        image.save(os.path.join(out_dir, f"{name}.webp"), "WEBP", lossless=True, method=6)
        assets[name] = {"url": f"/images/sts2/combat-ui/fool/{name}.webp", "width": image.width, "height": image.height, **({"glow": GLOW[name]} if name in GLOW else {})}
        print(f"{name}: {image.width}x{image.height}")
    with open(os.path.join(ROOT, "data", "sts2", "fool-ui-assets.json"), "w", encoding="utf8") as handle:
        json.dump({"archiveVersion": args.archive_version, "assets": assets}, handle, indent=1)
        handle.write("\n")


if __name__ == "__main__":
    main()
