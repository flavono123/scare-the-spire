#!/usr/bin/env python3
"""Render the game's hit VFX scenes into frame sheets for the combat simulator.

The scenes named by `WithHitFx(...)` in the card sources (data/sts2/card-presentation.json) are
opened from the game PCK by MegaDot (Mega Crit's Godot fork) and rendered on a transparent
1920x1080 frame with `--write-movie`; scripts/godot/hit-vfx/main.gd does what the shared C#
players (NVfxParticleSystem, NSpriteAnimator) do, because C# scripts do not load there. The
frames are cropped to the union of what they paint and packed into one WebP sheet per scene:

    python3 scripts/extract-hit-vfx.py [--archive-version 0.113.0] [--scene vfx_attack_slash ...]

Reads   ~/sts2-builds/<version>/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck
Writes  public/images/sts2/vfx/hit/<scene>.webp  and  data/sts2/hit-vfx-assets.json
A MegaDot window opens for about a second per scene while it renders (it does not draw headless).

Scenes whose root script is a dedicated C# class (NHeavyBluntVfx, NStarryImpactVfx, the Spine ones)
are skipped and listed: their sequence has to be ported to GDScript one by one.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from lib.pck import PCKReader  # noqa: E402

GODOT = os.path.expanduser("~/Applications/MegaDot.app/Contents/MacOS/Godot")
PROJECT = os.path.join(ROOT, "scripts", "godot", "hit-vfx")
OUT_DIR = os.path.join(ROOT, "public", "images", "sts2", "vfx", "hit")
OUT_JSON = os.path.join(ROOT, "data", "sts2", "hit-vfx-assets.json")
ORIGIN = (960, 540)
FPS = 30
MAX_SHEET = 8192


def parse_vector(value: str) -> tuple[float, float]:
    numbers = re.findall(r"-?[0-9.]+", value)
    return float(numbers[0]), float(numbers[1])


def describe(scene_text: str) -> dict:
    """What the scene's root script does, from the .tscn (its exported values live there)."""
    ext = {m.group(2): (m.group(1), m.group(3)) for m in re.finditer(r'\[ext_resource type="(\w+)"[^\]]*?path="([^"]+)" id="([^"]+)"\]', scene_text)}
    # ext maps path -> (type, id) above; invert to id -> path.
    by_id = {entry[1]: path for path, entry in ext.items()}
    scripts = re.findall(r'path="res://src/[^"]*/(\w+)\.cs"', scene_text)
    root = scene_text.split("[node ", 2)[1] if "[node " in scene_text else ""
    if "NSpriteAnimator" in scripts:
        frames = re.search(r"_frames = Array\[Texture2D\]\(\[(.*?)\]\)", root, re.S)
        ids = re.findall(r'ExtResource\("([^"]+)"\)', frames.group(1)) if frames else []
        scale = re.search(r"^scale = (Vector2\([^)]*\))", root, re.M)
        rotation = re.search(r"_rotationRange = (Vector2\([^)]*\))", root)
        fps = re.search(r"^_fps = ([0-9.]+)", root, re.M)
        low, high = parse_vector(rotation.group(1)) if rotation and "_randomizeRotation = true" in root else (0.0, 0.0)
        return {
            "kind": "sprite",
            "frames": [by_id[i] for i in ids],
            "fps": float(fps.group(1)) if fps else 15.0,
            "scale": parse_vector(scale.group(1))[0] if scale else 1.0,
            # NSpriteAnimator draws a random whole degree in the range; the sheet bakes the middle.
            "rotation": (low + high) / 2,
        }
    if scripts == ["NVfxParticleSystem"] or set(scripts) <= {"NVfxParticleSystem"}:
        lifetime = re.search(r"^_lifetime = ([0-9.]+)", root, re.M)
        return {"kind": "particles", "lifetime": float(lifetime.group(1)) if lifetime else 1.0}
    return {"kind": "dedicated", "scripts": sorted(set(scripts))}


def hit_scenes(archive_version: str) -> list[str]:
    path = os.path.join(ROOT, "data", "sts2", "card-presentation.json")
    cards = json.load(open(path, encoding="utf8"))["cards"]
    scenes: dict[str, int] = {}
    for card in cards.values():
        for step in card["steps"]:
            scene = step.get("hitFx", {}).get("scene") if step["op"] == "attack" else None
            if scene:
                scenes[scene] = scenes.get(scene, 0) + 1
    return [scene.removeprefix("vfx/") for scene in sorted(scenes, key=lambda s: -scenes[s])]


def render(pck: str, args: list[str], seconds: float) -> list[str]:
    work = tempfile.mkdtemp(prefix="hit-vfx-")
    frames = max(2, math.ceil(seconds * FPS) + 3)
    cmd = [GODOT, "--always-on-top", "--position", "0,0", "--path", PROJECT, "--write-movie", os.path.join(work, "f.png"), "--fixed-fps", str(FPS), "--quit-after", str(frames), "--", f"pck={pck}", *args]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    files = sorted(glob.glob(os.path.join(work, "f*.png")))
    if not files:
        raise RuntimeError(f"MegaDot wrote no frames:\n{result.stdout[-800:]}\n{result.stderr[-800:]}")
    return files


class Frozen(Exception):
    """The render stopped changing while still painting: the scene needs more than the shared player does."""


def pack(scene: str, info: dict, files: list[str]) -> dict:
    images = [Image.open(path).convert("RGBA") for path in files]
    boxes = [image.getchannel("A").point(lambda v: 255 if v > 3 else 0).getbbox() for image in images]
    painted = [i for i, box in enumerate(boxes) if box]
    if not painted:
        raise RuntimeError(f"{scene}: nothing painted")
    last = painted[-1]
    left = min(boxes[i][0] for i in painted)
    top = min(boxes[i][1] for i in painted)
    right = max(boxes[i][2] for i in painted)
    bottom = max(boxes[i][3] for i in painted)
    crops = [images[i].crop((left, top, right, bottom)) for i in range(last + 1)]
    # A frozen tail (rock_shatter, coin_explosion: collision particles that stop updating here) is not the game's look.
    tail = crops[-4:]
    if len(crops) >= 8 and all(frame.tobytes() == tail[0].tobytes() for frame in tail):
        raise Frozen(scene)
    width, height = crops[0].size
    columns = max(1, min(len(crops), MAX_SHEET // width))
    rows = math.ceil(len(crops) / columns)
    if rows * height > MAX_SHEET:
        raise RuntimeError(f"{scene}: sheet {columns * width}x{rows * height} is too large")
    sheet = Image.new("RGBA", (columns * width, rows * height), (0, 0, 0, 0))
    for index, crop in enumerate(crops):
        sheet.paste(crop, ((index % columns) * width, (index // columns) * height))
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(os.path.join(OUT_DIR, f"{scene}.webp"), "WEBP", lossless=True, quality=100, method=6)
    return {
        "scene": f"vfx/{scene}",
        "url": f"/images/sts2/vfx/hit/{scene}.webp",
        "kind": info["kind"],
        "fps": FPS,
        "frames": len(crops),
        "frameWidth": width,
        "frameHeight": height,
        "columns": columns,
        # Where the scene's origin (the target point) sits inside one frame.
        "origin": {"x": ORIGIN[0] - left, "y": ORIGIN[1] - top},
        "durationMs": round(len(crops) * 1000 / FPS),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archive-version", default="0.113.0")
    parser.add_argument("--builds-dir", default=os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds"))
    parser.add_argument("--scene", action="append", help="render only this scene (vfx_attack_slash); default: every WithHitFx scene")
    args = parser.parse_args()

    if not os.path.exists(GODOT):
        sys.exit(f"MegaDot not found at {GODOT}")
    pck = os.path.join(args.builds_dir, args.archive_version, "SlayTheSpire2.app", "Contents", "Resources", "Slay the Spire 2.pck")
    if not os.path.exists(pck):
        sys.exit(f"no game package at {pck}")
    reader = PCKReader(pck)

    existing = json.load(open(OUT_JSON, encoding="utf8")) if os.path.exists(OUT_JSON) else {"scenes": {}}
    skipped: list[str] = []
    for scene in args.scene or hit_scenes(args.archive_version):
        path = f"scenes/vfx/{scene}.tscn"
        if path not in reader.entries:
            skipped.append(f"{scene} (not in the package)")
            continue
        info = describe(reader.read_file(path).decode("utf8"))
        if info["kind"] == "dedicated":
            skipped.append(f"{scene} ({', '.join(info['scripts'])})")
            continue
        if info["kind"] == "sprite":
            args_list = ["kind=sprite", f"frames={','.join(info['frames'])}", f"fps={info['fps']}", f"scale={info['scale']}", f"rotation={info['rotation']}"]
            seconds = len(info["frames"]) / info["fps"]
        else:
            args_list = ["kind=particles", f"scene=res://{path}"]
            seconds = info["lifetime"]
        entry = None
        # A particle render sometimes stops updating partway (it is not the same on every run): try again.
        for attempt in range(1, 4):
            files = render(pck, args_list, seconds)
            try:
                entry = pack(scene, info, files)
                break
            except Frozen:
                print(f"{scene}: render froze (attempt {attempt})")
            finally:
                shutil.rmtree(os.path.dirname(files[0]), ignore_errors=True)
        if entry is None:
            skipped.append(f"{scene} (render froze three times)")
            existing["scenes"].pop(f"vfx/{scene}", None)
            sheet = os.path.join(OUT_DIR, f"{scene}.webp")
            if os.path.exists(sheet):
                os.remove(sheet)
            continue
        existing["scenes"][entry["scene"]] = entry
        print(f"{scene}: {entry['frames']} frames {entry['frameWidth']}x{entry['frameHeight']} ({info['kind']})")

    existing["archiveVersion"] = args.archive_version
    existing["note"] = "Rendered by scripts/extract-hit-vfx.py from the game package (MegaDot); origin is the target point inside a frame."
    with open(OUT_JSON, "w", encoding="utf8") as handle:
        json.dump(existing, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    if skipped:
        print("not rendered (dedicated C# scripts or missing):", "; ".join(skipped))


if __name__ == "__main__":
    main()
