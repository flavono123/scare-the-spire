#!/usr/bin/env python3
"""Pack the textures STS1's monster effects draw into one sheet.

The bestiary replays the game's effect classes (see `src/lib/sts1/vfx`). They
draw `ImageMaster` fields, `vfxAtlas.findRegion(...)` regions and a few loose
images; this collects every one the ported classes and monster code reference,
crops atlas regions out of `vfx/vfx.atlas` with their trim offsets, and packs
them with the loose images into a single sheet.

Outputs:
- public/images/sts1/vfx/sheet.<hash>.webp
- data/sts1/vfx-atlas.json: the sheet URL, each region's rect and trim, each
  loose image's rect, and which `ImageMaster` field names which entry

Usage: python3 scripts/extract-sts1-vfx.py [--jar path]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.java_classfile import JavaClass, parse_class_file  # noqa: E402
from scripts.lib.jvm_eval import decode  # noqa: E402
from scripts.lib.sts1_jar import open_sts1_jar  # noqa: E402

OUT_DIR = ROOT / "public/images/sts1/vfx"
MANIFEST = ROOT / "data/sts1/vfx-atlas.json"
VFX_PACKAGE = "com.megacrit.cardcrawl.vfx."
IMAGE_MASTER = "com.megacrit.cardcrawl.helpers.ImageMaster"
SHEET_WIDTH = 2048
PADDING = 2
WEBP_QUALITY = 92

# Effects monster turns create (VFXAction, damage and block flashes) and the
# ones monsters spawn every frame; everything they spawn in turn is followed.
ROOT_EFFECTS = [
    "combat.IntenseZoomEffect", "combat.ShockWaveEffect", "combat.BiteEffect", "combat.LaserBeamEffect",
    "combat.InflameEffect", "BorderFlashEffect", "combat.SmallLaserEffect", "combat.GoldenSlashEffect",
    "combat.SmokeBombEffect", "combat.IntimidateEffect", "CollectorCurseEffect", "combat.HeartMegaDebuffEffect",
    "combat.HeartBuffEffect", "combat.BloodShotEffect", "combat.ViceCrushEffect", "combat.GhostIgniteEffect",
    "combat.FireballEffect", "combat.ScreenOnFireEffect", "combat.WebEffect", "combat.EntangleEffect",
    "combat.WeightyImpactEffect", "combat.CleaveEffect", "combat.FlashAtkImgEffect", "BobEffect",
    "AwakenedEyeParticle", "AwakenedWingParticle", "NemesisFireParticle", "GlowyFireEyesEffect",
    "StaffFireEffect", "TorchHeadFireEffect", "GhostlyFireEffect", "GhostlyWeakFireEffect",
]
# Monster classes that draw or spawn effects themselves every frame.
MONSTER_CLASSES = [
    "exordium.Hexaghost", "exordium.HexaghostBody", "exordium.HexaghostOrb", "city.BronzeOrb",
    "city.TorchHead", "city.TheCollector", "beyond.AwakenedOne", "beyond.Nemesis",
]
# The core image AbstractMonster draws for Hexaghost (`super(..., img)`).
EXTRA_IMAGES = ["images/monsters/theBottom/boss/ghost/core.png"]


def class_path(dotted: str) -> str:
    return dotted.replace(".", "/") + ".class"


def read_class(jar: Any, dotted: str) -> JavaClass:
    return parse_class_file(jar.read(class_path(dotted)))


def news(cls: JavaClass) -> set[str]:
    found: set[str] = set()
    for method in cls.methods:
        if not method.code:
            continue
        for insn in decode(method.code).values():
            if insn.op == 187:
                found.add(cls.class_name(insn.operand))
    return found


def effect_closure(jar: Any) -> list[str]:
    seen: list[str] = []
    queue = [VFX_PACKAGE + name for name in ROOT_EFFECTS]
    while queue:
        name = queue.pop(0)
        if name in seen:
            continue
        seen.append(name)
        for created in sorted(news(read_class(jar, name))):
            if created.startswith(VFX_PACKAGE) and created not in seen:
                queue.append(created)
    return seen


def references(cls: JavaClass) -> tuple[set[str], set[str]]:
    """String constants and ImageMaster fields a class reads."""
    strings: set[str] = set()
    fields: set[str] = set()
    for entry in cls.cp:
        if entry and entry[0] == "string":
            strings.add(cls.utf8(entry[1]))
    for method in cls.methods:
        if not method.code:
            continue
        for insn in decode(method.code).values():
            if insn.op == 178:
                owner, name, _desc = cls.fieldref(insn.operand)
                if owner == IMAGE_MASTER:
                    fields.add(name)
    return strings, fields


def image_master_sources(jar: Any) -> dict[str, dict[str, str]]:
    """ImageMaster.initialize(): which vfxAtlas region or loose image each field holds."""
    cls = read_class(jar, IMAGE_MASTER)
    sources: dict[str, dict[str, str]] = {}
    atlas: str | None = None
    text: str | None = None
    insns = [insn for method in cls.methods if method.code for insn in sorted(decode(method.code).values(), key=lambda i: i.offset)]
    for insn in insns:
        if insn.op == 178:
            owner, name, desc = cls.fieldref(insn.operand)
            if owner == IMAGE_MASTER and desc.endswith("TextureAtlas;"):
                atlas = name
        elif insn.op in {18, 19}:
            value = cls.ldc_value(insn.operand)
            text = value if isinstance(value, str) else None
        elif insn.op in {182, 183, 184}:
            owner, name, _desc = cls.methodref(insn.operand)
            if name == "loadImage" or (name == "<init>" and owner.endswith(".Texture")):
                atlas = "loadImage"
        elif insn.op == 179:
            owner, name, desc = cls.fieldref(insn.operand)
            if owner == IMAGE_MASTER and text:
                if atlas == "vfxAtlas" and desc.endswith("AtlasRegion;"):
                    sources[name] = {"region": text}
                elif atlas == "loadImage" and desc.endswith("Texture;"):
                    sources[name] = {"texture": text}
            atlas = None
            text = None
    return sources


def parse_atlas(text: str) -> tuple[list[str], dict[str, dict[str, Any]]]:
    pages: list[str] = []
    regions: dict[str, dict[str, Any]] = {}
    page: str | None = None
    current: dict[str, Any] | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            page = None
            current = None
            continue
        if page is None:
            page = line.strip()
            pages.append(page)
            continue
        if ":" in line and (line.startswith(" ") or line.startswith("\t") or current is None):
            key, value = (part.strip() for part in line.split(":", 1))
            if current is None:
                continue  # page header fields
            current[key] = value
            continue
        name = line.strip()
        current = {"page": page}
        if name not in regions:
            regions[name] = current
    return pages, regions


def pair(value: str) -> tuple[int, int]:
    first, second = (int(part.strip()) for part in value.split(","))
    return first, second


def pack(items: list[tuple[str, Image.Image]]) -> tuple[Image.Image, dict[str, tuple[int, int]]]:
    ordered = sorted(items, key=lambda item: (-item[1].height, -item[1].width, item[0]))
    places: dict[str, tuple[int, int]] = {}
    x = y = shelf = 0
    for key, image in ordered:
        if x + image.width + PADDING > SHEET_WIDTH:
            x = 0
            y += shelf + PADDING
            shelf = 0
        places[key] = (x, y)
        x += image.width + PADDING
        shelf = max(shelf, image.height)
    height = y + shelf
    sheet = Image.new("RGBA", (SHEET_WIDTH, height), (0, 0, 0, 0))
    for key, image in items:
        sheet.paste(image, places[key])
    return sheet, places


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar")
    args = parser.parse_args()
    jar = open_sts1_jar(args.jar)

    classes = effect_closure(jar) + ["com.megacrit.cardcrawl.monsters." + name for name in MONSTER_CLASSES]
    strings: set[str] = set(EXTRA_IMAGES)
    fields: set[str] = set()
    for name in classes:
        found_strings, found_fields = references(read_class(jar, name))
        strings |= found_strings
        fields |= found_fields

    sources = image_master_sources(jar)
    pages, atlas_regions = parse_atlas(jar.read("vfx/vfx.atlas").decode("utf-8"))
    page_images = {page: Image.open(io.BytesIO(jar.read(f"vfx/{page}"))).convert("RGBA") for page in pages}

    wanted_regions = {name for name in strings if name in atlas_regions}
    wanted_textures = {name for name in strings if name.startswith("images/") and name.endswith(".png")}
    image_master: dict[str, dict[str, str]] = {}
    for field in sorted(fields):
        source = sources.get(field)
        if not source:
            continue
        image_master[field] = source
        if "region" in source:
            wanted_regions.add(source["region"])
        else:
            wanted_textures.add(source["texture"])
    names = set(jar.namelist())
    missing = sorted(path for path in wanted_textures if path not in names)
    wanted_textures -= set(missing)

    items: list[tuple[str, Image.Image]] = []
    region_meta: dict[str, dict[str, int]] = {}
    for name in sorted(wanted_regions):
        entry = atlas_regions[name]
        if entry.get("rotate", "false") != "false":
            raise SystemExit(f"rotated atlas region not supported: {name}")
        x, y = pair(entry["xy"])
        width, height = pair(entry["size"])
        orig_w, orig_h = pair(entry["orig"])
        offset_x, offset_y = pair(entry["offset"])
        items.append((f"r:{name}", page_images[entry["page"]].crop((x, y, x + width, y + height))))
        region_meta[name] = {"offsetX": offset_x, "offsetY": offset_y, "origW": orig_w, "origH": orig_h}
    for path in sorted(wanted_textures):
        items.append((f"t:{path}", Image.open(io.BytesIO(jar.read(path))).convert("RGBA")))

    sheet, places = pack(items)
    buffer = io.BytesIO()
    sheet.save(buffer, "WEBP", quality=WEBP_QUALITY, alpha_quality=100, method=6)
    digest = hashlib.sha256(buffer.getvalue()).hexdigest()[:10]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("sheet.*.webp"):
        old.unlink()
    filename = f"sheet.{digest}.webp"
    (OUT_DIR / filename).write_bytes(buffer.getvalue())

    sizes = dict(items)
    manifest = {
        "sheet": f"/images/sts1/vfx/{filename}",
        "width": sheet.width,
        "height": sheet.height,
        "regions": {
            name: {"x": places[f"r:{name}"][0], "y": places[f"r:{name}"][1],
                   "w": sizes[f"r:{name}"].width, "h": sizes[f"r:{name}"].height, **region_meta[name]}
            for name in sorted(wanted_regions)
        },
        "textures": {
            path: {"x": places[f"t:{path}"][0], "y": places[f"t:{path}"][1],
                   "w": sizes[f"t:{path}"].width, "h": sizes[f"t:{path}"].height}
            for path in sorted(wanted_textures)
        },
        "imageMaster": image_master,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(classes)} classes, {len(wanted_regions)} regions, {len(wanted_textures)} images "
          f"-> {filename} {sheet.width}x{sheet.height} {len(buffer.getvalue()) // 1024} KB")
    if missing:
        print("not in the jar:", ", ".join(missing))
    unmapped = sorted(field for field in fields if field not in image_master)
    if unmapped:
        print("ImageMaster fields without a vfxAtlas/loadImage source:", ", ".join(unmapped))


if __name__ == "__main__":
    main()
