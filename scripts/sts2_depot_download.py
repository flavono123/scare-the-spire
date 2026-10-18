#!/usr/bin/env python3
"""Download every archived STS2 macOS build listed in sts2-depot-manifests.json.

The archive lives outside the repo (default ~/sts2-builds, override with
STS2_BUILDS_DIR) so it never reaches the Next/OpenNext build or the deploy.

Each manifest lands in <root>/<version>/ (version from the build's own
release_info.json) with release_info.json, "Slay the Spire 2.pck" and the arm64
sts2.dll. <root>/builds.json records manifest -> version/date/branch/status.

Usage (needs a saved DepotDownloader login, see docs/STS2_DEPOT_MANIFESTS.md):
    STEAM_USER=<account> python3 scripts/sts2_depot_download.py [--dll-only] [--only <manifestId>...]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("STS2_BUILDS_DIR", Path.home() / "sts2-builds"))
DD = Path(os.environ.get("DEPOT_DOWNLOADER", Path.home() / "Downloads/DepotDownloader-macos-arm64/DepotDownloader"))
RES = "SlayTheSpire2.app/Contents/Resources"


def filelist(path: Path, dll_only: bool) -> Path:
    lines = [r"regex:release_info\.json$", r"regex:data_sts2_macos_arm64/sts2\.dll$"]
    if not dll_only:
        lines.append(r"regex:Slay the Spire 2\.pck$")
    path.write_text("\n".join(lines) + "\n")
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dll-only", action="store_true")
    ap.add_argument("--only", nargs="*", default=[])
    args = ap.parse_args()
    user = os.environ.get("STEAM_USER")
    if not user:
        print("Set STEAM_USER to the Steam account name used for DepotDownloader.", file=sys.stderr)
        return 2
    meta = json.loads((HERE / "sts2-depot-manifests.json").read_text())
    ROOT.mkdir(parents=True, exist_ok=True)
    state_path = ROOT / "builds.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    fl = filelist(ROOT / "_filelist.txt", args.dll_only)
    for row in sorted(meta["manifests"], key=lambda r: r["seenUtc"]):
        mid = row["manifestId"]
        if args.only and mid not in args.only:
            continue
        prev = state.get(mid, {})
        want_pck = not args.dll_only
        if prev.get("status") == "ok" and (not want_pck or prev.get("pck")):
            print(f"skip {mid} ({prev['version']})")
            continue
        tmp = ROOT / "_incoming" / mid
        shutil.rmtree(tmp, ignore_errors=True)
        cmd = [str(DD), "-app", str(meta["appId"]), "-depot", str(meta["depotId"]), "-manifest", mid,
               "-beta", row["branch"] if row["branch"] != "troubleshoot" else "troubleshoot",
               "-username", user, "-remember-password", "-filelist", str(fl), "-dir", str(tmp)]
        print("download", mid, row["seenUtc"], row["branch"], flush=True)
        p = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
        info = tmp / RES / "release_info.json"
        if p.returncode != 0 or not info.exists():
            tail = (p.stdout + p.stderr).strip().splitlines()[-3:]
            state[mid] = {**row, "status": "failed", "error": " | ".join(tail)[:300]}
            print("  FAILED", state[mid]["error"], flush=True)
            state_path.write_text(json.dumps(state, indent=2))
            shutil.rmtree(tmp, ignore_errors=True)
            continue
        version = json.loads(info.read_text())["version"].lstrip("v")
        dest = ROOT / version
        if dest.exists() and state.get(mid, {}).get("dir") != version:
            owner = [k for k, v in state.items() if v.get("dir") == version and k != mid]
            if owner:
                dest = ROOT / f"{version}-{mid[:6]}"
        if dest.exists():
            shutil.rmtree(dest)
        shutil.move(str(tmp), str(dest))
        pck = (dest / RES / "Slay the Spire 2.pck").exists()
        state[mid] = {**row, "status": "ok", "version": version, "dir": dest.name, "pck": pck}
        state_path.write_text(json.dumps(state, indent=2))
        print("  ok ->", dest.name, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
