"""Crop STS1 SingleRelicViewPopup textures out of desktop-1.0.jar.

The popup and tier frames are 1920x1080 overlays. SingleRelicViewPopup draws
both at the screen center, so the visible slab is the opaque popup region and
the ornate frame is the opaque frame region.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from scripts.lib.sts1_jar import open_sts1_jar

PANEL_BOX = (627, 152, 1284, 986)
FRAME_BOX = (802, 320, 1114, 621)
FRAMES = {
    "images/ui/relicFrameCommon.png": "frame-common.webp",
    "images/ui/relicFrameUncommon.png": "frame-uncommon.webp",
    "images/ui/relicFrameRare.png": "frame-rare.webp",
    "images/ui/relicFrameBoss.png": "frame-boss.webp",
}


def main() -> None:
    destination = Path("public/images/sts1/relic-popup")
    destination.mkdir(parents=True, exist_ok=True)
    with open_sts1_jar() as jar:
        panel = Image.open(jar.open("images/ui/relicPopup.png")).convert("RGBA").crop(PANEL_BOX)
        panel.save(destination / "panel.webp", "WEBP", quality=90)
        for source, name in FRAMES.items():
            frame = Image.open(jar.open(source)).convert("RGBA").crop(FRAME_BOX)
            frame.save(destination / name, "WEBP", quality=90)
    print(f"Wrote STS1 relic popup assets to {destination}")


if __name__ == "__main__":
    main()
