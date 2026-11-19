"""Render pet look tokens: the parts a look skin adds, composited at their setup-pose positions.

Reads geometry from scripts/sts2-pet-look-geometry.mjs and writes
public/images/sts2/pets/<folder>/<skin with / as _>.webp.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SPINE = ROOT / "public/spine/sts2/monsters"
OUT = ROOT / "public/images/sts2/pets"
TOKEN = 96  # px, longest side; shown at 48px for 2x screens
PAD = 4


def affine_out_to_tex(out_pts, tex_pts):
    """2x3 matrix mapping output pixels to texture pixels, from three corresponding points."""
    (x0, y0), (x1, y1), (x2, y2) = out_pts
    (u0, v0), (u1, v1), (u2, v2) = tex_pts
    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det
    b = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det
    d = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det
    e = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det
    return (a, b, u0 - a * x0 - b * y0, d, e, v0 - d * x0 - e * y0)


def main():
    tokens = json.loads(subprocess.check_output(["node", str(ROOT / "scripts/sts2-pet-look-geometry.mjs")]))
    pages = {}
    for token in tokens:
        parts = token["parts"]
        assert parts, f"{token['folder']} {token['skin']} adds no visible region attachment"
        xs = [p["world"][i] for p in parts for i in range(0, len(p["world"]), 2)]
        ys = [p["world"][i] for p in parts for i in range(1, len(p["world"]), 2)]
        width, height = max(xs) - min(xs), max(ys) - min(ys)
        scale = (TOKEN - 2 * PAD) / max(width, height)
        size = (round(width * scale) + 2 * PAD, round(height * scale) + 2 * PAD)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        for part in parts:
            key = (token["folder"], part["page"])
            if key not in pages:
                pages[key] = Image.open(SPINE / token["folder"] / part["page"]).convert("RGBA")
            page = pages[key]
            # Spine y points up; images point down.
            pts = [((part["world"][i] - min(xs)) * scale + PAD, (max(ys) - part["world"][i + 1]) * scale + PAD) for i in range(0, len(part["world"]), 2)]
            tex = [(part["uvs"][i] * page.width, part["uvs"][i + 1] * page.height) for i in range(0, len(part["uvs"]), 2)]
            layer = Image.new("RGBA", size, (0, 0, 0, 0))
            tris = part["triangles"]
            for t in range(0, len(tris), 3):
                a, b, c = tris[t:t + 3]
                tri = [pts[a], pts[b], pts[c]]
                area = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])
                if abs(area) < 1e-6:
                    continue
                matrix = affine_out_to_tex(tri, [tex[a], tex[b], tex[c]])
                warped = page.transform(size, Image.Transform.AFFINE, matrix, resample=Image.Resampling.BICUBIC)
                mask = Image.new("L", size, 0)
                ImageDraw.Draw(mask).polygon(tri, fill=255)
                layer.paste(warped, (0, 0), mask)
            canvas = Image.alpha_composite(canvas, layer)
        target = OUT / token["folder"] / f"{token['skin'].replace('/', '_')}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(target, "WEBP", lossless=True)
        print(f"{target.relative_to(ROOT)} {size[0]}x{size[1]} from {len(parts)} parts")


if __name__ == "__main__":
    main()
