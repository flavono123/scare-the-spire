#!/usr/bin/env python3
"""List Spine actor prefixes in the STS2 PCK."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from lib.pck import PCKReader, default_pck_path  # noqa: E402


DEFAULT_PREFIXES = [
    "animations/characters/",
    "animations/monsters/",
    "animations/objects/",
    "animations/vfx/",
    "animations/ui/",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="List STS2 Spine actor prefixes.")
    parser.add_argument("--pck", default=default_pck_path(), help="Path to STS2 PCK")
    parser.add_argument("--prefix", action="append", help="PCK path prefix to include. Repeatable")
    parser.add_argument("--all", action="store_true", help="Include non-renderable prefixes")
    args = parser.parse_args()

    prefixes = tuple(args.prefix or DEFAULT_PREFIXES)
    with PCKReader(args.pck) as reader:
      skel_prefixes = sorted(
          path[:-len(".skel.import")]
          for path in reader.entries
          if path.endswith(".skel.import") and path.startswith(prefixes)
      )
      for prefix in skel_prefixes:
          renderable = f"{prefix}.atlas.import" in reader.entries and f"{prefix}.png.import" in reader.entries
          if renderable or args.all:
              print(("OK   " if renderable else "MISS ") + prefix)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
