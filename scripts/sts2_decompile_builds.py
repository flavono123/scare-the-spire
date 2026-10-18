#!/usr/bin/env python3
"""Decompile the sts2.dll of every archived build into <root>/<version>/src.

Layout matches what scripts/parse-monsters.py expects (one folder per namespace,
one .cs per type), so any parser can be pointed at --source <root>/<version>/src.

Usage: python3 scripts/sts2_decompile_builds.py [--force] [version ...]
Needs ilspycmd (dotnet tool). Archive root: STS2_BUILDS_DIR or ~/sts2-builds.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ.get("STS2_BUILDS_DIR", Path.home() / "sts2-builds"))
ILSPY = os.environ.get("ILSPYCMD", str(Path.home() / ".dotnet/tools/ilspycmd"))
DLL = "SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("versions", nargs="*")
    args = ap.parse_args()
    dirs = sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith("_"))
    for d in dirs:
        if args.versions and d.name not in args.versions:
            continue
        dll = d / DLL
        out = d / "src"
        if not dll.exists():
            print("no dll", d.name)
            continue
        if out.exists() and not args.force:
            print("skip", d.name)
            continue
        shutil.rmtree(out, ignore_errors=True)
        p = subprocess.run([ILSPY, "-p", "-o", str(out), str(dll)], capture_output=True, text=True)
        n = sum(1 for _ in out.rglob("*.cs")) if out.exists() else 0
        print("decompiled", d.name, n, "files", "" if p.returncode == 0 else f"(exit {p.returncode})", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
