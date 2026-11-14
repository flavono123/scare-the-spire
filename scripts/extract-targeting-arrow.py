#!/usr/bin/env python3
"""Extract the combat targeting arrow textures (NTargetingArrow: a head and a repeated segment).

    python3 scripts/extract-targeting-arrow.py [--archive-version 0.113.0]

Writes public/images/sts2/combat-ui/targeting_arrow_{head,segment}.webp and
data/sts2/targeting-arrow-assets.json (sizes and URLs the combat simulator draws the arrow from).
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-version", default="0.113.0")
    parser.add_argument("--builds-dir", default=os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds"))
    args = parser.parse_args()
    pck = os.path.join(args.builds_dir, args.archive_version, "SlayTheSpire2.app", "Contents", "Resources", "Slay the Spire 2.pck")
    reader = PCKReader(pck)
    out_dir = os.path.join(ROOT, "public", "images", "sts2", "combat-ui")
    os.makedirs(out_dir, exist_ok=True)
    assets: dict[str, dict] = {}
    for name in ("head", "segment"):
        source = f"images/ui/combat/targeting_arrow_{name}.png"
        target = parse_import_file(reader.read_file(f"{source}.import"))
        image = ctex_to_image(reader.read_file(target)).convert("RGBA")
        image.save(os.path.join(out_dir, f"targeting_arrow_{name}.webp"), "WEBP", lossless=True, method=6)
        assets[name] = {"url": f"/images/sts2/combat-ui/targeting_arrow_{name}.webp", "width": image.width, "height": image.height}
        print(f"{name}: {image.width}x{image.height}")
    payload = {"archiveVersion": args.archive_version, **assets}
    with open(os.path.join(ROOT, "data", "sts2", "targeting-arrow-assets.json"), "w", encoding="utf8") as handle:
        json.dump(payload, handle, indent=1)
        handle.write("\n")


if __name__ == "__main__":
    main()
