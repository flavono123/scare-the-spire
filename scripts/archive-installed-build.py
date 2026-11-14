#!/usr/bin/env python3
"""Archive the installed Slay the Spire 2 build into ~/sts2-builds/<version>/ on patch day.

One command does what the archive needs (AGENTS.md, "STS2 구 빌드 아카이브"):
  1. copy the installed app into <root>/<version>/SlayTheSpire2.app, leaving out `Contents/MacOS/mods`
     (the installed app carries the user's mod packages there; the game's own package is
     `Contents/Resources/Slay the Spire 2.pck`, which is what every reader opens),
  2. decompile sts2.dll into <root>/<version>/src            (scripts/sts2_decompile_builds.py, needs ilspycmd),
  3. extract <root>/<version>/canonical/{cards,relics,potions,powers,monsters}.json and canonical/loc/**
                                                              (scripts/sts2_canonical_extract.py).
Without this, the combat simulator's `version=<new>` has no canonical TargetType, move intents or power text to read.

    python3 scripts/archive-installed-build.py [--version 0.113.0] [--force]

`--version` defaults to the installed build's own `release_info.json` and must match it. Steps already done are
skipped unless `--force`. The archive lives outside the repo (STS2_BUILDS_DIR overrides ~/sts2-builds).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds")
INSTALLED = os.path.expanduser("~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app")


def run(*command: str) -> None:
    print("+", " ".join(command))
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", help="expected version, e.g. 0.113.0 (default: the installed build's)")
    parser.add_argument("--installed", default=INSTALLED, help="installed SlayTheSpire2.app")
    parser.add_argument("--force", action="store_true", help="redo every step")
    args = parser.parse_args()

    info_path = os.path.join(args.installed, "Contents", "Resources", "release_info.json")
    if not os.path.exists(info_path):
        sys.exit(f"no installed build at {args.installed}")
    installed_version = json.load(open(info_path, encoding="utf8"))["version"].lstrip("v")
    if args.version and args.version.lstrip("v") != installed_version:
        sys.exit(f"the installed build is {installed_version}, not {args.version}: update Steam first, or archive it from its depot")
    version = installed_version
    dest = os.path.join(ROOT, version)
    app = os.path.join(dest, "SlayTheSpire2.app")

    if args.force or not os.path.exists(os.path.join(app, "Contents", "Resources", "Slay the Spire 2.pck")):
        os.makedirs(dest, exist_ok=True)
        run("rsync", "-a", "--delete", "--exclude", "Contents/MacOS/mods", args.installed + "/", app + "/")
    else:
        print(f"app: already archived at {app}")

    flags = ["--force"] if args.force else []
    run(sys.executable, os.path.join(HERE, "sts2_decompile_builds.py"), *flags, version)
    run(sys.executable, os.path.join(HERE, "sts2_canonical_extract.py"), *flags, version)

    missing = [
        path for path in (
            os.path.join(app, "Contents", "Resources", "Slay the Spire 2.pck"),
            os.path.join(dest, "src"),
            os.path.join(dest, "canonical", "cards.json"),
            os.path.join(dest, "canonical", "loc", "kor"),
        ) if not os.path.exists(path)
    ]
    if missing:
        sys.exit("archive incomplete, missing:\n  " + "\n  ".join(missing))
    print(f"archived {version}: {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
