"""Compose one static combat background per STS1 act for the encounter scene.

Each act's scene class (scenes/TheBottomScene, TheCityScene, TheBeyondScene,
TheEndingScene) draws atlas regions from <act>Scene/scene.atlas full-screen at
their atlas offset: `renderCombatRoomBg` before the creatures, `renderCombatRoomFg`
after them. Regions share a 1920x1136 frame drawn from the screen's bottom edge, so
the 1920x1080 screen shows its lower 1080 rows.

`randomizeScene` rolls which optional pieces (walls, pillars, columns, stalactites)
appear in a room; LAYERS below is one roll each act can make, in draw order.
Left out on purpose: animated effects (fog, dust, torches, fireflies, floating
rocks), the random overlay tints (drawn white), City's dark-day glow and Beyond's
second additive pass. City draws TheCollector's throne whenever TheCollector is in
the room, so that encounter gets its own background.

Output (1280x720 webp): public/images/sts1/scenes/<act>.webp and, where the act
draws a foreground, <act>-fg.webp (transparent, drawn over the monsters).

Usage: python3 scripts/extract-sts1-scenes.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.sts1_jar import default_sts1_jar_path, open_sts1_jar  # noqa: E402

OUT = ROOT / "public" / "images" / "sts1" / "scenes"
SIZE = (1280, 720)
SCREEN_HEIGHT = 1080

# (region, "add" for setBlendFunction(GL_SRC_ALPHA, GL_ONE) glows, else normal)
BOTTOM_BG = [("bg", ""), ("mod/mg", ""), ("mod/midWall", ""), ("mod/ceiling", ""),
             ("mod/ceilingMod1", ""), ("mod/ceilingMod3", ""), ("mod/ceilingMod4", "")]
CITY_BG = [("mod/bg1", ""), ("mod/bgGlowv2", "add"), ("mod/floor", ""), ("mod/ceiling", ""),
           ("mod/mg1", ""), ("mod/mg1Glow", "add"), ("mod/p1", ""), ("mod/p5", "")]
BEYOND_BG = [("mod/floor", ""), ("mod/ceiling", ""), ("mod/bg1", ""), ("mod/mod1", ""), ("mod/mod4", ""),
             ("mod/c1", ""), ("mod/c4", ""), ("mod/s2", ""), ("mod/s4", "")]
LAYERS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "exordium": ("bottomScene", BOTTOM_BG),
    "exordium-fg": ("bottomScene", [("mod/fg", "")]),
    "city": ("cityScene", CITY_BG),
    "city-collector": ("cityScene", CITY_BG + [("mod/throne", ""), ("mod/throneGlow", "add")]),
    "city-fg": ("cityScene", [("mod/fg", ""), ("mod/fgGlow", "add")]),
    "beyond": ("beyondScene", BEYOND_BG),
    "beyond-fg": ("beyondScene", [("mod/fg", "")]),
    "ending": ("endingScene", [("bg", "")]),
}


def parse_atlas(text: str) -> dict[str, dict]:
    """libGDX atlas: region name -> page, xy, size, orig, offset."""
    regions: dict[str, dict] = {}
    page = None
    current = None
    for line in text.splitlines():
        if not line.strip():
            page = None
            continue
        if page is None:
            page, current = line.strip(), None
            continue
        if ":" in line and line.startswith(" "):
            key, value = (part.strip() for part in line.split(":", 1))
            if current is not None and key in {"xy", "size", "orig", "offset"}:
                current[key] = tuple(int(v) for v in value.split(","))
            elif current is not None and key == "rotate" and value == "true":
                raise SystemExit(f"rotated region {current['name']} not supported")
        elif ":" not in line:
            current = {"name": line.strip(), "page": page}
            regions[current["name"]] = current
    return regions


def compose(jar, folder: str, layers: list[tuple[str, str]]) -> Image.Image:
    regions = parse_atlas(jar.read(f"{folder}/scene.atlas").decode("utf-8"))
    pages: dict[str, Image.Image] = {}
    frame = regions[layers[0][0]]["orig"]
    canvas = Image.new("RGBA", frame, (0, 0, 0, 0))
    for name, blend in layers:
        region = regions[name]
        if region["page"] not in pages:
            pages[region["page"]] = Image.open(io.BytesIO(jar.read(f"{folder}/{region['page']}"))).convert("RGBA")
        x, y = region["xy"]
        width, height = region["size"]
        piece = pages[region["page"]].crop((x, y, x + width, y + height))
        # renderAtlasRegionIf draws at the region's offset from the screen's bottom-left
        # (frames differ: some are 1920x1080); PIL counts from the top-left.
        left, top = region["offset"][0], frame[1] - region["offset"][1] - height
        layer = Image.new("RGBA", frame, (0, 0, 0, 0))
        layer.paste(piece, (left, top))
        if blend == "add":
            alpha = layer.getchannel("A")
            glow = Image.merge("RGB", [ImageChops.multiply(band, alpha) for band in layer.convert("RGB").split()])
            rgb = ImageChops.add(canvas.convert("RGB"), glow)
            canvas = Image.merge("RGBA", (*rgb.split(), canvas.getchannel("A")))
        else:
            canvas.alpha_composite(layer)
    return canvas.crop((0, frame[1] - SCREEN_HEIGHT, frame[0], frame[1]))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with open_sts1_jar(default_sts1_jar_path()) as jar:
        for name, (folder, layers) in LAYERS.items():
            image = compose(jar, folder, layers).resize(SIZE, Image.LANCZOS)
            if not name.endswith("-fg"):
                image = image.convert("RGB")
            image.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
    print(f"scenes={len(LAYERS)} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
